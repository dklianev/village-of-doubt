import { randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import {
  deletedUserIdentities,
  gameEvents,
  gamePlayers,
  games,
  user,
  userAchievements,
  verification,
} from "./schema.js";
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

export interface PublicGameTimelineEvent {
  id: string;
  round: number;
  phase: string;
  type: string;
  createdAt: Date;
}

export interface LeaderboardEntryRow {
  userId: string;
  displayName: string;
  gamesPlayed: number;
  wins: number;
  lastPlayedAt: Date | null;
}

export interface UserAchievementRow {
  achievementId: string;
  gameId: string | null;
  unlockedAt: Date;
}

export interface PlayerRoleInGameRow {
  gameId: string;
  role: string;
}

export interface PlayerOutcomeInGameRow extends PlayerRoleInGameRow {
  won: boolean;
}

export interface PlaceholderUserUpsert {
  userId: string;
  displayName: string;
  email: string;
}

export const DELETED_DISPLAY_NAME = "Изтрит играч";
const ACCOUNT_EVENT_UPDATE_BATCH_SIZE = 250;
export const ACCOUNT_EXPORT_DEFAULT_PAGE_SIZE = 50;
export const ACCOUNT_EXPORT_MAX_PAGE_SIZE = 100;
export const ACCOUNT_EXPORT_MAX_PAGE = 1_000;
export const ACCOUNT_EXPORT_DEFAULT_EVENT_PAGE_SIZE = 500;
export const ACCOUNT_EXPORT_MAX_EVENT_PAGE_SIZE = 1_000;

type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function lockUserIdentityMutations(
  tx: DatabaseTransaction,
  userIds: string[],
): Promise<void> {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))].sort();
  for (const userId of uniqueUserIds) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0::bigint))`);
  }
}

export async function anonymizeUserGameHistory(db: Database, userId: string): Promise<void> {
  if (!userId) {
    return;
  }

  await db.transaction(async (tx) => {
    await lockUserIdentityMutations(tx, [userId]);
    await anonymizeUserGameHistoryInTransaction(tx, userId);
  });
}

export async function deleteUserAccountAtomically(db: Database, userId: string): Promise<boolean> {
  if (!userId) {
    return false;
  }

  return db.transaction(async (tx) => {
    await lockUserIdentityMutations(tx, [userId]);
    const existingUser = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
      .for("update");
    if (!existingUser[0]) {
      return false;
    }

    await anonymizeUserGameHistoryInTransaction(tx, userId);
    const deleted = await tx.delete(user).where(eq(user.id, userId)).returning({ id: user.id });
    if (!deleted[0]) {
      throw new Error("Не успяхме да изтрием потребителското досие.");
    }

    return true;
  });
}

export async function upsertUsersUnlessDeleted(
  db: Database,
  users: PlaceholderUserUpsert[],
): Promise<Map<string, string>> {
  const uniqueUsers = [
    ...new Map(users.filter((item) => item.userId).map((item) => [item.userId, item])).values(),
  ];
  if (uniqueUsers.length === 0) {
    return new Map();
  }

  return db.transaction(async (tx) => {
    const originalUserIds = uniqueUsers.map((item) => item.userId);
    await lockUserIdentityMutations(tx, originalUserIds);

    const tombstones = await tx
      .select({
        originalUserId: deletedUserIdentities.originalUserId,
        anonymousUserId: deletedUserIdentities.anonymousUserId,
      })
      .from(deletedUserIdentities)
      .where(inArray(deletedUserIdentities.originalUserId, originalUserIds));
    const deletedIdentityMap = new Map(
      tombstones.map((row) => [row.originalUserId, row.anonymousUserId]),
    );
    const persistedUsers = [
      ...new Map(uniqueUsers.map((item) => {
        const persistedUserId = deletedIdentityMap.get(item.userId) ?? item.userId;
        const wasDeleted = persistedUserId !== item.userId;
        return [persistedUserId, {
          id: persistedUserId,
          name: wasDeleted ? DELETED_DISPLAY_NAME : item.displayName,
          email: wasDeleted ? `${persistedUserId}@deleted.invalid` : item.email,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }];
      })).values(),
    ];

    await tx.insert(user).values(persistedUsers).onConflictDoNothing();
    return deletedIdentityMap;
  });
}

async function anonymizeUserGameHistoryInTransaction(
  tx: DatabaseTransaction,
  userId: string,
): Promise<void> {
  const existing = await tx
    .select({ anonymousUserId: deletedUserIdentities.anonymousUserId })
    .from(deletedUserIdentities)
    .where(eq(deletedUserIdentities.originalUserId, userId))
    .limit(1);
  let anonymousUserId = existing[0]?.anonymousUserId;

  if (!anonymousUserId) {
    const proposedAnonymousUserId = `deleted_${randomUUID().replaceAll("-", "")}`;
    const inserted = await tx
      .insert(deletedUserIdentities)
      .values({ originalUserId: userId, anonymousUserId: proposedAnonymousUserId })
      .onConflictDoNothing()
      .returning({ anonymousUserId: deletedUserIdentities.anonymousUserId });
    anonymousUserId = inserted[0]?.anonymousUserId;
    if (!anonymousUserId) {
      const raced = await tx
        .select({ anonymousUserId: deletedUserIdentities.anonymousUserId })
        .from(deletedUserIdentities)
        .where(eq(deletedUserIdentities.originalUserId, userId))
        .limit(1);
      anonymousUserId = raced[0]?.anonymousUserId;
    }
  }

  if (!anonymousUserId) {
    throw new Error("Не успяхме да създадем анонимна игрова самоличност.");
  }

  const profileIdentity = await tx
    .select({ displayName: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const playerIdentities = await tx
    .select({ gameId: gamePlayers.gameId, displayName: gamePlayers.displayName })
    .from(gamePlayers)
    .where(eq(gamePlayers.userId, userId));
  const hostedGames = await tx
    .select({ id: games.id })
    .from(games)
    .where(eq(games.hostId, userId));
  const displayNames = [
    ...new Set([
      profileIdentity[0]?.displayName,
      ...playerIdentities.map((player) => player.displayName),
    ].filter((name): name is string => Boolean(name))),
  ];
  const userGameIds = [
    ...new Set([
      ...playerIdentities.map((player) => player.gameId),
      ...hostedGames.map((game) => game.id),
    ]),
  ];
  const eventScope = [
    eq(gameEvents.actorId, userId),
    eq(gameEvents.targetId, userId),
    ...(userGameIds.length > 0 ? [inArray(gameEvents.gameId, userGameIds)] : []),
  ];
  const candidateEvents = await tx
    .select({
      id: gameEvents.id,
      actorId: gameEvents.actorId,
      targetId: gameEvents.targetId,
      payload: gameEvents.payload,
    })
    .from(gameEvents)
    .where(or(...eventScope));

  const payloadUpdates: Array<{ id: string; payload: unknown }> = [];
  for (const event of candidateEvents) {
    const payload = scrubDeletedIdentityFromEventPayload(event.payload, {
      userId,
      anonymousUserId,
      displayNames,
      stripRootSecretRoles: event.actorId === userId || event.targetId === userId,
      rootIdentityNameStems: [
        ...(event.actorId === userId ? ["", "actor"] : []),
        ...(event.targetId === userId ? ["target"] : []),
      ],
    });
    if (JSON.stringify(payload) !== JSON.stringify(event.payload)) {
      payloadUpdates.push({ id: event.id, payload });
    }
  }
  await updateScrubbedEventPayloads(tx, payloadUpdates);

  await tx
    .insert(user)
    .values({
      id: anonymousUserId,
      name: DELETED_DISPLAY_NAME,
      email: `${anonymousUserId}@deleted.invalid`,
      emailVerified: false,
    })
    .onConflictDoNothing();
  await tx
    .update(gamePlayers)
    .set({ userId: anonymousUserId, displayName: DELETED_DISPLAY_NAME })
    .where(eq(gamePlayers.userId, userId));
  await tx
    .update(gamePlayers)
    .set({ loverUserId: anonymousUserId })
    .where(eq(gamePlayers.loverUserId, userId));
  await tx.update(gameEvents).set({ actorId: anonymousUserId }).where(eq(gameEvents.actorId, userId));
  await tx.update(gameEvents).set({ targetId: anonymousUserId }).where(eq(gameEvents.targetId, userId));
  await tx.update(games).set({ hostId: anonymousUserId }).where(eq(games.hostId, userId));
  await tx.delete(userAchievements).where(eq(userAchievements.userId, userId));
  await tx
    .delete(verification)
    .where(or(eq(verification.identifier, userId), eq(verification.value, userId)));
}

async function updateScrubbedEventPayloads(
  tx: DatabaseTransaction,
  updates: Array<{ id: string; payload: unknown }>,
): Promise<void> {
  for (let offset = 0; offset < updates.length; offset += ACCOUNT_EVENT_UPDATE_BATCH_SIZE) {
    const batch = updates.slice(offset, offset + ACCOUNT_EVENT_UPDATE_BATCH_SIZE);
    const values = sql.join(
      batch.map((item) => sql`(${item.id}::uuid, ${JSON.stringify(item.payload)}::jsonb)`),
      sql`, `,
    );

    await tx.execute(sql`
      UPDATE game_events AS event
      SET payload = batch.payload
      FROM (VALUES ${values}) AS batch(id, payload)
      WHERE event.id = batch.id
    `);
  }
}

type DeletedPayloadIdentity = {
  userId: string;
  anonymousUserId: string;
  displayNames: string[];
  stripRootSecretRoles?: boolean;
  rootIdentityNameStems?: string[];
};

const IDENTITY_VALUE_KEYS = /(?:^|_)(?:user|player|actor|target|host)?id$|userid$/i;
const SECRET_ROLE_KEYS = /role/i;

export function scrubDeletedIdentityFromEventPayload(
  payload: unknown,
  identity: DeletedPayloadIdentity,
): unknown {
  const displayNames = new Set(
    identity.displayNames.filter((name) => name && name !== DELETED_DISPLAY_NAME),
  );

  const canonicalKey = (key: string) => key.replace(/[^a-z0-9]/gi, "").toLowerCase();

  const identityStem = (key: string): string | null => {
    const canonical = canonicalKey(key);
    if (canonical === "id" || canonical === "userid" || canonical === "playerid") {
      return "";
    }
    if (canonical.endsWith("userid")) {
      return canonical.slice(0, -"userid".length);
    }
    if (canonical.endsWith("id")) {
      return canonical.slice(0, -"id".length);
    }
    return null;
  };

  const nameStem = (key: string): string | null => {
    const canonical = canonicalKey(key);
    if (canonical === "name" || canonical === "displayname" || canonical === "playername") {
      return "";
    }
    if (canonical.endsWith("displayname")) {
      return canonical.slice(0, -"displayname".length);
    }
    if (canonical.endsWith("name")) {
      return canonical.slice(0, -"name".length);
    }
    return null;
  };

  const scrub = (
    value: unknown,
    stripSecretRoles = false,
    contextualNameStems: readonly string[] = [],
  ): unknown => {
    if (typeof value === "string") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => scrub(item));
    }
    if (!value || typeof value !== "object") {
      return value;
    }

    const source = value as Record<string, unknown>;
    const matchedIdentityStems = new Set([
      ...contextualNameStems,
      ...Object.entries(source)
        .filter(([key, item]) =>
          typeof item === "string" && IDENTITY_VALUE_KEYS.test(key) && item === identity.userId)
        .map(([key]) => identityStem(key))
        .filter((stem): stem is string => stem !== null),
    ]);
    const referencesDeletedIdentity = stripSecretRoles || matchedIdentityStems.size > 0;
    const scrubbed: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(source)) {
      if (key === identity.userId) {
        continue;
      }
      if (
        referencesDeletedIdentity &&
        (SECRET_ROLE_KEYS.test(key) || key === "targetBecame" || key === "stolenRole")
      ) {
        continue;
      }
      if (typeof item === "string" && IDENTITY_VALUE_KEYS.test(key) && item === identity.userId) {
        scrubbed[key] = identity.anonymousUserId;
        continue;
      }

      const currentNameStem = nameStem(key);
      const nameBelongsToIdentity =
        currentNameStem !== null &&
        matchedIdentityStems.has(currentNameStem);
      if (nameBelongsToIdentity && typeof item === "string" && displayNames.has(item)) {
        scrubbed[key] = DELETED_DISPLAY_NAME;
        continue;
      }

      scrubbed[key] = scrub(item);
    }
    return scrubbed;
  };

  return scrub(
    payload,
    identity.stripRootSecretRoles,
    identity.rootIdentityNameStems,
  );
}

export async function getAccountExportPage(
  db: Database,
  userId: string,
  options: { page: number; pageSize: number; eventPage: number; eventPageSize: number },
) {
  const page = Math.min(Math.max(Math.trunc(options.page), 1), ACCOUNT_EXPORT_MAX_PAGE);
  const pageSize = Math.min(
    Math.max(Math.trunc(options.pageSize), 1),
    ACCOUNT_EXPORT_MAX_PAGE_SIZE,
  );
  const eventPage = Math.min(Math.max(Math.trunc(options.eventPage), 1), ACCOUNT_EXPORT_MAX_PAGE);
  const eventPageSize = Math.min(
    Math.max(Math.trunc(options.eventPageSize), 1),
    ACCOUNT_EXPORT_MAX_EVENT_PAGE_SIZE,
  );
  const rows = await db
    .select({
      id: games.id,
      code: games.code,
      config: games.config,
      status: games.status,
      winnerTeam: games.winnerTeam,
      startedAt: games.startedAt,
      endedAt: games.endedAt,
      createdAt: games.createdAt,
      isHost: sql<boolean>`${games.hostId} = ${userId}`,
      playerDisplayName: gamePlayers.displayName,
      playerRole: gamePlayers.role,
      playerIsAlive: gamePlayers.isAlive,
      playerDeathRound: gamePlayers.deathRound,
      playerDeathCause: gamePlayers.deathCause,
      playerIsLover: gamePlayers.isLover,
      playerCreatedAt: gamePlayers.createdAt,
    })
    .from(games)
    .leftJoin(
      gamePlayers,
      and(eq(gamePlayers.gameId, games.id), eq(gamePlayers.userId, userId)),
    )
    .where(or(eq(games.hostId, userId), eq(gamePlayers.userId, userId)))
    .orderBy(desc(games.createdAt), desc(games.id))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);
  const hasMore = rows.length > pageSize;
  const pageRows = rows.slice(0, pageSize);
  const gameIds = pageRows.map((game) => game.id);

  const eventRows = gameIds.length === 0
    ? []
    : await db
        .select({
          id: gameEvents.id,
          gameId: gameEvents.gameId,
          round: gameEvents.round,
          phase: gameEvents.phase,
          type: gameEvents.type,
          actorId: gameEvents.actorId,
          targetId: gameEvents.targetId,
          visibility: gameEvents.visibility,
          createdAt: gameEvents.createdAt,
        })
        .from(gameEvents)
        .where(
          and(
            inArray(gameEvents.gameId, gameIds),
            or(
              eq(gameEvents.visibility, "public"),
              and(eq(gameEvents.actorId, userId), ne(gameEvents.visibility, "moderator")),
            ),
          ),
        )
        .orderBy(desc(gameEvents.createdAt), desc(gameEvents.id))
        .limit(eventPageSize + 1)
        .offset((eventPage - 1) * eventPageSize);
  const eventsHasMore = eventRows.length > eventPageSize;
  const eventsByGameId = new Map<string, Array<Record<string, unknown>>>();

  for (const event of eventRows.slice(0, eventPageSize)) {
    if (event.visibility === "moderator" || (event.visibility !== "public" && event.actorId !== userId)) {
      continue;
    }
    const events = eventsByGameId.get(event.gameId) ?? [];
    events.push({
      id: event.id,
      round: event.round,
      phase: event.phase,
      type: event.type,
      visibility: event.visibility,
      actor: event.actorId === userId ? "self" : null,
      target: event.targetId === userId ? "self" : null,
      createdAt: event.createdAt,
    });
    eventsByGameId.set(event.gameId, events);
  }

  return {
    games: pageRows.map((game) => {
      const events = eventsByGameId.get(game.id) ?? [];
      return {
        id: game.id,
        code: game.code,
        isHost: game.isHost,
        config: game.config,
        status: game.status,
        winnerTeam: game.winnerTeam,
        startedAt: game.startedAt,
        endedAt: game.endedAt,
        createdAt: game.createdAt,
        player: game.playerDisplayName === null
          ? null
          : {
              displayName: game.playerDisplayName,
              role: game.playerRole,
              isAlive: game.playerIsAlive,
              deathRound: game.playerDeathRound,
              deathCause: game.playerDeathCause,
              isLover: game.playerIsLover,
              createdAt: game.playerCreatedAt,
            },
        events,
        eventCount: events.length,
      };
    }),
    page,
    pageSize,
    hasMore,
    eventPage,
    eventPageSize,
    eventsHasMore,
  };
}

export async function getDeletedUserIdentityMap(db: Database, userIds: string[]): Promise<Map<string, string>> {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      originalUserId: deletedUserIdentities.originalUserId,
      anonymousUserId: deletedUserIdentities.anonymousUserId,
    })
    .from(deletedUserIdentities)
    .where(inArray(deletedUserIdentities.originalUserId, uniqueUserIds));
  return new Map(rows.map((row) => [row.originalUserId, row.anonymousUserId]));
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

export async function getRecentEndedGameHistory(db: Database, limit = 20): Promise<GameHistorySummary[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
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
    .where(eq(games.status, "ended"))
    .orderBy(desc(games.endedAt), desc(games.id))
    .limit(safeLimit);

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
    .where(and(eq(games.id, gameId), eq(games.status, "ended")))
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
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);

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
    .leftJoin(
      gamePlayers,
      and(eq(gamePlayers.gameId, games.id), eq(gamePlayers.userId, userId)),
    )
    .where(or(eq(games.hostId, userId), eq(gamePlayers.userId, userId)))
    .orderBy(desc(games.createdAt), desc(games.id))
    .limit(safeLimit);

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

export async function getPlayerRolesInGames(
  db: Database,
  userId: string,
  gameIds: string[],
): Promise<Map<string, string>> {
  if (!userId || gameIds.length === 0) {
    return new Map();
  }

  const rows: PlayerRoleInGameRow[] = await db
    .select({
      gameId: gamePlayers.gameId,
      role: gamePlayers.role,
    })
    .from(gamePlayers)
    .where(and(eq(gamePlayers.userId, userId), inArray(gamePlayers.gameId, gameIds)));

  return new Map(rows.map((row) => [row.gameId, row.role]));
}

export async function getPlayerOutcomesInGames(
  db: Database,
  userId: string,
  gameIds: string[],
): Promise<Map<string, { role: string; won: boolean }>> {
  if (!userId || gameIds.length === 0) {
    return new Map();
  }

  const rows: PlayerOutcomeInGameRow[] = await db
    .select({
      gameId: gamePlayers.gameId,
      role: gamePlayers.role,
      won: gamePlayers.won,
    })
    .from(gamePlayers)
    .where(and(eq(gamePlayers.userId, userId), inArray(gamePlayers.gameId, gameIds)));

  return new Map(rows.map((row) => [row.gameId, { role: row.role, won: row.won }]));
}

export async function getGameTimeline(
  db: Database,
  gameId: string,
  limit = 100,
  options: { visibilityFilter?: "all" | "public" } = {},
): Promise<GameTimelineEvent[]> {
  const visibilityFilter = options.visibilityFilter ?? "all";
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
    .where(
      visibilityFilter === "public"
        ? and(eq(gameEvents.gameId, gameId), eq(gameEvents.visibility, "public"))
        : eq(gameEvents.gameId, gameId),
    )
    .orderBy(desc(gameEvents.createdAt))
    .limit(limit);
}

type PublicGameTimelineEventBatchRow = Record<string, unknown> & {
  id: string;
  game_id: string;
  round: number;
  phase: string;
  type: string;
  visibility: string;
  created_at: Date | string;
};

function normalizeDatabaseDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid database timestamp: ${value}`);
  }

  return date;
}

