import { NextResponse } from "next/server";
import { normalizeAvatarId, ROOM_CODE_REGEX, normalizeRoomCode } from "@werewolf/shared";
import { createGameToken } from "@werewolf/shared/server";
import { auth } from "@/lib/auth";
import { normalizeGameTokenDisplayName } from "@/lib/display-name";
import {
  createIntakeRateLimiter,
  IntakeBodyError,
  readBoundedJson,
  requestRateLimitKey,
} from "@/lib/intake-security";

interface TokenRequestBody {
  code?: unknown;
  devUserId?: unknown;
  devDisplayName?: unknown;
}

const MAX_TOKEN_REQUEST_BYTES = 2_048;
// Leave headroom for a full 30-player room plus normal retries behind one NAT.
// The per-user limiter below remains the tighter abuse boundary.
const sourceRateLimiter = createIntakeRateLimiter({ limit: 90, windowMs: 60_000 });
const userRateLimiter = createIntakeRateLimiter({ limit: 12, windowMs: 60_000 });

export async function POST(request: Request) {
  const sourceLimit = sourceRateLimiter.check(requestRateLimitKey(request));
  if (!sourceLimit.allowed) {
    return rateLimitResponse(sourceLimit.retryAfterSeconds);
  }

  let body: TokenRequestBody;
  try {
    body = await readBoundedJson(request, MAX_TOKEN_REQUEST_BYTES);
  } catch (error) {
    const status = error instanceof IntakeBodyError && error.kind === "too_large" ? 413 : 400;
    return NextResponse.json({ error: "Невалидна заявка за игрови ключ." }, { status });
  }
  const roomCode = typeof body.code === "string" ? normalizeRoomCode(body.code) : "";

  if (!ROOM_CODE_REGEX.test(roomCode)) {
    return NextResponse.json({ error: "Невалиден код на стая." }, { status: 400 });
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const allowDevAuth =
    (process.env.ALLOW_DEV_AUTH === "true" && isLocalAuthUrl(process.env.BETTER_AUTH_URL)) ||
    (process.env.ALLOW_DEV_AUTH !== "false" && process.env.NODE_ENV !== "production");
  const sessionDisplayName = normalizeGameTokenDisplayName(session?.user?.name);
  const sessionEmailName = normalizeGameTokenDisplayName(session?.user?.email?.split("@")[0]);
  const userId =
    session?.user?.id ?? (allowDevAuth && typeof body.devUserId === "string" ? `dev:${body.devUserId}` : undefined);
  const displayName =
    sessionDisplayName ||
    sessionEmailName ||
    (allowDevAuth && typeof body.devDisplayName === "string"
      ? normalizeGameTokenDisplayName(body.devDisplayName)
      : undefined);
  const avatarId = normalizeAvatarId(session?.user?.avatarId);

  if (!userId || !displayName) {
    return NextResponse.json({ error: "Трябва да си влязъл, за да получиш игрови ключ." }, { status: 401 });
  }

  const userLimit = userRateLimiter.check(`user:${userId}`);
  if (!userLimit.allowed) {
    return rateLimitResponse(userLimit.retryAfterSeconds);
  }

  const token = createGameToken({
    userId,
    displayName,
    avatarId,
    roomCode,
    secret: getGameTokenSecret(),
  });

  return NextResponse.json({
    token,
    userId,
    displayName,
    avatarId,
    roomCode,
    expiresInSeconds: 300,
  });
}

function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Твърде много заявки за игрови ключ. Опитай отново след малко." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

function getGameTokenSecret() {
  const secret =
    process.env.GAME_TOKEN_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    "dev-only-secret-replace-before-production-32-chars";

  if (process.env.NODE_ENV === "production" && (!process.env.GAME_TOKEN_SECRET || !isProductionSecret(secret))) {
    throw new Error("GAME_TOKEN_SECRET трябва да е реална production тайна от поне 32 символа.");
  }

  return secret;
}

function isProductionSecret(secret: string) {
  return secret.length >= 32 && !/dev-only|replace|change-me|placeholder/i.test(secret);
}

function isLocalAuthUrl(value: string | undefined) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}
