import {
  GAME_SESSION_REVOCATION_CHANNEL,
  createGameSessionRevocationMessage,
  gameSessionRevocationKey,
} from "@werewolf/shared/server";
import { publishRuntimeRedisMessage, writeRuntimeRedisValue } from "./runtime-rate-limit";

const REVOCATION_TTL_MS = 24 * 60 * 60 * 1_000;

export async function revokeActiveGameSessions(userId: string) {
  const revokedAtMs = Date.now();
  await writeRuntimeRedisValue(
    gameSessionRevocationKey(userId),
    String(revokedAtMs),
    REVOCATION_TTL_MS,
  );
  await publishRuntimeRedisMessage(
    GAME_SESSION_REVOCATION_CHANNEL,
    createGameSessionRevocationMessage(userId, revokedAtMs),
  );
}
