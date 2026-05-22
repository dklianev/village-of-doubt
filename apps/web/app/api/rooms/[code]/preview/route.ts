import { NextResponse } from "next/server";
import { ROOM_CODE_REGEX, normalizeRoomCodeInput, type GameFamily } from "@werewolf/shared";

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

export const revalidate = 5;

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = normalizeRoomCodeInput(rawCode);

  if (!ROOM_CODE_REGEX.test(code)) {
    return missingRoomPreview();
  }

  try {
    const response = await fetch(`${gameServerHttpUrl()}/rooms/${code}/preview`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) {
      return missingRoomPreview();
    }

    const data = toRoomPreview(await response.json());
    if (!data) {
      return missingRoomPreview();
    }

    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=10" },
    });
  } catch {
    return missingRoomPreview();
  }
}

function missingRoomPreview() {
  return NextResponse.json(
    { status: "missing" } satisfies Partial<RoomPreview>,
    {
      status: 200,
      headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=10" },
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
