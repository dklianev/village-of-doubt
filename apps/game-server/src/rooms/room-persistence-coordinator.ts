import * as Sentry from "@sentry/node";
import { randomUUID } from "node:crypto";
import type { GameConfig } from "@werewolf/shared";
import {
  createGamePersistence,
  type GamePersistence,
} from "../persistence/game-persistence.js";

const MAX_PENDING_PERSIST = 50;
const MAX_PERSIST_ATTEMPTS = 5;

export type PersistencePriority = "critical" | "normal" | "best-effort";

export interface PersistenceQueueOptions {
  priority?: PersistencePriority;
  maxAttempts?: number;
  terminal?: boolean;
}

export interface RoomPersistenceContext {
  code: string;
  hostUserId?: string;
  config: GameConfig;
  roomIdempotencyKey?: string;
}

export interface RoomPersistenceIdempotencyKeys {
  game: string;
  event: (scope?: string) => string;
}

export interface RoomPersistenceTaskApi {
  persistence: GamePersistence;
  ensureGame: () => Promise<string | undefined>;
  idempotencyKeys?: RoomPersistenceIdempotencyKeys;
}

interface PendingPersistenceTask {
  context: RoomPersistenceContext;
  task: (api: RoomPersistenceTaskApi) => Promise<void>;
  priority: PersistencePriority;
  maxAttempts: number;
  terminal: boolean;
  idempotencyKeys: RoomPersistenceIdempotencyKeys;
}

export class RoomPersistenceCoordinator {
  private readonly pending: Record<PersistencePriority, PendingPersistenceTask[]> = {
    critical: [],
    normal: [],
    "best-effort": [],
  };
  private drainPromise: Promise<void> | undefined;
  private activeTask: PendingPersistenceTask | undefined;
  private readonly taskPersistence: GamePersistence;
  private persistedGameId: string | undefined;
  private ensureGamePromise: Promise<string | undefined> | undefined;
  private boundContext: { code: string; roomIdempotencyKey: string } | undefined;
  private creationHostUserId: string | undefined;
  private roomIdempotencyKey: string | undefined;
  private nextTaskSequence = 0;
  private terminalAccepted = false;
  private accepting = true;
  private abortDrain = false;

  constructor(
    private readonly persistence: GamePersistence = createGamePersistence(),
    private readonly captureException: (error: unknown) => unknown = Sentry.captureException,
    private readonly retryDelay: (attempt: number) => Promise<void> = defaultRetryDelay,
  ) {
    this.taskPersistence = {
      enabled: persistence.enabled,
      ensureGame: (input) => this.runPersistenceMutation(() => persistence.ensureGame(input)),
      markGameActive: (gameId, config) => this.runPersistenceMutation(
        () => persistence.markGameActive(gameId, config),
      ),
      upsertPlayers: (gameId, players) => this.runPersistenceMutation(
        () => persistence.upsertPlayers(gameId, players),
      ),
      recordEvent: (gameId, event) => this.runPersistenceMutation(
        () => persistence.recordEvent(gameId, event),
      ),
      recordAchievement: (userId, achievementId, gameId) => this.runPersistenceMutation(
        () => persistence.recordAchievement(userId, achievementId, gameId),
      ),
      finishGame: (gameId, input) => this.runPersistenceMutation(
        () => persistence.finishGame(gameId, input),
      ),
      recordGameCompletion: (gameId, input) => this.runPersistenceMutation(
        () => persistence.recordGameCompletion(gameId, input),
      ),
    };
  }

  get enabled() {
    return this.persistence.enabled;
  }

  get hasPendingTerminalWork() {
    return Boolean(this.activeTask?.terminal)
      || this.pending.critical.some((task) => task.terminal);
  }

  async flush(timeoutMs: number): Promise<boolean> {
    return this.waitForDrain(timeoutMs, false);
  }

  async dispose(timeoutMs: number): Promise<boolean> {
    this.accepting = false;
    return this.waitForDrain(timeoutMs, true);
  }

  private async waitForDrain(timeoutMs: number, abortOnTimeout: boolean) {
    const deadline = Date.now() + Math.max(0, timeoutMs);

    while (this.drainPromise || this.queuedTaskCount > 0) {
      this.startDrain();
      const activeDrain = this.drainPromise;
      if (!activeDrain) {
        continue;
      }

      const remaining = deadline - Date.now();
      if (remaining <= 0 || !(await settlesWithin(activeDrain, remaining))) {
        if (abortOnTimeout) {
          this.abortDrain = true;
          this.clearPending();
        }
        this.reportFlushTimeout(timeoutMs);
        return false;
      }
    }

    return true;
  }

