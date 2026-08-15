import { NextResponse } from "next/server";
import { ROOM_CODE_REGEX, normalizeRoomCodeInput, type GameFamily } from "@werewolf/shared";
import { createRoomPreviewCredential } from "@werewolf/shared/server";
import { auth } from "@/lib/auth";
import { createRuntimeIntakeRateLimiter, requestRateLimitKey } from "@/lib/intake-security";
import type { RateLimitResult } from "@/lib/rate-limit";

type RoomPreview = {
  code: string;
  status: "lobby" | "in_game" | "finished" | "missing";
  playerCount: number;
  capacity: number;
  family: GameFamily | null;
  hostName: string | null;
  players: Array<{
    displayName: string;
    connected: boolean;
    ready: boolean;
    host: boolean;
  }>;
};

const roomPreviewRateLimiter = createRuntimeIntakeRateLimiter(
  { limit: 30, windowMs: 60_000 },
  "room-preview-source",
);

type RoomPreviewContext = { params: Promise<{ code: string }> };

type RoomPreviewDependencies = {
  checkRateLimit: (key: string) => Promise<RateLimitResult>;
  getSession: (headers: Headers) => Promise<{ user?: { id?: string } } | null>;
  fetcher: typeof fetch;
};

const defaultDependencies: RoomPreviewDependencies = {
  checkRateLimit: (key) => roomPreviewRateLimiter.check(key),
  getSession: (headers) => auth.api.getSession({ headers }) as Promise<{ user?: { id?: string } } | null>,
  fetcher: (...args) => fetch(...args),
};

export function createRoomPreviewHandler(dependencies: RoomPreviewDependencies) {
  return async function handleRoomPreview(request: Request, { params }: RoomPreviewContext) {
    const { code: rawCode } = await params;
    const code = normalizeRoomCodeInput(rawCode);

    if (!ROOM_CODE_REGEX.test(code)) {
      return missingRoomPreview();
    }

    const rateLimit = await dependencies.checkRateLimit(requestRateLimitKey(request));
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Твърде много проверки на стаи. Опитай отново след малко." },
        {
          status: 429,
          headers: {
            "Cache-Control": "private, no-store",
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    try {
      const [session, response] = await Promise.all([
        dependencies.getSession(request.headers),
        dependencies.fetcher(`${gameServerHttpUrl()}/rooms/${code}/preview`, {
          cache: "no-store",
          headers: {
            "X-Werewolf-Room-Preview": createRoomPreviewCredential(code, gameTokenSecret()),
          },
          signal: AbortSignal.timeout(2000),
        }),
      ]);

      if (response.status === 404) {
        return missingRoomPreview();
      }
      if (!response.ok) {
        return unavailableRoomPreview();
      }

      const data = toRoomPreview(await response.json());
      if (!data) {
        return unavailableRoomPreview();
      }

      const viewerCanSeeIdentities = Boolean(session?.user?.id);

      return NextResponse.json(viewerCanSeeIdentities ? data : redactRoomPreviewIdentities(data), {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch {
      return unavailableRoomPreview();
    }
  };
}

export async function GET(request: Request, context: RoomPreviewContext) {
  return createRoomPreviewHandler(defaultDependencies)(request, context);
}

function unavailableRoomPreview() {
  return NextResponse.json(
    { status: "unavailable" },
    {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store",
        "Retry-After": "3",
      },
    },
  );
}

function missingRoomPreview() {
  return NextResponse.json(
    { status: "missing" } satisfies Partial<RoomPreview>,
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

function toRoomPreview(value: unknown): RoomPreview | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const code = typeof record.code === "string" ? normalizeRoomCodeInput(record.code) : "";
  const status = typeof record.status === "string" ? record.status : "";
  const playerCount = typeof record.playerCount === "number" ? record.playerCount : Number.NaN;
  const capacity = typeof record.capacity === "number" ? record.capacity : Number.NaN;
  const family = record.family === "mafia" || record.family === "werewolves" ? record.family : null;
  const players = Array.isArray(record.players)
    ? record.players.flatMap((player) => toRoomPreviewPlayer(player)).slice(0, 6)
    : [];
  const hostName = typeof record.hostName === "string" && record.hostName.trim() ? record.hostName.slice(0, 80) : null;

  if (
    !ROOM_CODE_REGEX.test(code) ||
    (status !== "lobby" && status !== "in_game" && status !== "finished") ||
    !Number.isFinite(playerCount) ||
    !Number.isFinite(capacity)
  ) {
    return null;
  }

  return {
    code,
    status,
    playerCount: Math.max(0, Math.floor(playerCount)),
    capacity: Math.max(0, Math.floor(capacity)),
    family,
    hostName,
    players,
  };
}

function redactRoomPreviewIdentities(preview: RoomPreview): RoomPreview {
  return {
    ...preview,
    hostName: null,
    players: [],
  };
}

function toRoomPreviewPlayer(value: unknown): RoomPreview["players"] {
  if (!value || typeof value !== "object") {
    return [];
  }
  const record = value as Record<string, unknown>;
  const displayName = typeof record.displayName === "string" ? record.displayName.trim().slice(0, 80) : "";
  if (!displayName) {
    return [];
  }
  return [
    {
      displayName,
      connected: record.connected === true,
      ready: record.ready === true,
      host: record.host === true,
    },
  ];
}

function gameServerHttpUrl() {
  const explicitUrl = process.env.GAME_SERVER_HTTP_URL;
  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, "");
  }

  const publicWsUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL;
  if (publicWsUrl) {
    return publicWsUrl.replace(/^ws/i, "http").replace(/\/$/, "");
  }

  return "http://localhost:2567";
}

function gameTokenSecret() {
  const secret = process.env.GAME_TOKEN_SECRET ?? "dev-only-secret-replace-before-production-32-chars";
  if (process.env.NODE_ENV === "production" && !process.env.GAME_TOKEN_SECRET) {
    throw new Error("GAME_TOKEN_SECRET липсва за вътрешната проверка на стая.");
  }
  return secret;
}
