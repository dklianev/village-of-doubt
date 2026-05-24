import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameConfig } from "@werewolf/shared";
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
  };
}

const context = {
  code: "ROOM01",
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

  it("is a no-op when persistence is disabled", async () => {
    const persistence = makePersistence(false);
    const coordinator = new RoomPersistenceCoordinator(persistence);
    const task = vi.fn();

    coordinator.queue(context, task);
    await coordinator.flush(100);

    expect(task).not.toHaveBeenCalled();
    expect(persistence.ensureGame).not.toHaveBeenCalled();
  });

  it("drops writes above the pending queue budget", async () => {
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    for (let i = 0; i < 51; i++) {
      coordinator.queue(context, async () => {});
    }
    await coordinator.flush(100);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("persistQueue backpressure"));
  });

  it("captures persistence errors when Sentry is configured", async () => {
    vi.stubEnv("SENTRY_DSN", "https://public@example.invalid/1");
    const captureException = vi.fn();
    const error = new Error("write failed");
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence, captureException);
    vi.spyOn(console, "error").mockImplementation(() => {});

    coordinator.queue(context, async () => {
      throw error;
    });
    await coordinator.flush(100);

    expect(captureException).toHaveBeenCalledWith(error);
  });
});
