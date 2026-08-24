import { and, eq, ne, sql } from "drizzle-orm";
import {
  checkDatabaseReadiness,
  createDatabase,
  DELETED_DISPLAY_NAME,
  gameEvents,
  gamePlayers,
  games,
  upsertUsersUnlessDeleted,
  userAchievements,
  type Database,
} from "@werewolf/database";
import type { GameConfig, GamePhase, RoleCode, WinnerTeam } from "@werewolf/shared";
import { derivePersistenceId } from "./persistence-idempotency.js";

export type EventVisibility = "public" | "private" | "faction" | "moderator";

export interface PersistGameInput {
  code: string;
  hostId: string;
  config: GameConfig;
  idempotencyKey?: string;
}

export interface PersistPlayerInput {
  userId: string;
  displayName: string;
  role: RoleCode;
  isAlive: boolean;
  isLover?: boolean;
  loverUserId?: string | null;
  won?: boolean;
  deathRound?: number | null;
  deathCause?: string | null;
}

export interface PersistEventInput {
  round: number;
  phase: GamePhase;
  type: string;
  actorId?: string | null;
  targetId?: string | null;
  participantUserIds?: readonly string[];
  visibility?: EventVisibility;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  occurredAt?: Date;
}

export interface FinishGameInput {
  winnerTeam: WinnerTeam;
}

export interface CompleteGameInput extends FinishGameInput {
  players: PersistPlayerInput[];
  achievements?: Array<{
    userId: string;
    achievementId: string;
  }>;
}

export interface GamePersistence {
  enabled: boolean;
  ensureGame(input: PersistGameInput): Promise<string | undefined>;
  markGameActive(gameId: string, config: GameConfig): Promise<void>;
  upsertPlayers(gameId: string, players: PersistPlayerInput[]): Promise<void>;
  recordEvent(gameId: string, event: PersistEventInput): Promise<void>;
  recordAchievement(userId: string, achievementId: string, gameId: string): Promise<void>;
  finishGame(gameId: string, input: FinishGameInput): Promise<void>;
  recordGameCompletion(gameId: string, input: CompleteGameInput): Promise<void>;
}

interface GamePersistenceReadinessOptions {
  nodeEnv?: string;
  databaseUrl?: string;
  createDatabaseClient?: (databaseUrl: string) => Database;
  probeDatabase?: (database: Database) => Promise<boolean>;
}

export async function checkGamePersistenceReadiness({
  nodeEnv = process.env.NODE_ENV,
  databaseUrl = process.env.DATABASE_URL,
  createDatabaseClient = createDatabase,
  probeDatabase = checkDatabaseReadiness,
}: GamePersistenceReadinessOptions = {}): Promise<boolean> {
  if (!databaseUrl) {
    return nodeEnv !== "production";
  }

  try {
    return await probeDatabase(createDatabaseClient(databaseUrl));
  } catch {
    return false;
  }
}

export function createGamePersistence(): GamePersistence {
  if (!process.env.DATABASE_URL) {
    return new NoopGamePersistence();
  }

  return new DrizzleGamePersistence(createDatabase());
}

class NoopGamePersistence implements GamePersistence {
  enabled = false;

  async ensureGame(): Promise<string | undefined> {
    return undefined;
  }

  async markGameActive(): Promise<void> {}

  async upsertPlayers(): Promise<void> {}

  async recordEvent(): Promise<void> {}

  async recordAchievement(): Promise<void> {}

  async finishGame(): Promise<void> {}

  async recordGameCompletion(): Promise<void> {}
}

export class DrizzleGamePersistence implements GamePersistence {
  enabled = true;

  constructor(private readonly db: Database) {}

  async ensureGame(input: PersistGameInput): Promise<string | undefined> {
    const hostIdentity = await this.ensureUsers([{
      userId: input.hostId,
      displayName: input.hostId,
    }]);
    const hostId = hostIdentity.get(input.hostId) ?? input.hostId;

    const gameValues = {
      code: input.code,
      hostId,
      config: input.config,
      roomVisibility: input.config.roomVisibility,
      rulesetVersion: input.config.rulesetVersion,
      status: "lobby" as const,
    };
    if (!input.idempotencyKey) {
      const [row] = await this.db
        .insert(games)
        .values(gameValues)
        .returning({ id: games.id });

      return row?.id;
    }

    const id = derivePersistenceId("game", input.idempotencyKey);
    const [row] = await this.db
      .insert(games)
      .values({ id, ...gameValues })
      .onConflictDoNothing({ target: games.id })
      .returning({ id: games.id });

    return row?.id ?? id;
  }

  async markGameActive(gameId: string, config: GameConfig): Promise<void> {
    await this.db
      .update(games)
      .set({
        config,
        roomVisibility: config.roomVisibility,
        rulesetVersion: config.rulesetVersion,
        status: "active",
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(games.id, gameId), eq(games.status, "lobby")));
  }

