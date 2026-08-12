import * as Sentry from "@sentry/nextjs";
import { createDatabase, recordGameSessionRevocation } from "@werewolf/database";
import {
  GAME_SESSION_REVOCATION_CHANNEL,
  createGameSessionRevocationMessage,
  gameSessionRevocationKey,
} from "@werewolf/shared/server";
import { publishRuntimeRedisMessage, writeRuntimeRedisValue } from "./runtime-rate-limit";

const REVOCATION_TTL_MS = 24 * 60 * 60 * 1_000;

export async function revokeActiveGameSessions(userId: string) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL липсва при прекратяване на игрова сесия.");
  }
  const revokedAtMs = Date.now();
  await recordGameSessionRevocation(createDatabase(databaseUrl), userId, revokedAtMs);

  try {
    await writeRuntimeRedisValue(
      gameSessionRevocationKey(userId),
      String(revokedAtMs),
      REVOCATION_TTL_MS,
    );
    await publishRuntimeRedisMessage(
      GAME_SESSION_REVOCATION_CHANNEL,
      createGameSessionRevocationMessage(userId, revokedAtMs),
    );
    return { revokedAtMs, realtimeDelivered: true } as const;
  } catch (error) {
    console.error("[auth] realtime game-session revocation failed after durable write", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    Sentry.captureException(error, {
      tags: { subsystem: "game-session-revocation", durableMarker: "written" },
    });
    return { revokedAtMs, realtimeDelivered: false } as const;
  }
}
