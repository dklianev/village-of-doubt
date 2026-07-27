import { createHash } from "node:crypto";
import {
  BoundedMemoryRateLimitStore,
  createSharedRateLimiter,
  type SharedRateLimitBackend,
} from "./rate-limit";
import { getRuntimeRateLimitBackend } from "./runtime-rate-limit";

export class IntakeBodyError extends Error {
  constructor(readonly kind: "invalid_json" | "too_large") {
    super(kind);
  }
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new IntakeBodyError("too_large");
  }

  if (!request.body) {
    return {};
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new IntakeBodyError("too_large");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    const parsed: unknown = text ? JSON.parse(text) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new IntakeBodyError("invalid_json");
  }
}

export function createIntakeRateLimiter(options: { limit: number; windowMs: number; maxEntries?: number }) {
  const store = new BoundedMemoryRateLimitStore(options.maxEntries);

  return {
    check(key: string, now = Date.now()) {
      return store.consume({ key, limit: options.limit, windowMs: options.windowMs, now });
    },
    entryCount: () => store.entryCount(),
  };
}

export function createSharedIntakeRateLimiter(
  options: { limit: number; windowMs: number },
  backend: SharedRateLimitBackend,
) {
  return createSharedRateLimiter(options, backend);
}

export function createRuntimeIntakeRateLimiter(
  options: { limit: number; windowMs: number },
  namespace: string,
  backend: SharedRateLimitBackend = getRuntimeRateLimitBackend(namespace),
) {
  return createSharedRateLimiter(options, backend);
}

export function requestRateLimitKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const source = forwardedFor || "unknown";

  return createHash("sha256").update(source.slice(0, 2_048)).digest("hex");
}
