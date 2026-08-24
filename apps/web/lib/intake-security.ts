import { createHash } from "node:crypto";
import { isIP } from "node:net";
import {
  BoundedMemoryRateLimitStore,
  createSharedRateLimiter,
  type SharedRateLimitBackend,
} from "./rate-limit";
import { getRuntimeRateLimitBackend } from "./runtime-rate-limit";
import type { RedisOutageMode } from "./redis-rate-limit";

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
  backend?: SharedRateLimitBackend,
  runtimeOptions?: { outageMode?: RedisOutageMode },
) {
  return createSharedRateLimiter(
    options,
    backend ?? getRuntimeRateLimitBackend(namespace, runtimeOptions),
  );
}

export function requestRateLimitKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const source = normalizeRateLimitSource(forwardedFor);

  return createHash("sha256").update(source.slice(0, 2_048)).digest("hex");
}

function normalizeRateLimitSource(source: string | undefined) {
  if (!source) {
    return "unknown";
  }
  if (isIP(source) === 4) {
    return `ipv4:${source}`;
  }
  if (isIP(source) !== 6) {
    return "unknown";
  }

  const hextets = expandIpv6(source);
  return hextets ? `ipv6-64:${hextets.slice(0, 4).join(":")}` : "unknown";
}

function expandIpv6(value: string): string[] | null {
  const address = value.toLowerCase().split("%", 1)[0] ?? "";
  const separatorIndex = address.indexOf("::");
  if (separatorIndex !== -1 && address.indexOf("::", separatorIndex + 2) !== -1) {
    return null;
  }

  const [leftRaw, rightRaw = ""] = separatorIndex === -1
    ? [address, ""]
    : [address.slice(0, separatorIndex), address.slice(separatorIndex + 2)];
  const left = leftRaw ? leftRaw.split(":") : [];
  const right = rightRaw ? rightRaw.split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((separatorIndex === -1 && missing !== 0) || missing < 0) {
    return null;
  }
  const expanded = separatorIndex === -1
    ? left
    : [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (expanded.length !== 8 || expanded.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) {
    return null;
  }
  return expanded.map((part) => Number.parseInt(part, 16).toString(16));
}