  async upsertPlayers(gameId: string, players: PersistPlayerInput[]): Promise<void> {
    if (players.length === 0) {
      return;
    }

    const playerUserIds = new Set(players.map((player) => player.userId));
    const identityMap = await this.ensureUsers([
      ...players,
      ...players.flatMap((player) =>
        player.loverUserId && !playerUserIds.has(player.loverUserId)
          ? [{ userId: player.loverUserId, displayName: player.loverUserId }]
          : []),
    ]);
    const persistedPlayers = players.map((player) => {
      const userId = identityMap.get(player.userId) ?? player.userId;
      return {
        ...player,
        userId,
        displayName: userId === player.userId ? player.displayName : DELETED_DISPLAY_NAME,
        loverUserId: player.loverUserId ? (identityMap.get(player.loverUserId) ?? player.loverUserId) : null,
      };
    });
    await this.db
      .insert(gamePlayers)
      .values(persistedPlayers.map((player) => ({
        gameId,
        userId: player.userId,
        displayName: player.displayName,
        role: player.role,
        isAlive: player.isAlive,
        isLover: player.isLover ?? false,
        loverUserId: player.loverUserId ?? null,
        won: player.won ?? false,
        deathRound: player.deathRound ?? null,
        deathCause: player.deathCause ?? null,
      })))
      .onConflictDoUpdate({
        target: [gamePlayers.gameId, gamePlayers.userId],
        set: {
          displayName: sql.raw(`excluded.${gamePlayers.displayName.name}`),
          role: sql.raw(`excluded.${gamePlayers.role.name}`),
          isAlive: sql.raw(`excluded.${gamePlayers.isAlive.name}`),
          isLover: sql.raw(`excluded.${gamePlayers.isLover.name}`),
          loverUserId: sql.raw(`excluded.${gamePlayers.loverUserId.name}`),
          won: sql.raw(`excluded.${gamePlayers.won.name}`),
          deathRound: sql.raw(`excluded.${gamePlayers.deathRound.name}`),
          deathCause: sql.raw(`excluded.${gamePlayers.deathCause.name}`),
        },
      });
  }

  async recordEvent(gameId: string, event: PersistEventInput): Promise<void> {
    const participantUserIds = new Set(
      (event.participantUserIds ?? []).filter(isValidUserId),
    );
    const actorUserId = isCapturedParticipant(event.actorId, participantUserIds) ? event.actorId : null;
    const targetUserId = isCapturedParticipant(event.targetId, participantUserIds) ? event.targetId : null;
    const payloadUserIds = collectStructuredPayloadUserIds(event.payload, participantUserIds);
    const identityMap = await this.ensureUsers(
      [actorUserId, targetUserId, ...payloadUserIds]
        .filter((userId): userId is string => Boolean(userId))
        .map((userId) => ({ userId, displayName: userId })),
    );
    const actorId = actorUserId ? (identityMap.get(actorUserId) ?? actorUserId) : null;
    const targetId = targetUserId ? (identityMap.get(targetUserId) ?? targetUserId) : null;

    const eventValues = {
      gameId,
      round: event.round,
      phase: event.phase,
      type: event.type,
      actorId,
      targetId,
      visibility: event.visibility ?? "public",
      payload: scrubPersistedEventPayload(event.payload ?? {}, identityMap, {
        rootIdentityWasDeleted: Boolean(
          (actorUserId && identityMap.has(actorUserId))
          || (targetUserId && identityMap.has(targetUserId)),
        ),
      }),
      createdAt: event.occurredAt ?? new Date(),
    };
    if (!event.idempotencyKey) {
      await this.db.insert(gameEvents).values(eventValues);
      return;
    }

    await this.db
      .insert(gameEvents)
      .values({
        id: derivePersistenceId("event", event.idempotencyKey),
        ...eventValues,
      })
      .onConflictDoNothing({ target: gameEvents.id });
  }

  async recordAchievement(userId: string, achievementId: string, gameId: string): Promise<void> {
    const identityMap = await this.ensureUsers([{ userId, displayName: userId }]);
    if (identityMap.has(userId)) {
      return;
    }

    await this.db
      .insert(userAchievements)
      .values({
        userId,
        achievementId,
        gameId,
      })
      .onConflictDoNothing();
  }

  async finishGame(gameId: string, input: FinishGameInput): Promise<void> {
    await this.db
      .update(games)
      .set({
        status: "ended",
        winnerTeam: input.winnerTeam,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(games.id, gameId), ne(games.status, "ended")));
  }

  async recordGameCompletion(gameId: string, input: CompleteGameInput): Promise<void> {
    await this.db.transaction(async (tx) => {
      const persistence = new DrizzleGamePersistence(tx as unknown as Database);
      await persistence.upsertPlayers(gameId, input.players);
      await persistence.finishGame(gameId, { winnerTeam: input.winnerTeam });
      for (const achievement of input.achievements ?? []) {
        await persistence.recordAchievement(achievement.userId, achievement.achievementId, gameId);
      }
    });
  }

  private async ensureUsers(
    players: Array<{ userId: string; displayName: string }>,
  ): Promise<Map<string, string>> {
    if (players.length === 0) {
      return new Map();
    }

    const uniquePlayers = [...new Map(players.filter((player) => isValidUserId(player.userId)).map((player) => [player.userId, player])).values()];
    if (uniquePlayers.length === 0) {
      return new Map();
    }

    return upsertUsersUnlessDeleted(
      this.db,
      uniquePlayers.map((player) => ({
        ...player,
        email: `${sanitizeUserId(player.userId)}@anonymous.local`,
      })),
    );
  }
}

