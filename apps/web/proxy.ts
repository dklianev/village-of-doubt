import { NextResponse, type NextRequest } from "next/server";

const UNAUTHENTICATED_LIMIT = 10;
const AUTHENTICATED_LIMIT = 60;
const WINDOW_MS = 60_000;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const now = Date.now();
  const identity = requestIdentity(request);
  const authenticated = hasAuthCookie(request);
  const limit = authenticated ? AUTHENTICATED_LIMIT : UNAUTHENTICATED_LIMIT;
  const key = `${authenticated ? "auth" : "guest"}:${identity}`;
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + WINDOW_MS };
  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count <= limit) {
    return NextResponse.next();
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return NextResponse.json(
    { error: "Твърде много заявки. Опитай отново след малко." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
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

function hasAuthCookie(request: NextRequest) {
  return Boolean(request.cookies.get("better-auth.session_token") || request.cookies.get("__Secure-better-auth.session_token"));
}
