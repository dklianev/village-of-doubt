import { describe, expect, it, vi } from "vitest";
import { gameEvents, gamePlayers, games, user, type Database } from "@werewolf/database";
import {
  checkGamePersistenceReadiness,
  collectStructuredPayloadUserIds,
  DrizzleGamePersistence,
  scrubPersistedEventPayload,
} from "./game-persistence.js";

describe("DrizzleGamePersistence", () => {
  it("scrubs secret fields inherited from a deleted identity map key", () => {
    const deletedIdentityMap = new Map([["deleted-player", "deleted_anon"]]);
    const payload = {
      assignments: {
        "deleted-player": { role: "seer", displayName: "Тайно име" },
        "active-player": { role: "werewolf", displayName: "Активен" },
      },
    };

    expect(scrubPersistedEventPayload(payload, deletedIdentityMap)).toEqual({
      assignments: {
        deleted_anon: { displayName: "Изтрит играч" },
        "active-player": { role: "werewolf", displayName: "Активен" },
      },
    });
    expect(collectStructuredPayloadUserIds(payload, new Set(["deleted-player", "active-player"])))
      .toEqual(["deleted-player", "active-player"]);
    expect(collectStructuredPayloadUserIds(
      { metadata: { role: "seer", message: "Системно съобщение" } },
      new Set(["role", "message"]),
    )).toEqual([]);
    expect(scrubPersistedEventPayload(
      { metadata: { role: "seer", message: "Системно съобщение" } },
      new Map([["role", "anonymous-role"]]),
    )).toEqual({ metadata: { role: "seer", message: "Системно съобщение" } });
  });

  it("reuses the same game row when a committed insert throws before acknowledgement", async () => {
    const committedGames = new Map<string, Record<string, unknown>>();
    const attemptedGames: Record<string, unknown>[] = [];
    let throwAfterFirstCommit = true;
    const returning = vi.fn(async () => {
      const values = attemptedGames.at(-1)!;
      const id = values.id as string;
      if (committedGames.has(id)) {
        return [];
      }

      committedGames.set(id, values);
      if (throwAfterFirstCommit) {
        throwAfterFirstCommit = false;
        throw new Error("connection lost after commit");
      }
      return [{ id }];
    });
    const onConflictDoNothing = vi.fn(() => ({ returning }));
    const insertValues = vi.fn((values: Record<string, unknown>) => {
      attemptedGames.push(values);
      return { onConflictDoNothing };
    });
    const insert = vi.fn((table: unknown) => {
      if (table !== games) {
        throw new Error("Unexpected table in game idempotency test");
      }
      return { values: insertValues };
    });
    const persistence = new DrizzleGamePersistence({ insert } as unknown as Database);
    const input = {
      code: "IDEM01",
      hostId: "invalid host",
      config: {
        mode: "werewolves_classic",
        roomVisibility: "public",
        rulesetVersion: "test",
      } as never,
      idempotencyKey: "room-instance-1",
    };

    await expect(persistence.ensureGame(input)).rejects.toThrow("connection lost after commit");
    const gameId = await persistence.ensureGame(input);

    expect(gameId).toBe([...committedGames.keys()][0]);
    expect(committedGames.size).toBe(1);
    expect(attemptedGames[0]).toMatchObject({ id: gameId, roomVisibility: "public" });
    expect(attemptedGames[1]).toMatchObject({ id: gameId, roomVisibility: "public" });
  });

  it("deduplicates an event retry when the first insert committed and then threw", async () => {
    const committedEvents = new Map<string, Record<string, unknown>>();
    const attemptedEvents: Record<string, unknown>[] = [];
    let throwAfterFirstCommit = true;
    const onConflictDoNothing = vi.fn(async () => {
      const values = attemptedEvents.at(-1)!;
      const id = values.id as string;
      if (!committedEvents.has(id)) {
        committedEvents.set(id, values);
        if (throwAfterFirstCommit) {
          throwAfterFirstCommit = false;
          throw new Error("connection lost after commit");
        }
      }
    });
    const insertValues = vi.fn((values: Record<string, unknown>) => {
      attemptedEvents.push(values);
      return { onConflictDoNothing };
    });
    const insert = vi.fn((table: unknown) => {
      if (table !== gameEvents) {
        throw new Error("Unexpected table in event idempotency test");
      }
      return { values: insertValues };
    });
    const persistence = new DrizzleGamePersistence({ insert } as unknown as Database);
    const event = {
      round: 2,
      phase: "night" as const,
      type: "night_action_submitted",
      idempotencyKey: "room-instance-1:event:7",
      occurredAt: new Date("2026-07-20T12:34:56.789Z"),
    };

    await expect(persistence.recordEvent("11111111-1111-4111-8111-111111111111", event))
      .rejects.toThrow("connection lost after commit");
    await persistence.recordEvent("11111111-1111-4111-8111-111111111111", event);

    expect(committedEvents.size).toBe(1);
    expect(attemptedEvents[0]).toMatchObject({
      id: attemptedEvents[1]?.id,
      createdAt: new Date("2026-07-20T12:34:56.789Z"),
    });
  });

  it("never synthesizes or references event users outside the captured room participants", async () => {
    const insertedUsers: Array<{ id: string }> = [];
    let insertedEvent: Record<string, unknown> | undefined;
    const onConflictDoNothing = vi.fn(async () => {});
    const insert = vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        if (table === user) {
          insertedUsers.push(...(values as Array<{ id: string }>));
          return { onConflictDoNothing };
        }
        if (table === gameEvents) {
          insertedEvent = values as Record<string, unknown>;
          return Promise.resolve();
        }
        throw new Error("Unexpected table in persistence test");
      }),
    }));
    const where = vi.fn(async () => []);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const execute = vi.fn(async () => undefined);
    const transaction = vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
      operation({ execute, insert, select }));
    const persistence = new DrizzleGamePersistence({ insert, transaction } as unknown as Database);

    await persistence.recordEvent("game-1", {
      round: 2,
      phase: "night",
      type: "night_action_submitted",
      actorId: "actor-1",
      targetId: "outside-room-user",
      participantUserIds: ["actor-1", "target-1"],
    });

    expect(insertedUsers.map((item) => item.id)).toEqual(["actor-1"]);
    expect(insertedEvent).toMatchObject({
      actorId: "actor-1",
      targetId: null,
    });
    expect(insertedEvent).not.toHaveProperty("participantUserIds");
    expect(insertedUsers).not.toContainEqual(expect.objectContaining({ id: "outside-room-user" }));
    expect(transaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
  });

  it("remaps a tombstoned participant inside the atomic user upsert", async () => {
    const insertedUsers: Array<{ id: string; name: string }> = [];
    let insertedEvent: Record<string, unknown> | undefined;
    const insert = vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        if (table === user) {
          insertedUsers.push(...(values as Array<{ id: string; name: string }>));
          return { onConflictDoNothing: vi.fn(async () => undefined) };
        }
        if (table === gameEvents) {
          insertedEvent = values as Record<string, unknown>;
          return Promise.resolve();
        }
        throw new Error("Unexpected table in persistence test");
      }),
    }));
    const transaction = vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
      operation({
        execute: vi.fn(async () => undefined),
        insert,
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => [{
              originalUserId: "deleted-player",
              anonymousUserId: "deleted_anon",
            }]),
          })),
        })),
      }));
    const persistence = new DrizzleGamePersistence({ insert, transaction } as unknown as Database);

    await persistence.recordEvent("game-1", {
      round: 3,
      phase: "day",
      type: "vote_cast",
      actorId: "deleted-player",
      participantUserIds: ["deleted-player"],
    });

    expect(insertedUsers).toEqual([
      expect.objectContaining({
        id: "deleted_anon",
        name: "Изтрит играч",
        email: "deleted_anon@deleted.invalid",
      }),
    ]);
    expect(insertedEvent).toMatchObject({
      actorId: "deleted_anon",
      targetId: null,
    });
    expect(insertedUsers).not.toContainEqual(expect.objectContaining({ id: "deleted-player" }));
  });

  it("scrubs delayed structured payload identities without rewriting free text", async () => {
    let insertedEvent: Record<string, unknown> | undefined;
    const insert = vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        if (table === user) {
          return { onConflictDoNothing: vi.fn(async () => undefined) };
        }
        if (table === gameEvents) {
          insertedEvent = values as Record<string, unknown>;
          return Promise.resolve();
        }
        throw new Error("Unexpected table in payload privacy test");
      }),
    }));
    const transaction = vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
      operation({
        execute: vi.fn(async () => undefined),
        insert,
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => [{
              originalUserId: "deleted-player",
              anonymousUserId: "deleted_anon",
            }]),
          })),
        })),
      }));
    const persistence = new DrizzleGamePersistence({ insert, transaction } as unknown as Database);

    await persistence.recordEvent("game-1", {
      round: 1,
      phase: "role_reveal",
      type: "game_started",
      actorId: "deleted-player",
      participantUserIds: ["deleted-player", "active-player"],
      payload: {
        assignments: [
          { playerId: "deleted-player", displayName: "Тайно име", role: "seer" },
          { playerId: "active-player", displayName: "Активен", role: "werewolf" },
        ],
        lovers: {
          firstUserId: "deleted-player",
          firstName: "Тайно име",
          secondUserId: "active-player",
          secondName: "Активен",
        },
        previousHostUserId: "deleted-player",
        note: "Тайно име напусна като deleted-player.",
      },
    });

    expect(insertedEvent).toMatchObject({
      actorId: "deleted_anon",
      payload: {
        assignments: [
          { playerId: "deleted_anon", displayName: "Изтрит играч" },
          { playerId: "active-player", displayName: "Активен", role: "werewolf" },
        ],
        lovers: {
          firstUserId: "deleted_anon",
          firstName: "Изтрит играч",
          secondUserId: "active-player",
          secondName: "Активен",
        },
        previousHostUserId: "deleted_anon",
        note: "Тайно име напусна като deleted-player.",
      },
    });
    expect((insertedEvent?.payload as { assignments: Array<Record<string, unknown>> }).assignments[0])
      .not.toHaveProperty("role");
  });

  it("persists the final won flag when player rows are upserted", async () => {
    let playerValues: Array<Record<string, unknown>> | undefined;
    const onConflictDoUpdate = vi.fn(async () => undefined);
    const insert = vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        if (table === user) {
          return { onConflictDoNothing: vi.fn(async () => undefined) };
        }
        if (table === gamePlayers) {
          playerValues = values as Array<Record<string, unknown>>;
          return { onConflictDoUpdate };
        }
        throw new Error("Unexpected table in final outcome test");
      }),
    }));
    const transaction = vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
      operation({
        execute: vi.fn(async () => undefined),
        insert,
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
      }));
    const persistence = new DrizzleGamePersistence({ insert, transaction } as unknown as Database);

    await persistence.upsertPlayers("game-1", [{
      userId: "winner-1",
      displayName: "Победител",
      role: "jester",
      isAlive: false,
      won: true,
      deathRound: 4,
      deathCause: "Падна при разискването.",
    }]);

    expect(playerValues).toEqual([expect.objectContaining({
      won: true,
      role: "jester",
      isAlive: false,
      deathRound: 4,
      deathCause: "Падна при разискването.",
    })]);
    expect(onConflictDoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      set: expect.objectContaining({
        won: expect.anything(),
        role: expect.anything(),
        isAlive: expect.anything(),
        deathRound: expect.anything(),
        deathCause: expect.anything(),
      }),
    }));
  });

  it("upserts multiple player rows in one database write", async () => {
    const playerValueBatches: unknown[] = [];
    const onConflictDoUpdate = vi.fn(async () => undefined);
    const insert = vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        if (table === user) {
          return { onConflictDoNothing: vi.fn(async () => undefined) };
        }
        if (table === gamePlayers) {
          playerValueBatches.push(values);
          return { onConflictDoUpdate };
        }
        throw new Error("Unexpected table in batched player upsert test");
      }),
    }));
    const transaction = vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
      operation({
        execute: vi.fn(async () => undefined),
        insert,
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
      }));
    const persistence = new DrizzleGamePersistence({ insert, transaction } as unknown as Database);

    await persistence.upsertPlayers("game-1", [
      {
        userId: "player-1",
        displayName: "Първи",
        role: "werewolf",
        isAlive: true,
        isLover: true,
        loverUserId: "player-2",
      },
      {
        userId: "player-2",
        displayName: "Втори",
        role: "seer",
        isAlive: false,
        won: true,
        deathRound: 3,
        deathCause: "Отстранен при гласуване.",
      },
    ]);

    expect(playerValueBatches).toEqual([[
      {
        gameId: "game-1",
        userId: "player-1",
        displayName: "Първи",
        role: "werewolf",
        isAlive: true,
        isLover: true,
        loverUserId: "player-2",
        won: false,
        deathRound: null,
        deathCause: null,
      },
      {
        gameId: "game-1",
        userId: "player-2",
        displayName: "Втори",
        role: "seer",
        isAlive: false,
        isLover: false,
        loverUserId: null,
        won: true,
        deathRound: 3,
        deathCause: "Отстранен при гласуване.",
      },
    ]]);
    expect(onConflictDoUpdate).toHaveBeenCalledOnce();
  });

  it("preserves deleted identity remapping inside the player batch", async () => {
    let playerValues: Array<Record<string, unknown>> | undefined;
    const onConflictDoUpdate = vi.fn(async () => undefined);
    const insert = vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        if (table === user) {
          return { onConflictDoNothing: vi.fn(async () => undefined) };
        }
        if (table === gamePlayers) {
          playerValues = values as Array<Record<string, unknown>>;
          return { onConflictDoUpdate };
        }
        throw new Error("Unexpected table in deleted player batch test");
      }),
    }));
    const transaction = vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
      operation({
        execute: vi.fn(async () => undefined),
        insert,
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(async () => [{
              originalUserId: "deleted-player",
              anonymousUserId: "deleted_anon",
            }]),
          })),
        })),
      }));
    const persistence = new DrizzleGamePersistence({ insert, transaction } as unknown as Database);

    await persistence.upsertPlayers("game-1", [
      {
        userId: "deleted-player",
        displayName: "Старо име",
        role: "seer",
        isAlive: false,
        isLover: true,
        loverUserId: "active-player",
      },
      {
        userId: "active-player",
        displayName: "Активен",
        role: "werewolf",
        isAlive: true,
        isLover: true,
        loverUserId: "deleted-player",
      },
    ]);

    expect(playerValues).toEqual([
      expect.objectContaining({
        userId: "deleted_anon",
        displayName: "Изтрит играч",
        loverUserId: "active-player",
      }),
      expect.objectContaining({
        userId: "active-player",
        displayName: "Активен",
        loverUserId: "deleted_anon",
      }),
    ]);
    expect(onConflictDoUpdate).toHaveBeenCalledOnce();
  });
});

