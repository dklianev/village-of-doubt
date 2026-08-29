import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameConfig } from "@werewolf/shared";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { RoomPersistenceCoordinator } from "../room-persistence-coordinator.js";
import type { GamePersistence } from "../../persistence/game-persistence.js";

function makePersistence(enabled = true): GamePersistence {
  return {
    enabled,
    ensureGame: vi.fn(async () => "game-1"),
    markGameActive: vi.fn(async () => {}),
    upsertPlayers: vi.fn(async () => {}),
    recordEvent: vi.fn(async () => {}),
    recordAchievement: vi.fn(async () => {}),
    finishGame: vi.fn(async () => {}),
    recordGameCompletion: vi.fn(async () => {}),
  };
}

const context = {
  code: "RPPM23",
  hostUserId: "host-1",
  config: { mode: "werewolves_classic" } as GameConfig,
};

describe("RoomPersistenceCoordinator", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("queues writes, ensures the game once, and flushes pending work", async () => {
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence);

    coordinator.queue(context, async ({ persistence: apiPersistence, ensureGame }) => {
      const gameId = await ensureGame();
      await apiPersistence.recordEvent(gameId!, {
        round: 1,
        phase: "lobby",
        type: "test",
      });
    });
    coordinator.queue(context, async ({ persistence: apiPersistence, ensureGame }) => {
      const gameId = await ensureGame();
      await apiPersistence.finishGame(gameId!, { winnerTeam: "village" });
    });

    await coordinator.flush(100);

    expect(persistence.ensureGame).toHaveBeenCalledOnce();
    expect(persistence.recordEvent).toHaveBeenCalledOnce();
    expect(persistence.finishGame).toHaveBeenCalledOnce();
  });

  it("keeps the same persisted game when room ownership moves to a successor", async () => {
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence);
    const firstHostContext = { ...context, roomIdempotencyKey: "room-instance-1" };
    const successorContext = {
      ...firstHostContext,
      hostUserId: "host-2",
    };

    coordinator.queue(firstHostContext, async ({ ensureGame }) => {
      await ensureGame();
    });
    coordinator.queue(successorContext, async ({ persistence: apiPersistence, ensureGame }) => {
      const gameId = await ensureGame();
      await apiPersistence.recordEvent(gameId!, {
        round: 1,
        phase: "night",
        type: "host_succeeded",
      });
    });

    await expect(coordinator.flush(100)).resolves.toBe(true);
    expect(persistence.ensureGame).toHaveBeenCalledOnce();
    expect(persistence.ensureGame).toHaveBeenCalledWith(expect.objectContaining({
      hostId: "host-1",
      idempotencyKey: "room-instance-1",
    }));
    expect(persistence.recordEvent).toHaveBeenCalledOnce();
  });

  it("preserves FIFO ordering for queued writes", async () => {
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence);
    const order: number[] = [];

    coordinator.queue(context, async () => {
      order.push(1);
    });
    coordinator.queue(context, async () => {
      order.push(2);
    });
    coordinator.queue(context, async () => {
      order.push(3);
    });

    await coordinator.flush(100);

    expect(order).toEqual([1, 2, 3]);
  });

  it("runs higher-priority writes first while preserving FIFO within a priority", async () => {
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence);
    const order: string[] = [];

    coordinator.queue(context, async () => {
      order.push("normal-1");
    });
    coordinator.queue(context, async () => {
      order.push("best-effort");
    }, { priority: "best-effort" });
    coordinator.queue(context, async () => {
      order.push("critical");
    }, { priority: "critical" });
    coordinator.queue(context, async () => {
      order.push("normal-2");
    });

    await coordinator.flush(100);

    expect(order).toEqual(["critical", "normal-1", "normal-2", "best-effort"]);
  });

  it("is a no-op when persistence is disabled", async () => {
    const persistence = makePersistence(false);
    const coordinator = new RoomPersistenceCoordinator(persistence);
    const task = vi.fn();

    coordinator.queue(context, task);
    await coordinator.flush(100);

    expect(task).not.toHaveBeenCalled();
    expect(persistence.ensureGame).not.toHaveBeenCalled();
  });

  it("drops only best-effort writes above the pending queue budget", async () => {
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const task = vi.fn(async () => {});

    for (let i = 0; i < 50; i++) {
      coordinator.queue(context, task);
    }
    expect(coordinator.queue(context, task, { priority: "best-effort" })).toBe(false);
    await coordinator.flush(100);

    expect(task).toHaveBeenCalledTimes(50);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("dropping best-effort write"));
  });

  it("keeps normal writes within the hard queue budget", async () => {
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const task = vi.fn(async () => {});

    for (let i = 0; i < 50; i++) {
      expect(coordinator.queue(context, task)).toBe(true);
    }
    expect(coordinator.queue(context, task)).toBe(false);
    await coordinator.flush(100);

    expect(task).toHaveBeenCalledTimes(50);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("dropping normal write"));
  });

  it("reserves capacity for a new critical write by evicting one normal write", async () => {
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const normal = vi.fn(async () => {});
    const critical = vi.fn(async () => {});

    for (let i = 0; i < 50; i++) {
      coordinator.queue(context, normal);
    }
    expect(coordinator.queue(context, critical, { priority: "critical" })).toBe(true);
    await coordinator.flush(100);

    expect(critical).toHaveBeenCalledOnce();
    expect(normal).toHaveBeenCalledTimes(49);
  });

  it("never evicts an accepted critical write when the queue is full", async () => {
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const completed: number[] = [];

    for (let index = 0; index < 50; index += 1) {
      expect(coordinator.queue(context, async () => {
        completed.push(index);
      }, { priority: "critical" })).toBe(true);
    }

    expect(coordinator.queue(context, async () => {
      completed.push(50);
    }, { priority: "critical" })).toBe(false);
    await coordinator.flush(100);

    expect(completed).toEqual(Array.from({ length: 50 }, (_, index) => index));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("preserving accepted critical writes"));
  });

  it("retries only when a task explicitly opts in", async () => {
    const persistence = makePersistence();
    const retryDelay = vi.fn(async () => {});
    const coordinator = new RoomPersistenceCoordinator(persistence, vi.fn(), retryDelay);
    const task = vi.fn().mockRejectedValueOnce(new Error("temporary")).mockResolvedValue(undefined);

    coordinator.queue(context, task, { maxAttempts: 2 });
    await coordinator.flush(100);

    expect(task).toHaveBeenCalledTimes(2);
    expect(retryDelay).toHaveBeenCalledWith(1);
  });

  it("exposes stable game and event idempotency keys across retry attempts", async () => {
    const persistence = makePersistence();
    vi.mocked(persistence.ensureGame)
      .mockRejectedValueOnce(new Error("commit result was lost"))
      .mockResolvedValue("game-1");
    const retryDelay = vi.fn(async () => {});
    const coordinator = new RoomPersistenceCoordinator(persistence, vi.fn(), retryDelay);
    const observedKeys: Array<{ game: string; event: string }> = [];

    expect(coordinator.queue(
      { ...context, roomIdempotencyKey: "room-instance-1" },
      async ({ ensureGame, idempotencyKeys }) => {
        if (!idempotencyKeys) {
          throw new Error("Coordinator did not expose idempotency keys.");
        }
        observedKeys.push({
          game: idempotencyKeys.game,
          event: idempotencyKeys.event("public-event"),
        });
        await ensureGame();
      },
      { maxAttempts: 2 },
    )).toBe(true);

    await expect(coordinator.flush(100)).resolves.toBe(true);

    expect(observedKeys).toEqual([
      {
        game: "room-instance-1",
        event: expect.any(String),
      },
      {
        game: "room-instance-1",
        event: expect.any(String),
      },
    ]);
    expect(observedKeys[0]?.event).toBe(observedKeys[1]?.event);
    expect(observedKeys[0]?.event).not.toBe(observedKeys[0]?.game);
    expect(persistence.ensureGame).toHaveBeenNthCalledWith(1, expect.objectContaining({
      idempotencyKey: "room-instance-1",
    }));
    expect(persistence.ensureGame).toHaveBeenNthCalledWith(2, expect.objectContaining({
      idempotencyKey: "room-instance-1",
    }));
  });

  it("retries critical writes three times by default and then stops", async () => {
    const persistence = makePersistence();
    const retryDelay = vi.fn(async () => {});
    const coordinator = new RoomPersistenceCoordinator(persistence, vi.fn(), retryDelay);
    const task = vi.fn().mockRejectedValue(new Error("temporary"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    coordinator.queue(context, task, { priority: "critical" });
    await coordinator.flush(100);

    expect(task).toHaveBeenCalledTimes(3);
    expect(retryDelay).toHaveBeenNthCalledWith(1, 1);
    expect(retryDelay).toHaveBeenNthCalledWith(2, 2);
  });

  it("caps explicitly requested retries", async () => {
    const persistence = makePersistence();
    const retryDelay = vi.fn(async () => {});
    const coordinator = new RoomPersistenceCoordinator(persistence, vi.fn(), retryDelay);
    const task = vi.fn().mockRejectedValue(new Error("temporary"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    coordinator.queue(context, task, { priority: "critical", maxAttempts: 100 });
    await coordinator.flush(100);

    expect(task).toHaveBeenCalledTimes(5);
    expect(retryDelay).toHaveBeenCalledTimes(4);
  });

  it("reserves one queue slot for critical terminal work and rejects a duplicate", async () => {
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const regularCritical = vi.fn(async () => {});
    const terminal = vi.fn(async () => {});

    for (let index = 0; index < 50; index += 1) {
      expect(coordinator.queue(context, regularCritical, { priority: "critical" })).toBe(true);
    }

    expect(coordinator.queue(context, terminal, {
      priority: "critical",
      terminal: true,
    })).toBe(true);
    expect(coordinator.queue(context, terminal, {
      priority: "critical",
      terminal: true,
    })).toBe(false);

    await expect(coordinator.flush(100)).resolves.toBe(true);
    expect(terminal).toHaveBeenCalledOnce();
  });

  it("keeps accepted critical work ahead of later terminal work", async () => {
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence);
    const order: string[] = [];

    expect(coordinator.queue(context, async () => {
      order.push("game-start");
    }, { priority: "critical" })).toBe(true);
    expect(coordinator.queue(context, async () => {
      order.push("game-finish");
    }, { priority: "critical", terminal: true })).toBe(true);

    await coordinator.flush(100);

    expect(order).toEqual(["game-start", "game-finish"]);
  });

  it("stops retrying accepted terminal work at its max attempts", async () => {
    const persistence = makePersistence();
    const retryDelay = vi.fn(async () => {});
    const captureException = vi.fn();
    const coordinator = new RoomPersistenceCoordinator(persistence, captureException, retryDelay);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const terminal = vi.fn()
      .mockRejectedValueOnce(new Error("temporary-1"))
      .mockRejectedValueOnce(new Error("temporary-2"))
      .mockRejectedValueOnce(new Error("temporary-3"))
      .mockResolvedValue(undefined);

    expect(coordinator.queue(context, terminal, {
      priority: "critical",
      terminal: true,
      maxAttempts: 2,
    })).toBe(true);

    await expect(coordinator.flush(100)).resolves.toBe(true);
    expect(terminal).toHaveBeenCalledTimes(2);
    expect(retryDelay).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith("[game-persistence]", expect.any(Error));
    consoleError.mockRestore();
  });

  it("does not include the raw room code in timeout telemetry", async () => {
    vi.stubEnv("SENTRY_DSN", "https://public@example.invalid/1");
    const persistence = makePersistence();
    const captureException = vi.fn();
    const coordinator = new RoomPersistenceCoordinator(persistence, captureException);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    coordinator.queue(context, async ({ ensureGame }) => {
      await ensureGame();
      await blocked;
    });

    await expect(coordinator.flush(1)).resolves.toBe(false);
    const captured = captureException.mock.calls[0]?.[0] as Error;
    expect(captured.message).not.toContain(context.code);
    release();
    await coordinator.flush(100);
  });

  it("reports when a flush deadline expires without discarding the write", async () => {
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });

    coordinator.queue(context, async () => blocked);

    await expect(coordinator.flush(1)).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      "[game-persistence]",
      expect.objectContaining({
        name: "ProjectedMonitoringError",
        operation: "room-persistence-flush",
        code: "UNKNOWN",
        correlationId: expect.any(String),
        roomIdentifier: "[GameRoom [ПРЕМАХНАТО]]",
      }),
    );
    release();
    await expect(coordinator.flush(100)).resolves.toBe(true);
  });

  it("stops accepting and draining queued mutations after a disposal timeout", async () => {
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let release!: () => void;
    let markStarted!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const queuedMutation = vi.fn(async () => {});

    expect(coordinator.queue(context, async () => {
      markStarted();
      await blocked;
    })).toBe(true);
    expect(coordinator.queue(context, queuedMutation)).toBe(true);
    await started;

    await expect(coordinator.dispose(1)).resolves.toBe(false);
    expect(coordinator.queue(context, queuedMutation)).toBe(false);

    release();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(queuedMutation).not.toHaveBeenCalled();
  });

  it("fences repository calls when an active task resumes after a disposal timeout", async () => {
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let release!: () => void;
    let markStarted!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });

    expect(coordinator.queue(context, async ({ persistence: taskPersistence }) => {
      markStarted();
      await blocked;
      await taskPersistence.recordEvent("game-1", {
        round: 1,
        phase: "day",
        type: "late_mutation",
      });
    })).toBe(true);
    await started;

    await expect(coordinator.dispose(1)).resolves.toBe(false);
    release();
    await coordinator.flush(100);

    expect(persistence.recordEvent).not.toHaveBeenCalled();
  });

  it("projects Drizzle errors before sending them to Sentry or console", async () => {
    vi.stubEnv("SENTRY_DSN", "https://public@example.invalid/1");
    const captureException = vi.fn();
    const postgresCause = Object.assign(new Error("duplicate private event"), { code: "23505" });
    const error = new DrizzleQueryError(
      "insert into game_events (actor_id, payload) values ($1, $2)",
      [
        "player-17",
        '{"role":"seer","message":"private words","token":"session-token","email":"night@example.com"}',
      ],
      postgresCause,
    );
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence, captureException);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    coordinator.queue(context, async () => {
      throw error;
    });
    await coordinator.flush(100);

    expect(captureException).toHaveBeenCalledOnce();
    const captured = captureException.mock.calls[0]?.[0] as Error & Record<string, unknown>;
    const logged = consoleError.mock.calls[0]?.[1] as Error & Record<string, unknown>;

    expect(captured).not.toBe(error);
    expect(logged).toBe(captured);
    expect(captured).toMatchObject({
      name: "ProjectedMonitoringError",
      operation: "room-persistence-task",
      code: "23505",
      correlationId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
      roomIdentifier: "[GameRoom [ПРЕМАХНАТО]]",
    });

    const serialized = JSON.stringify({
      message: captured.message,
      stack: captured.stack,
      operation: captured.operation,
      code: captured.code,
      correlationId: captured.correlationId,
      roomIdentifier: captured.roomIdentifier,
    });
    for (const sensitiveValue of [
      "insert into game_events",
      "player-17",
      "seer",
      "private words",
      "session-token",
      "night@example.com",
    ]) {
      expect(serialized).not.toContain(sensitiveValue);
    }
  });
});
