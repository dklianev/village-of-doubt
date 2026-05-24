import * as Sentry from "@sentry/node";
import type { GameConfig } from "@werewolf/shared";
import {
  createGamePersistence,
  type GamePersistence,
} from "../persistence/game-persistence.js";

const MAX_PENDING_PERSIST = 50;

export interface RoomPersistenceContext {
  code: string;
  hostUserId?: string;
  config: GameConfig;
}

export interface RoomPersistenceTaskApi {
  persistence: GamePersistence;
  ensureGame: () => Promise<string | undefined>;
}

export class RoomPersistenceCoordinator {
  private readonly persistence = createGamePersistence();
  private persistQueue: Promise<void> = Promise.resolve();
  private persistQueueLength = 0;
  private persistedGameId: string | undefined;

  get enabled() {
    return this.persistence.enabled;
  }

  async flush(timeoutMs: number) {
    await Promise.race([this.persistQueue, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
  }

  queue(context: RoomPersistenceContext, task: (api: RoomPersistenceTaskApi) => Promise<void>) {
    if (!this.persistence.enabled) {
      return;
    }

    if (this.persistQueueLength >= MAX_PENDING_PERSIST) {
      console.warn(`[GameRoom ${context.code}] persistQueue backpressure (${this.persistQueueLength}), dropping write`);
      return;
    }

    this.persistQueueLength += 1;
    this.persistQueue = this.persistQueue
      .then(() =>
        task({
          persistence: this.persistence,
          ensureGame: () => this.ensureGame(context),
        }),
      )
      .catch((error) => {
        if (process.env.SENTRY_DSN) {
          Sentry.captureException(error);
        }
        console.error("[game-persistence]", error);
      })
      .finally(() => {
        this.persistQueueLength = Math.max(0, this.persistQueueLength - 1);
      });
  }

  private async ensureGame(context: RoomPersistenceContext) {
    if (this.persistedGameId || !this.persistence.enabled || !context.hostUserId) {
      return this.persistedGameId;
    }

    this.persistedGameId = await this.persistence.ensureGame({
      code: context.code,
      hostId: context.hostUserId,
      config: context.config,
    });

    return this.persistedGameId;
  }
}
