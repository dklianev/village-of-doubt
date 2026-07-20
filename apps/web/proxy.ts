import { NextResponse, type NextRequest } from "next/server";
import { BoundedMemoryRateLimitStore } from "./lib/rate-limit";

// This outer guard is deliberately above the authenticated route limits. A
// supported 30-player party may share one NAT address and legitimately burst
// during room entry; the route still applies stricter per-source/per-user caps.
const UNAUTHENTICATED_LIMIT = 120;
const WINDOW_MS = 60_000;
const MAX_BUCKETS = 10_000;

const proxyRateLimitGuard = createProxyRateLimitGuard();

export function createProxyRateLimitGuard(options: { maxEntries?: number; windowMs?: number } = {}) {
  const store = new BoundedMemoryRateLimitStore(options.maxEntries ?? MAX_BUCKETS);
  const windowMs = options.windowMs ?? WINDOW_MS;

  return {
    check(key: string, limit: number, now = Date.now()) {
      return store.consume({ key, limit, windowMs, now });
    },
    entryCount: () => store.entryCount(),
  };
}

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const now = Date.now();
  const identity = requestIdentity(request);
  const rateLimit = proxyRateLimitGuard.check(identity, UNAUTHENTICATED_LIMIT, now);

  if (rateLimit.allowed) {
    return NextResponse.next();
  }

  return NextResponse.json(
    { error: "Твърде много заявки. Опитай отново след малко." },
    {
      status: 429,
      headers: {
        "Retry-After": String(rateLimit.retryAfterSeconds),
      },
    },
  );
}

export const config = {
  matcher: "/api/game-token",
};

function requestIdentity(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown";
}
