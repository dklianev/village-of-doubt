import { eq } from "drizzle-orm";
import {
  createDatabase,
  gameEvents,
  gamePlayers,
  games,
  type Database,
} from "@werewolf/database";
import type { GameConfig, GamePhase, RoleCode, WinnerTeam } from "@werewolf/shared";

export type EventVisibility = "public" | "private" | "faction" | "moderator";

export interface PersistGameInput {
  code: string;
  hostId: string;
  config: GameConfig;
}

export interface PersistPlayerInput {
  userId: string;
  displayName: string;
  role: RoleCode;
  isAlive: boolean;
  isLover?: boolean;
  loverUserId?: string | null;
}

export interface PersistEventInput {
  round: number;
  phase: GamePhase;
  type: string;
  actorId?: string | null;
  targetId?: string | null;
  visibility?: EventVisibility;
  payload?: Record<string, unknown>;
}

export interface FinishGameInput {
  winnerTeam: WinnerTeam;
}

export interface GamePersistence {
  enabled: boolean;
  ensureGame(input: PersistGameInput): Promise<string | undefined>;
  markGameActive(gameId: string, config: GameConfig): Promise<void>;
  upsertPlayers(gameId: string, players: PersistPlayerInput[]): Promise<void>;
  recordEvent(gameId: string, event: PersistEventInput): Promise<void>;
  finishGame(gameId: string, input: FinishGameInput): Promise<void>;
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

  async finishGame(): Promise<void> {}
}

class DrizzleGamePersistence implements GamePersistence {
  enabled = true;

  constructor(private readonly db: Database) {}

  async ensureGame(input: PersistGameInput): Promise<string | undefined> {
    const [row] = await this.db
      .insert(games)
      .values({
        code: input.code,
        hostId: input.hostId,
        config: input.config,
        rulesetVersion: input.config.rulesetVersion,
        status: "lobby",
      })
      .onConflictDoUpdate({
        target: games.code,
        set: {
          config: input.config,
          rulesetVersion: input.config.rulesetVersion,
          updatedAt: new Date(),
        },
      })
      .returning({ id: games.id });

    return row?.id;
  }

  async markGameActive(gameId: string, config: GameConfig): Promise<void> {
    await this.db
      .update(games)
      .set({
        config,
        rulesetVersion: config.rulesetVersion,
        status: "active",
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(games.id, gameId));
  }

  async upsertPlayers(gameId: string, players: PersistPlayerInput[]): Promise<void> {
    if (players.length === 0) {
      return;
    }

    await this.db.insert(gamePlayers).values(
      players.map((player) => ({
        gameId,
        userId: player.userId,
        displayName: player.displayName,
        role: player.role,
        isAlive: player.isAlive,
        isLover: player.isLover ?? false,
        loverUserId: player.loverUserId ?? null,
      })),
    );
  }

  async recordEvent(gameId: string, event: PersistEventInput): Promise<void> {
    await this.db.insert(gameEvents).values({
      gameId,
      round: event.round,
      phase: event.phase,
      type: event.type,
      actorId: event.actorId ?? null,
      targetId: event.targetId ?? null,
      visibility: event.visibility ?? "public",
      payload: event.payload ?? {},
    });
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
      .where(eq(games.id, gameId));
  }
}