  private reportFlushTimeout(timeoutMs: number) {
    const error = new Error(
      `Game room persistence queue did not flush within ${Math.max(0, timeoutMs)}ms`,
    );
    if (process.env.SENTRY_DSN) {
      this.captureException(error);
    }
    console.error("[game-persistence]", error);
  }

  queue(
    context: RoomPersistenceContext,
    task: (api: RoomPersistenceTaskApi) => Promise<void>,
    options: PersistenceQueueOptions = {},
  ): boolean {
    if (!this.persistence.enabled || !this.accepting) {
      return false;
    }

    const priority = options.priority ?? "normal";
    const terminal = options.terminal ?? false;
    if (terminal && priority !== "critical") {
      console.warn(`[GameRoom ${context.code}] terminal persistence work must use critical priority`);
      return false;
    }
    if (terminal && this.terminalAccepted) {
      console.warn(`[GameRoom ${context.code}] terminal persistence work was already accepted`);
      return false;
    }

    if (!terminal && this.regularPendingTaskCount >= MAX_PENDING_PERSIST) {
      if (priority === "best-effort") {
        console.warn(
          `[GameRoom ${context.code}] persistQueue backpressure (${this.regularPendingTaskCount}), dropping best-effort write`,
        );
        return false;
      }

      const evictedBestEffort = this.pending["best-effort"].shift();
      if (evictedBestEffort) {
        console.warn(
          `[GameRoom ${context.code}] persistQueue hard limit (${this.regularPendingTaskCount}), evicting best-effort write for ${priority} write`,
        );
      } else if (priority === "normal") {
        console.warn(`[GameRoom ${context.code}] persistQueue hard limit (${this.regularPendingTaskCount}), dropping normal write`);
        return false;
      } else {
        const evictedNormal = this.pending.normal.shift();
        if (!evictedNormal) {
          console.warn(
            `[GameRoom ${context.code}] persistQueue hard limit (${this.regularPendingTaskCount}), preserving accepted critical writes and rejecting the new critical write`,
          );
          return false;
        }
        console.warn(
          `[GameRoom ${context.code}] persistQueue hard limit (${this.regularPendingTaskCount}), evicting normal write for critical write`,
        );
      }
    }

    const roomIdempotencyKey = this.getRoomIdempotencyKey(context);
    const taskSequence = this.nextTaskSequence;
    this.nextTaskSequence += 1;
    const pendingTask: PendingPersistenceTask = {
      context: cloneContext(context),
      task,
      priority,
      maxAttempts: normalizeMaxAttempts(options.maxAttempts, priority),
      terminal,
      idempotencyKeys: {
        game: roomIdempotencyKey,
        event: (scope = "default") => `${roomIdempotencyKey}:event:${taskSequence}:${scope}`,
      },
    };
    if (terminal) {
      this.terminalAccepted = true;
    }
    this.pending[priority].push(pendingTask);
    this.startDrain();
    return true;
  }

  private get queuedTaskCount() {
    return this.pending.critical.length
      + this.pending.normal.length
      + this.pending["best-effort"].length;
  }

  private get regularPendingTaskCount() {
    return this.pending.critical.filter((task) => !task.terminal).length
      + this.pending.normal.length
      + this.pending["best-effort"].length
      + (this.activeTask && !this.activeTask.terminal ? 1 : 0);
  }

  private startDrain() {
    if (this.abortDrain || this.drainPromise || this.queuedTaskCount === 0) {
      return;
    }

    this.drainPromise = Promise.resolve()
      .then(() => this.drain())
      .finally(() => {
        this.drainPromise = undefined;
        this.startDrain();
      });
  }

  private async drain() {
    let pendingTask = this.takeNextTask();
    while (pendingTask && !this.abortDrain) {
      this.activeTask = pendingTask;
      try {
        await this.runTask(pendingTask);
      } finally {
        this.activeTask = undefined;
      }
      if (this.abortDrain) {
        return;
      }
      pendingTask = this.takeNextTask();
    }
  }

