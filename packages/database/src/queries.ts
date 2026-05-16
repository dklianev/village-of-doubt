import { count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { gameEvents, gamePlayers, games, userAchievements } from "./schema.js";
import type { Database } from "./client.js";

export interface GameHistorySummary {
  id: string;
  code: string;
  hostId: string | null;
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

export const DELETED_USER_ID = "00000000-0000-0000-0000-000000000000";
export const DELETED_DISPLAY_NAME = "Изтрит играч";

export async function anonymizeUserGameHistory(db: Database, userId: string): Promise<void> {
  if (!userId || userId === DELETED_USER_ID) {
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(gamePlayers)
      .set({ userId: DELETED_USER_ID, displayName: DELETED_DISPLAY_NAME })
      .where(eq(gamePlayers.userId, userId));
    await tx.update(gameEvents).set({ actorId: DELETED_USER_ID }).where(eq(gameEvents.actorId, userId));
    await tx.update(gameEvents).set({ targetId: DELETED_USER_ID }).where(eq(gameEvents.targetId, userId));
    await tx.update(games).set({ hostId: DELETED_USER_ID }).where(eq(games.hostId, userId));
    await tx.delete(userAchievements).where(eq(userAchievements.userId, userId));
  });
}

export async function getRecentGameHistory(db: Database, limit = 20): Promise<GameHistorySummary[]> {
  const rows = await db
    .select({
      id: games.id,
      code: games.code,
      hostId: games.hostId,
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
      hostId: games.hostId,
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

export async function getGameHistoryForUser(db: Database, userId: string, limit = 500): Promise<GameHistorySummary[]> {
  const playerGames = await db
    .select({ gameId: gamePlayers.gameId })
    .from(gamePlayers)
    .where(eq(gamePlayers.userId, userId))
    .limit(limit);
  const playerGameIds = [...new Set(playerGames.map((game) => game.gameId))];
  const whereClause =
    playerGameIds.length > 0 ? or(eq(games.hostId, userId), inArray(games.id, playerGameIds)) : eq(games.hostId, userId);

  const rows = await db
    .select({
      id: games.id,
      code: games.code,
      hostId: games.hostId,
      config: games.config,
      status: games.status,
      winnerTeam: games.winnerTeam,
      startedAt: games.startedAt,
      endedAt: games.endedAt,
    })
    .from(games)
    .where(whereClause)
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

type GameTimelineEventBatchRow = Record<string, unknown> & {
  id: string;
  game_id: string;
  round: number;
  phase: string;
  type: string;
  actor_id: string | null;
  target_id: string | null;
  visibility: string;
  payload: unknown;
  created_at: Date;
};

export async function getGameTimelinesBatch(
  db: Database,
  gameIds: string[],
  perGameLimit = 6,
): Promise<Map<string, GameTimelineEvent[]>> {
  if (gameIds.length === 0) {
    return new Map();
  }

  const rows = await db.execute<GameTimelineEventBatchRow>(sql`
    SELECT id, game_id, round, phase, type, actor_id, target_id, visibility, payload, created_at
    FROM (
      SELECT
        id,
        game_id,
        round,
        phase,
        type,
        actor_id,
        target_id,
        visibility,
        payload,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY created_at DESC) AS rn
      FROM game_events
      WHERE game_id IN (${sql.join(
        gameIds.map((id) => sql`${id}`),
        sql`, `,
      )})
    ) ranked
    WHERE rn <= ${perGameLimit}
    ORDER BY game_id, created_at DESC
  `);

  const grouped = new Map<string, GameTimelineEvent[]>();
  for (const row of rows) {
    const timeline = grouped.get(row.game_id) ?? [];
    timeline.push({
      id: row.id,
      round: row.round,
      phase: row.phase,
      type: row.type,
      actorId: row.actor_id,
      targetId: row.target_id,
      visibility: row.visibility,
      payload: row.payload,
      createdAt: row.created_at,
    });
    grouped.set(row.game_id, timeline);
  }

  return grouped;
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
