import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createGameToken, normalizeRoomCode } from "@werewolf/shared/server";
import { auth } from "@/lib/auth";

interface TokenRequestBody {
  code?: unknown;
  devUserId?: unknown;
  devDisplayName?: unknown;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as TokenRequestBody;
  const roomCode = typeof body.code === "string" ? normalizeRoomCode(body.code) : "";

  if (!roomCode) {
    return NextResponse.json({ error: "Липсва код на стая." }, { status: 400 });
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const allowDevAuth =
    (process.env.ALLOW_DEV_AUTH === "true" && isLocalAuthUrl(process.env.BETTER_AUTH_URL)) ||
    (process.env.ALLOW_DEV_AUTH !== "false" && process.env.NODE_ENV !== "production");
  const userId =
    session?.user?.id ??
    (allowDevAuth && typeof body.devUserId === "string" ? `dev:${body.devUserId}` : undefined);
  const displayName =
    session?.user?.name ??
    (allowDevAuth && typeof body.devDisplayName === "string" ? body.devDisplayName : undefined);

  if (!userId || !displayName) {
    return NextResponse.json({ error: "Нужен е вход, за да влезеш в игра." }, { status: 401 });
  }

  const token = createGameToken({
    userId,
    displayName,
    roomCode,
    secret: getGameTokenSecret(),
  });

  return NextResponse.json({
    token,
    userId,
    displayName,
    roomCode,
    expiresInSeconds: 300,
  });
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
