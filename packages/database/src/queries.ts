import { count, desc, eq, inArray } from "drizzle-orm";
import { gameEvents, games } from "./schema.js";
import type { Database } from "./client.js";

export interface GameHistorySummary {
  id: string;
  code: string;
  config: unknown;
  status: string;
  winnerTeam: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  eventCount: number;
}

export interface GameTimelineEvent {
  id: string;
  round: number;
  phase: string;
  type: string;
  actorId: string | null;
  targetId: string | null;
  visibility: string;
  payload: unknown;
  createdAt: Date;
}

export async function getRecentGameHistory(db: Database, limit = 20): Promise<GameHistorySummary[]> {
  const rows = await db
    .select({
      id: games.id,
      code: games.code,
      config: games.config,
      status: games.status,
      winnerTeam: games.winnerTeam,
      startedAt: games.startedAt,
      endedAt: games.endedAt,
    })
    .from(games)
    .orderBy(desc(games.createdAt))
    .limit(limit);

  if (rows.length === 0) {
    return [];
  }

  const eventCounts = await db
    .select({ gameId: gameEvents.gameId, value: count() })
    .from(gameEvents)
    .where(inArray(gameEvents.gameId, rows.map((game) => game.id)))
    .groupBy(gameEvents.gameId);
  const countsByGameId = new Map(eventCounts.map((item) => [item.gameId, item.value]));

  return rows.map((game) => ({
    ...game,
    eventCount: countsByGameId.get(game.id) ?? 0,
  }));
}

export async function getGameTimeline(db: Database, gameId: string, limit = 100): Promise<GameTimelineEvent[]> {
  return db
    .select({
      id: gameEvents.id,
      round: gameEvents.round,
      phase: gameEvents.phase,
      type: gameEvents.type,
      actorId: gameEvents.actorId,
      targetId: gameEvents.targetId,
      visibility: gameEvents.visibility,
      payload: gameEvents.payload,
      createdAt: gameEvents.createdAt,
    })
    .from(gameEvents)
    .where(eq(gameEvents.gameId, gameId))
    .orderBy(desc(gameEvents.createdAt))
    .limit(limit);
}
