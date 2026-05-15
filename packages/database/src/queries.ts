import { count, desc, eq, inArray } from "drizzle-orm";
import { gameEvents, gamePlayers, games, userAchievements } from "./schema.js";
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

export interface LeaderboardEntryRow {
  gameId: string;
  displayName: string;
  role: string;
  winnerTeam: string | null;
  endedAt: Date | null;
}

export interface UserAchievementRow {
  achievementId: string;
  gameId: string | null;
  unlockedAt: Date;
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

export async function getGameHistoryById(db: Database, gameId: string): Promise<GameHistorySummary | null> {
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
    .where(eq(games.id, gameId))
    .limit(1);

  const game = rows[0];
  if (!game) {
    return null;
  }

  const eventCounts = await db
    .select({ value: count() })
    .from(gameEvents)
    .where(eq(gameEvents.gameId, game.id))
    .limit(1);

  return {
    ...game,
    eventCount: eventCounts[0]?.value ?? 0,
  };
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

export async function getLeaderboardRows(db: Database, limit = 500): Promise<LeaderboardEntryRow[]> {
  return db
    .select({
      gameId: gamePlayers.gameId,
      displayName: gamePlayers.displayName,
      role: gamePlayers.role,
      winnerTeam: games.winnerTeam,
      endedAt: games.endedAt,
    })
    .from(gamePlayers)
    .innerJoin(games, eq(gamePlayers.gameId, games.id))
    .where(eq(games.status, "ended"))
    .orderBy(desc(games.endedAt))
    .limit(limit);
}

export async function getAchievementsForUser(db: Database, userId: string): Promise<UserAchievementRow[]> {
  if (!userId) {
    return [];
  }

  return db
    .select({
      achievementId: userAchievements.achievementId,
      gameId: userAchievements.gameId,
      unlockedAt: userAchievements.unlockedAt,
    })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId))
    .orderBy(desc(userAchievements.unlockedAt));
}