export async function getPublicGameTimelinesBatch(
  db: Database,
  gameIds: string[],
  perGameLimit = 6,
): Promise<Map<string, PublicGameTimelineEvent[]>> {
  if (gameIds.length === 0) {
    return new Map();
  }

  const safePerGameLimit = Math.min(Math.max(Math.trunc(perGameLimit), 1), 100);
  const rows = await db.execute<PublicGameTimelineEventBatchRow>(sql`
    SELECT id, game_id, round, phase, type, visibility, created_at
    FROM (
      SELECT
        id,
        game_id,
        round,
        phase,
        type,
        visibility,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY created_at DESC) AS rn
      FROM game_events
      WHERE game_id IN (${sql.join(
        gameIds.map((id) => sql`${id}`),
        sql`, `,
      )}) AND visibility = 'public'
    ) ranked
    WHERE rn <= ${safePerGameLimit}
    ORDER BY game_id, created_at DESC
  `);

  const grouped = new Map<string, PublicGameTimelineEvent[]>();
  for (const row of rows) {
    if (row.visibility !== "public") {
      continue;
    }

    const timeline = grouped.get(row.game_id) ?? [];
    timeline.push({
      id: row.id,
      round: row.round,
      phase: row.phase,
      type: row.type,
      createdAt: normalizeDatabaseDate(row.created_at),
    });
    grouped.set(row.game_id, timeline);
  }

  return grouped;
}

export async function getLeaderboardRows(db: Database, limit = 30): Promise<LeaderboardEntryRow[]> {
  const gamesPlayed = sql<number>`COUNT(*)::int`;
  const wins = sql<number>`COALESCE(SUM(CASE WHEN ${gamePlayers.won} THEN 1 ELSE 0 END), 0)::int`;
  const lastPlayedAt = sql<Date | null>`MAX(${games.endedAt})`;

  return db
    .select({
      userId: gamePlayers.userId,
      displayName: user.name,
      gamesPlayed,
      wins,
      lastPlayedAt,
    })
    .from(gamePlayers)
    .innerJoin(games, eq(gamePlayers.gameId, games.id))
    .innerJoin(user, eq(gamePlayers.userId, user.id))
    .where(eq(games.status, "ended"))
    .groupBy(gamePlayers.userId, user.name)
    .orderBy(desc(wins), desc(gamesPlayed), desc(lastPlayedAt))
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