  private takeNextTask() {
    return this.pending.critical.shift() ?? this.pending.normal.shift() ?? this.pending["best-effort"].shift();
  }

  private async runTask(pendingTask: PendingPersistenceTask) {
    let attempt = 1;
    while (!this.abortDrain) {
      if (this.abortDrain) {
        return;
      }
      try {
        await pendingTask.task({
          persistence: this.taskPersistence,
          ensureGame: () => this.ensureGame(pendingTask.context, pendingTask.idempotencyKeys.game),
          idempotencyKeys: pendingTask.idempotencyKeys,
        });
        return;
      } catch (error) {
        if (this.abortDrain) {
          return;
        }
        const shouldRetry = attempt < pendingTask.maxAttempts;
        if (shouldRetry) {
          await this.retryDelay(Math.min(attempt, pendingTask.maxAttempts));
          attempt += 1;
          if (this.abortDrain) {
            return;
          }
          continue;
        }

        if (process.env.SENTRY_DSN) {
          this.captureException(error);
        }
        console.error("[game-persistence]", error);
        return;
      }
    }
  }

  private async ensureGame(context: RoomPersistenceContext, idempotencyKey: string) {
    if (this.abortDrain) {
      throw new Error("Persistence coordinator was disposed before the write could start.");
    }
    if (!this.persistence.enabled) {
      return this.persistedGameId;
    }

    if (this.boundContext && (
      this.boundContext.code !== context.code
      || this.boundContext.roomIdempotencyKey !== idempotencyKey
    )) {
      throw new Error("Persistence coordinator cannot be reused across game instances.");
    }

    if (this.persistedGameId) {
      return this.persistedGameId;
    }

    const creationHostUserId = this.creationHostUserId ?? context.hostUserId;
    if (!creationHostUserId) {
      return undefined;
    }

    this.boundContext ??= { code: context.code, roomIdempotencyKey: idempotencyKey };
    this.creationHostUserId ??= creationHostUserId;
    this.ensureGamePromise ??= this.persistence
      .ensureGame({
        code: context.code,
        hostId: creationHostUserId,
        config: structuredClone(context.config),
        idempotencyKey,
      })
      .then((gameId) => {
        this.persistedGameId = gameId;
        return gameId;
      })
      .finally(() => {
        this.ensureGamePromise = undefined;
      });

    return this.ensureGamePromise;
  }

  private getRoomIdempotencyKey(context: RoomPersistenceContext) {
    const providedKey = context.roomIdempotencyKey?.trim();
    if (providedKey && this.roomIdempotencyKey && this.roomIdempotencyKey !== providedKey) {
      throw new Error("Persistence coordinator cannot change room idempotency keys.");
    }

    this.roomIdempotencyKey ??= providedKey ?? randomUUID();
    return this.roomIdempotencyKey;
  }

  private clearPending() {
    this.pending.critical.length = 0;
    this.pending.normal.length = 0;
    this.pending["best-effort"].length = 0;
  }

  private runPersistenceMutation<T>(operation: () => Promise<T>): Promise<T> {
    if (this.abortDrain) {
      return Promise.reject(new Error("Persistence coordinator was disposed before the write could start."));
    }
    return operation();
  }
}

function cloneContext(context: RoomPersistenceContext): RoomPersistenceContext {
  const cloned = {
    code: context.code,
    config: structuredClone(context.config),
  };

  return {
    ...cloned,
    ...(context.hostUserId ? { hostUserId: context.hostUserId } : {}),
    ...(context.roomIdempotencyKey ? { roomIdempotencyKey: context.roomIdempotencyKey } : {}),
  };
}

function normalizeMaxAttempts(value: number | undefined, priority: PersistencePriority) {
  if (Number.isSafeInteger(value) && value && value > 0) {
    return Math.min(value, MAX_PERSIST_ATTEMPTS);
  }
  return priority === "critical" ? 3 : 1;
}

function defaultRetryDelay(attempt: number) {
  return new Promise<void>((resolve) =>
    setTimeout(resolve, Math.min(1_000, 25 * 2 ** Math.min(attempt - 1, 8))),
  );
}

function settlesWithin(promise: Promise<void>, timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);
    promise.then(
      () => {
        clearTimeout(timeout);
        resolve(true);
      },
      () => {
        clearTimeout(timeout);
        resolve(true);
      },
    );
  });
}