function isValidUserId(userId: string) {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(userId);
}

function isCapturedParticipant(
  userId: string | null | undefined,
  participantUserIds: ReadonlySet<string>,
): userId is string {
  return Boolean(userId && participantUserIds.has(userId));
}

function sanitizeUserId(userId: string) {
  return userId.toLowerCase().replace(/[^a-z0-9_.-]/g, "_").slice(0, 64) || "anonymous";
}

const PAYLOAD_ID_KEYS = new Set([
  "userId",
  "playerId",
  "actorId",
  "targetId",
  "hostId",
  "previousHostUserId",
  "loverUserId",
  "firstUserId",
  "secondUserId",
]);
const PAYLOAD_ID_ARRAY_KEYS = new Set([
  "userIds",
  "playerIds",
  "participantUserIds",
  "winnerPlayerIds",
]);
const PAYLOAD_ID_MAP_KEYS = new Set([
  "assignments",
]);
const PAYLOAD_NAME_KEYS = new Set([
  "name",
  "displayName",
  "playerName",
  "actorName",
  "targetName",
  "hostName",
  "previousHostName",
  "loverName",
  "firstName",
  "secondName",
]);
const PAYLOAD_SECRET_ROLE_KEYS = new Set([
  "role",
  "roleNameBg",
  "targetRole",
  "exactRole",
  "stolenRole",
  "targetBecame",
]);
const PAYLOAD_NAME_ID_KEY = new Map([
  ["playerName", "playerId"],
  ["actorName", "actorId"],
  ["targetName", "targetId"],
  ["hostName", "hostId"],
  ["previousHostName", "previousHostUserId"],
  ["loverName", "loverUserId"],
  ["firstName", "firstUserId"],
  ["secondName", "secondUserId"],
]);

export function collectStructuredPayloadUserIds(
  payload: unknown,
  participantUserIds: ReadonlySet<string>,
): string[] {
  const userIds = new Set<string>();
  const visit = (value: unknown, parentKey?: string) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (parentKey && PAYLOAD_ID_ARRAY_KEYS.has(parentKey) && typeof item === "string") {
          userIds.add(item);
        } else {
          visit(item);
        }
      }
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (parentKey && PAYLOAD_ID_MAP_KEYS.has(parentKey) && participantUserIds.has(key)) {
        userIds.add(key);
      }
      if (PAYLOAD_ID_KEYS.has(key) && typeof item === "string") {
        userIds.add(item);
      } else {
        visit(item, key);
      }
    }
  };
  visit(payload);
  return [...userIds];
}

export function scrubPersistedEventPayload(
  payload: unknown,
  deletedIdentityMap: ReadonlyMap<string, string>,
  options: { rootIdentityWasDeleted?: boolean } = {},
): unknown {
  const scrub = (value: unknown, parentKey?: string, inheritedDeletedIdentity = false): unknown => {
    if (Array.isArray(value)) {
      if (parentKey && PAYLOAD_ID_ARRAY_KEYS.has(parentKey)) {
        return value.map((item) => typeof item === "string" ? (deletedIdentityMap.get(item) ?? item) : item);
      }
      return value.map((item) => scrub(item));
    }
    if (!value || typeof value !== "object") {
      return value;
    }

    const source = value as Record<string, unknown>;
    const referencesDeletedIdentity = inheritedDeletedIdentity || Object.entries(source).some(
      ([key, item]) => PAYLOAD_ID_KEYS.has(key) && typeof item === "string" && deletedIdentityMap.has(item),
    );
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(source)) {
      const keyIsDeletedIdentity = Boolean(
        parentKey && PAYLOAD_ID_MAP_KEYS.has(parentKey) && deletedIdentityMap.has(key),
      );
      const remappedKey = keyIsDeletedIdentity ? (deletedIdentityMap.get(key) ?? key) : key;
      if (referencesDeletedIdentity && PAYLOAD_SECRET_ROLE_KEYS.has(key)) {
        continue;
      }
      if (PAYLOAD_ID_KEYS.has(key) && typeof item === "string") {
        result[remappedKey] = deletedIdentityMap.get(item) ?? item;
        continue;
      }
      if (PAYLOAD_NAME_KEYS.has(key) && typeof item === "string") {
        const pairedIdKey = PAYLOAD_NAME_ID_KEY.get(key);
        const pairedId = pairedIdKey ? source[pairedIdKey] : undefined;
        const shouldRedactName = pairedIdKey
          ? typeof pairedId === "string" && deletedIdentityMap.has(pairedId)
          : referencesDeletedIdentity;
        if (shouldRedactName) {
          result[remappedKey] = DELETED_DISPLAY_NAME;
          continue;
        }
      }
      result[remappedKey] = scrub(item, key, inheritedDeletedIdentity || keyIsDeletedIdentity);
    }
    return result;
  };

  return scrub(payload, undefined, options.rootIdentityWasDeleted ?? false);
}