describe("game persistence readiness", () => {
  it("allows the intentional no-database development fallback", async () => {
    await expect(checkGamePersistenceReadiness({
      nodeEnv: "development",
      databaseUrl: "",
    })).resolves.toBe(true);
  });

  it("requires persistence configuration in production", async () => {
    await expect(checkGamePersistenceReadiness({
      nodeEnv: "production",
      databaseUrl: "",
    })).resolves.toBe(false);
  });

  it("reports the database probe result", async () => {
    const database = {} as Database;
    const createDatabaseClient = vi.fn(() => database);
    const probeDatabase = vi.fn(async () => true);

    await expect(checkGamePersistenceReadiness({
      nodeEnv: "production",
      databaseUrl: "postgres://configured",
      createDatabaseClient,
      probeDatabase,
    })).resolves.toBe(true);
    expect(createDatabaseClient).toHaveBeenCalledWith("postgres://configured");
    expect(probeDatabase).toHaveBeenCalledWith(database);
  });

  it("turns database client failures into an unavailable result", async () => {
    await expect(checkGamePersistenceReadiness({
      nodeEnv: "production",
      databaseUrl: "postgres://configured",
      createDatabaseClient: () => {
        throw new Error("driver details");
      },
    })).resolves.toBe(false);
  });
});
