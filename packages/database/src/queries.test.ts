import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import * as databaseQueries from "./queries.js";
import type { Database } from "./client.js";
import {
  deletedUserIdentities,
  gameEvents,
  gamePlayers,
  games,
  user,
  userAchievements,
  verification,
} from "./schema.js";
import {
  deleteUserAccountAtomically,
  getDeletedUserIdentityMap,
  getGameHistoryForUser,
  getGameHistoryById,
  getGameReplayParticipants,
  getGameTimeline,
  getRecentEndedGameHistory,
  getLeaderboardRows,
  getPlayerOutcomesInGames,
  getPublicGameTimelinesBatch,
  scrubDeletedIdentityFromEventPayload,
  upsertUsersUnlessDeleted,
} from "./queries.js";

describe("getRecentEndedGameHistory", () => {
  it("filters and orders completed games at the SQL boundary", async () => {
    let whereSql = "";
    let whereParams: unknown[] = [];
    let orderSql = "";
    const limit = vi.fn(async () => []);
    const orderBy = vi.fn((...clauses) => {
      orderSql = clauses
        .map((clause) => new PgDialect().sqlToQuery(clause).sql)
        .join(" ");
      return { limit };
    });
    const where = vi.fn((condition) => {
      const query = new PgDialect().sqlToQuery(condition);
      whereSql = query.sql;
      whereParams = query.params;
      return { orderBy };
    });
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    await getRecentEndedGameHistory({ select } as unknown as Database, 20);

    expect(whereSql).toContain('"games"."status"');
    expect(whereSql).toContain('"games"."room_visibility"');
    expect(whereParams).toContain("ended");
    expect(whereParams).toContain("public");
    expect(orderSql).toContain('"games"."ended_at" desc');
    expect(limit).toHaveBeenCalledWith(20);
  });
});

describe("getGameHistoryById", () => {
  it("queries only completed games so live private events cannot be replayed", async () => {
    let whereSql = "";
    let whereParams: unknown[] = [];
    const limit = vi.fn(async () => []);
    const where = vi.fn((condition) => {
      const query = new PgDialect().sqlToQuery(condition);
      whereSql = query.sql;
      whereParams = query.params;
      return { limit };
    });
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    await getGameHistoryById({ select } as unknown as Database, "game-live");

    expect(whereSql).toContain('"games"."id"');
    expect(whereSql).toContain('"games"."status"');
    expect(whereSql.toLowerCase()).toContain("and");
    expect(whereParams).toContain("ended");
    expect(limit).toHaveBeenCalledWith(1);
  });
});

describe("getGameHistoryForUser", () => {
  it("orders the complete user history before applying the result limit", async () => {
    let whereSql = "";
    let orderSql = "";
    const limit = vi.fn(async () => []);
    const orderBy = vi.fn((...clauses) => {
      orderSql = clauses
        .map((clause) => new PgDialect().sqlToQuery(clause).sql)
        .join(" ");
      return { limit };
    });
    const where = vi.fn((condition) => {
      whereSql = new PgDialect().sqlToQuery(condition).sql;
      return { orderBy };
    });
    const leftJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ leftJoin }));
    const select = vi.fn(() => ({ from }));

    await getGameHistoryForUser({ select } as unknown as Database, "user-1", 25);

    expect(whereSql).toContain('"games"."host_id"');
    expect(whereSql).toContain('"game_players"."user_id"');
    expect(orderSql).toContain('"games"."created_at" desc');
    expect(orderSql).toContain('"games"."id" desc');
    expect(limit).toHaveBeenCalledWith(25);
  });
});

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createIdentityRaceDatabase() {
  const users = new Set(["user-1"]);
  const tombstones = new Map<string, string>();
  const firstLockAcquired = createDeferred();
  const releaseFirstLock = createDeferred();
  const secondLockWaiting = createDeferred();
  let lockTail: Promise<void> | undefined;
  let lockCount = 0;

  const transaction = vi.fn(async (operation: (tx: unknown) => Promise<unknown>) => {
    const releases: Array<() => void> = [];
    const execute = vi.fn(async () => {
      const previousLock = lockTail;
      let releaseLock!: () => void;
      const currentLock = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      lockTail = currentLock;

      if (previousLock) {
        secondLockWaiting.resolve();
        await previousLock;
      }
      releases.push(releaseLock);
      lockCount += 1;
      if (lockCount === 1) {
        firstLockAcquired.resolve();
        await releaseFirstLock.promise;
      }
    });
    const select = vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => {
          if (table === user) {
            return {
              limit: vi.fn(() => {
                const rows = users.has("user-1") ? [{ id: "user-1" }] : [];
                const result = Promise.resolve(rows) as Promise<unknown[]> & {
                  for: () => Promise<unknown[]>;
                };
                result.for = vi.fn(async () => rows);
                return result;
              }),
            };
          }

          const rows = [...tombstones].map(([originalUserId, anonymousUserId]) => ({
            originalUserId,
            anonymousUserId,
          }));
          const result = Promise.resolve(rows) as Promise<typeof rows> & {
            limit: (limit: number) => Promise<typeof rows>;
          };
          result.limit = vi.fn(async (limit: number) => rows.slice(0, limit));
          return result;
        }),
      })),
    }));
    const insert = vi.fn((table: unknown) => ({
      values: vi.fn((input: unknown) => ({
        onConflictDoNothing: vi.fn(() => {
          const returned: Array<{ anonymousUserId: string }> = [];
          const action = Promise.resolve().then(() => {
            const rows = Array.isArray(input) ? input : [input];
            for (const value of rows as Array<Record<string, unknown>>) {
              if (table === user) {
                users.add(String(value.id));
              } else if (table === deletedUserIdentities) {
                const originalUserId = String(value.originalUserId);
                const anonymousUserId = String(value.anonymousUserId);
                if (!tombstones.has(originalUserId)) {
                  tombstones.set(originalUserId, anonymousUserId);
                  returned.push({ anonymousUserId });
                }
              }
            }
          });
          return Object.assign(action, {
            returning: async () => {
              await action;
              return returned;
            },
          });
        }),
      })),
    }));
    const update = vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    }));
    const deleteFrom = vi.fn((table: unknown) => ({
      where: vi.fn(() => {
        const returned: Array<{ id: string }> = [];
        const action = Promise.resolve().then(() => {
          if (table === user && users.delete("user-1")) {
            returned.push({ id: "user-1" });
          }
        });
        return Object.assign(action, {
          returning: async () => {
            await action;
            return returned;
          },
        });
      }),
    }));

    try {
      return await operation({ execute, select, insert, update, delete: deleteFrom });
    } finally {
      for (const release of releases.reverse()) {
        release();
      }
    }
  });

  return {
    db: { transaction } as unknown as Database,
    users,
    tombstones,
    firstLockAcquired: firstLockAcquired.promise,
    releaseFirstLock: releaseFirstLock.resolve,
    secondLockWaiting: secondLockWaiting.promise,
  };
}

describe("getPublicGameTimelinesBatch", () => {
  it("filters at the SQL boundary and returns only a minimal public DTO", async () => {
    const execute = vi.fn().mockImplementation((statement) => {
      const query = new PgDialect().sqlToQuery(statement);
      expect(query.sql).toContain("visibility = 'public'");

      return Promise.resolve([
        {
          id: "public-event",
          game_id: "game-1",
          round: 2,
          phase: "resolution",
          type: "death",
          visibility: "public",
          created_at: "2026-07-12T12:00:00.000Z",
          actor_id: "private-actor",
          target_id: "private-target",
          payload: { role: "seer" },
        },
        {
          id: "faction-event",
          game_id: "game-1",
          round: 2,
          phase: "night",
          type: "faction_kill",
          visibility: "faction",
          created_at: "2026-07-12T11:59:00.000Z",
          actor_id: "secret-actor",
          target_id: "secret-target",
          payload: { faction: "werewolves" },
        },
      ]);
    });

    const result = await getPublicGameTimelinesBatch({ execute } as unknown as Database, ["game-1"], 6);

    expect(result.get("game-1")).toEqual([
      {
        id: "public-event",
        round: 2,
        phase: "resolution",
        type: "death",
        createdAt: new Date("2026-07-12T12:00:00.000Z"),
      },
    ]);
    expect(result.get("game-1")?.[0]).not.toHaveProperty("visibility");
    expect(result.get("game-1")?.[0]).not.toHaveProperty("actorId");
    expect(result.get("game-1")?.[0]).not.toHaveProperty("targetId");
    expect(result.get("game-1")?.[0]).not.toHaveProperty("payload");
  });
});

describe("getDeletedUserIdentityMap", () => {
  it("resolves persisted pseudonyms for deleted active-room users", async () => {
    const where = vi.fn().mockResolvedValue([
      { originalUserId: "user-1", anonymousUserId: "deleted_a1" },
      { originalUserId: "user-2", anonymousUserId: "deleted_b2" },
    ]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    const result = await getDeletedUserIdentityMap(
      { select } as unknown as Database,
      ["user-1", "user-2", "user-1"],
    );

    expect(result).toEqual(new Map([
      ["user-1", "deleted_a1"],
      ["user-2", "deleted_b2"],
    ]));
    expect(select).toHaveBeenCalledOnce();
  });
});

describe("persisted player outcomes", () => {
  it("loads role and authoritative won state for account statistics", async () => {
    const where = vi.fn(async () => [
      { gameId: "game-1", role: "jester", won: true },
      { gameId: "game-2", role: "seer", won: false },
    ]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    const result = await getPlayerOutcomesInGames(
      { select } as unknown as Database,
      "user-1",
      ["game-1", "game-2"],
    );

    expect(result).toEqual(new Map([
      ["game-1", { role: "jester", won: true }],
      ["game-2", { role: "seer", won: false }],
    ]));
  });

  it("counts leaderboard wins from game_players.won instead of role/team inference", async () => {
    let selectedFields: Record<string, unknown> | undefined;
    const innerJoinUser = vi.fn(() => ({ where: vi.fn(() => ({ groupBy: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) })) }));
    const innerJoinGames = vi.fn(() => ({ innerJoin: innerJoinUser }));
    const from = vi.fn(() => ({ innerJoin: innerJoinGames }));
    const select = vi.fn((fields: Record<string, unknown>) => {
      selectedFields = fields;
      return { from };
    });

    await getLeaderboardRows({ select } as unknown as Database);

    const gamesPlayedSql = new PgDialect().sqlToQuery(selectedFields?.gamesPlayed as never).sql;
    const winsSql = new PgDialect().sqlToQuery(selectedFields?.wins as never).sql;
    expect(selectedFields?.displayName).toBe(user.name);
    expect(innerJoinGames).toHaveBeenCalledWith(games, expect.anything());
    expect(innerJoinUser).toHaveBeenCalledWith(user, expect.anything());
    expect(gamesPlayedSql).toContain("COUNT(*)");
    expect(gamesPlayedSql.toLowerCase()).not.toContain("distinct");
    expect(winsSql).toContain('"game_players"."won"');
    expect(winsSql).not.toContain('"game_players"."role"');
    expect(winsSql).not.toContain('"games"."winner_team"');
  });

  it("uses the current profile name instead of a lexicographic historical maximum", async () => {
    let selectedFields: Record<string, unknown> | undefined;
    const limit = vi.fn(async () => []);
    const orderBy = vi.fn(() => ({ limit }));
    const groupBy = vi.fn(() => ({ orderBy }));
    const where = vi.fn(() => ({ groupBy }));
    const innerJoinUser = vi.fn(() => ({ where }));
    const innerJoinGames = vi.fn(() => ({ innerJoin: innerJoinUser }));
    const from = vi.fn(() => ({ innerJoin: innerJoinGames }));
    const select = vi.fn((fields: Record<string, unknown>) => {
      selectedFields = fields;
      return { from };
    });

    await getLeaderboardRows({ select } as unknown as Database);

    expect(selectedFields?.displayName).toBe(user.name);
    expect(groupBy).toHaveBeenCalledWith(gamePlayers.userId, user.name);
  });

  it("limits the public leaderboard to games ended inside the requested period", async () => {
    let whereStatement: unknown;
    const limit = vi.fn(async () => []);
    const orderBy = vi.fn(() => ({ limit }));
    const groupBy = vi.fn(() => ({ orderBy }));
    const where = vi.fn((statement: unknown) => {
      whereStatement = statement;
      return { groupBy };
    });
    const innerJoinUser = vi.fn(() => ({ where }));
    const innerJoinGames = vi.fn(() => ({ innerJoin: innerJoinUser }));
    const from = vi.fn(() => ({ innerJoin: innerJoinGames }));
    const select = vi.fn(() => ({ from }));
    const since = new Date("2026-08-01T00:00:00.000Z");

    await getLeaderboardRows({ select } as unknown as Database, 30, { since });

    const query = new PgDialect().sqlToQuery(whereStatement as never);
    expect(query.sql).toContain('"games"."ended_at" >=');
    expect(query.params).toContain(since.toISOString());
    expect(query.sql).toContain('"games"."room_visibility" =');
    expect(query.params).toContain("public");
  });
});

describe("replay persistence", () => {
  it("caps replay timelines and supports chronological order", async () => {
    let orderStatement: unknown;
    const limit = vi.fn(async () => []);
    const orderBy = vi.fn((statement: unknown) => {
      orderStatement = statement;
      return { limit };
    });
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    await getGameTimeline({ select } as unknown as Database, "game-1", 5_000, {
      visibilityFilter: "all",
      order: "asc",
    });

    expect(orderBy).toHaveBeenCalledOnce();
    expect(new PgDialect().sqlToQuery(orderStatement as never).sql.toLowerCase()).toContain("asc");
    expect(limit).toHaveBeenCalledWith(1_000);
  });

  it("loads authoritative replay participants and hides roles for public viewers", async () => {
    const where = vi.fn(async () => [
      { userId: "user-1", displayName: "Анна" },
      { userId: "user-2", displayName: "Борис" },
    ]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    const rows = await getGameReplayParticipants(
      { select } as unknown as Database,
      "game-1",
      { includeRoles: false },
    );

    expect(rows).toEqual([
      { userId: "user-1", displayName: "Анна", role: null },
      { userId: "user-2", displayName: "Борис", role: null },
    ]);
  });
});

describe("deleteUserAccountAtomically", () => {
  it("анонимизира архивните връзки и изтрива auth user-а в една транзакция", async () => {
    const select = vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => queryResult(table === user ? [{ id: "user-1" }] : [])),
      })),
    }));
    const insertedTables: unknown[] = [];
    const insert = vi.fn((table: unknown) => {
      insertedTables.push(table);
      return {
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() =>
            table === deletedUserIdentities
              ? { returning: vi.fn(async () => [{ anonymousUserId: "deleted_anon" }]) }
              : Promise.resolve(),
          ),
        })),
      };
    });
    const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    const update = vi.fn((table: unknown) => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updates.push({ table, values });
        return { where: vi.fn(async () => undefined) };
      }),
    }));
    const verificationPredicates: string[] = [];
    const deleteFrom = vi.fn((table: unknown) => ({
      where: vi.fn((statement: unknown) => {
        if (table === verification) {
          verificationPredicates.push(
            new PgDialect().sqlToQuery(statement as Parameters<PgDialect["sqlToQuery"]>[0]).sql,
          );
        }
        return table === user
          ? { returning: vi.fn(async () => [{ id: "user-1" }]) }
          : Promise.resolve();
      }),
    }));
    const execute = vi.fn(async (statement: unknown) => {
      const query = new PgDialect().sqlToQuery(statement as Parameters<PgDialect["sqlToQuery"]>[0]);
      expect(query.sql).toContain("pg_advisory_xact_lock");
      expect(query.params).toEqual(["user-1"]);
    });
    const tx = { execute, select, insert, update, delete: deleteFrom };
    const transaction = vi.fn(async (operation: (transaction: typeof tx) => Promise<boolean>) => operation(tx));

    const deleted = await deleteUserAccountAtomically(
      { transaction } as unknown as Database,
      "user-1",
    );

    expect(deleted).toBe(true);
    expect(transaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(insertedTables).toContain(deletedUserIdentities);
    expect(insertedTables).toContain(user);
    expect(update).toHaveBeenCalledTimes(5);
    expect(updates).toContainEqual({
      table: gamePlayers,
      values: { loverUserId: "deleted_anon" },
    });
    expect(deleteFrom).toHaveBeenCalledWith(userAchievements);
    expect(deleteFrom).toHaveBeenCalledWith(verification);
    expect(verificationPredicates).toHaveLength(1);
    expect(verificationPredicates[0]).toContain('"identifier" = $1');
    expect(verificationPredicates[0]).toContain('"value" = $2');
    expect(verificationPredicates[0]?.toLowerCase()).not.toContain("like");
    expect(deleteFrom).toHaveBeenCalledWith(user);
  });

  it("не създава анонимна самоличност за несъществуващ user", async () => {
    const result = Promise.resolve([]) as unknown as Promise<unknown[]> & {
      for: () => Promise<unknown[]>;
    };
    result.for = vi.fn(async () => []);
    const tx = {
      execute: vi.fn(async () => undefined),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(() => result) })),
        })),
      })),
      insert: vi.fn(),
    };
    const transaction = vi.fn(async (operation: (transaction: typeof tx) => Promise<boolean>) => operation(tx));

    await expect(
      deleteUserAccountAtomically({ transaction } as unknown as Database, "missing-user"),
    ).resolves.toBe(false);
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("scrub-ва JSON payload identity и secret-role връзките в същата транзакция", async () => {
    const eventPayload = {
      assignments: [
        { userId: "user-1", displayName: "Анна", role: "seer" },
        { userId: "user-2", displayName: "Борис", role: "werewolf" },
      ],
      lovers: { firstUserId: "user-1", firstName: "Анна" },
      note: "Анна изпрати user-1",
      profileName: "Текуща Анна",
      role: "seer",
    };
    const rowsByTable = new Map<unknown, unknown[]>([
      [user, [{ id: "user-1", displayName: "Текуща Анна" }]],
      [deletedUserIdentities, [{ anonymousUserId: "deleted_anon" }]],
      [gamePlayers, [{ gameId: "game-1", displayName: "Анна" }]],
      [games, [{ id: "hosted-game" }]],
      [gameEvents, [{
        id: "event-1",
        actorId: "user-1",
        targetId: null,
        payload: eventPayload,
      }]],
    ]);
    const eventPredicates: Array<{ sql: string; params: unknown[] }> = [];
    const select = vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn((statement: unknown) => {
          if (table === gameEvents) {
            eventPredicates.push(
              new PgDialect().sqlToQuery(statement as Parameters<PgDialect["sqlToQuery"]>[0]),
            );
          }
          return queryResult(rowsByTable.get(table) ?? []);
        }),
      })),
    }));
    const update = vi.fn((table: unknown) => ({
      set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    }));
    const insert = vi.fn(() => ({
      values: vi.fn(() => ({ onConflictDoNothing: vi.fn(async () => undefined) })),
    }));
    const deleteFrom = vi.fn((table: unknown) => ({
      where: vi.fn(() => table === user
        ? { returning: vi.fn(async () => [{ id: "user-1" }]) }
        : Promise.resolve()),
    }));
    const executedQueries: Array<{ sql: string; params: unknown[] }> = [];
    const tx = {
      execute: vi.fn(async (statement: unknown) => {
        executedQueries.push(
          new PgDialect().sqlToQuery(
            statement as Parameters<PgDialect["sqlToQuery"]>[0],
          ),
        );
      }),
      select,
      insert,
      update,
      delete: deleteFrom,
    };
    const transaction = vi.fn(async (operation: (transaction: typeof tx) => Promise<boolean>) => operation(tx));

    await expect(
      deleteUserAccountAtomically({ transaction } as unknown as Database, "user-1"),
    ).resolves.toBe(true);

    const payloadBatch = executedQueries.find((query) =>
      query.sql.includes("UPDATE game_events AS event"),
    );
    const scrubbedPayload = JSON.parse(
      String(payloadBatch?.params.find((value) => typeof value === "string" && value.startsWith("{"))),
    ) as Record<string, unknown>;
    expect(scrubbedPayload).toMatchObject({
      assignments: [
        { userId: "deleted_anon", displayName: "Изтрит играч" },
        { userId: "user-2", displayName: "Борис", role: "werewolf" },
      ],
      lovers: { firstUserId: "deleted_anon", firstName: "Изтрит играч" },
      note: "Анна изпрати user-1",
      profileName: "Текуща Анна",
    });
    expect(scrubbedPayload).not.toHaveProperty("role");
    expect((scrubbedPayload as { assignments: Array<Record<string, unknown>> }).assignments[0]).not.toHaveProperty("role");
    expect(eventPredicates).toHaveLength(1);
    expect(eventPredicates[0]?.sql.toLowerCase()).not.toContain("like");
    expect(eventPredicates[0]?.sql).toContain('"game_events"."game_id" in');
    expect(eventPredicates[0]?.params).toEqual(expect.arrayContaining(["user-1", "game-1", "hosted-game"]));
    expect(payloadBatch).toBeDefined();
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("батчва голяма event history без N+1 UPDATE заявки", async () => {
    const events = Array.from({ length: 251 }, (_, index) => ({
      id: `event-${index}`,
      actorId: "user-1",
      targetId: null,
      payload: { userId: "user-1", displayName: "Анна" },
    }));
    const rowsByTable = new Map<unknown, unknown[]>([
      [user, [{ id: "user-1", displayName: "Анна" }]],
      [deletedUserIdentities, [{ anonymousUserId: "deleted_anon" }]],
      [gamePlayers, [{ gameId: "game-1", displayName: "Анна" }]],
      [games, []],
      [gameEvents, events],
    ]);
    const select = vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() => queryResult(rowsByTable.get(table) ?? [])),
      })),
    }));
    const update = vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    }));
    const insert = vi.fn(() => ({
      values: vi.fn(() => ({ onConflictDoNothing: vi.fn(async () => undefined) })),
    }));
    const deleteFrom = vi.fn((table: unknown) => ({
      where: vi.fn(() => table === user
        ? { returning: vi.fn(async () => [{ id: "user-1" }]) }
        : Promise.resolve()),
    }));
    const executedQueries: string[] = [];
    const tx = {
      execute: vi.fn(async (statement: unknown) => {
        executedQueries.push(
          new PgDialect().sqlToQuery(
            statement as Parameters<PgDialect["sqlToQuery"]>[0],
          ).sql,
        );
      }),
      select,
      insert,
      update,
      delete: deleteFrom,
    };

    await expect(
      deleteUserAccountAtomically(
        {
          transaction: vi.fn(async (operation: (transaction: typeof tx) => Promise<boolean>) =>
            operation(tx)),
        } as unknown as Database,
        "user-1",
      ),
    ).resolves.toBe(true);

    expect(
      executedQueries.filter((query) => query.includes("UPDATE game_events AS event")),
    ).toHaveLength(2);
  });

  it("не допуска delayed upsert да възкреси user, когато изтриването спечели race-а", async () => {
    const race = createIdentityRaceDatabase();
    const deletion = deleteUserAccountAtomically(race.db, "user-1");
    await race.firstLockAcquired;

    let persistenceFinished = false;
    const persistence = upsertUsersUnlessDeleted(race.db, [{
      userId: "user-1",
      displayName: "Играч",
      email: "user-1@anonymous.local",
    }]).then((identityMap) => {
      persistenceFinished = true;
      return identityMap;
    });
    await race.secondLockWaiting;

    expect(persistenceFinished).toBe(false);
    race.releaseFirstLock();

    await expect(deletion).resolves.toBe(true);
    const identityMap = await persistence;
    const anonymousUserId = race.tombstones.get("user-1");
    expect(identityMap.get("user-1")).toBe(anonymousUserId);
    expect(race.users.has("user-1")).toBe(false);
    expect(race.users.has(anonymousUserId ?? "")).toBe(true);
  });

  it("изтриването премахва user-а, когато delayed upsert спечели race-а", async () => {
    const race = createIdentityRaceDatabase();
    const persistence = upsertUsersUnlessDeleted(race.db, [{
      userId: "user-1",
      displayName: "Играч",
      email: "user-1@anonymous.local",
    }]);
    await race.firstLockAcquired;

    let deletionFinished = false;
    const deletion = deleteUserAccountAtomically(race.db, "user-1").then((deleted) => {
      deletionFinished = true;
      return deleted;
    });
    await race.secondLockWaiting;

    expect(deletionFinished).toBe(false);
    race.releaseFirstLock();

    await expect(persistence).resolves.toEqual(new Map());
    await expect(deletion).resolves.toBe(true);
    expect(race.users.has("user-1")).toBe(false);
    expect(race.users.has(race.tombstones.get("user-1") ?? "")).toBe(true);
  });
});

describe("scrubDeletedIdentityFromEventPayload", () => {
  it("не третира кратки или wildcard имена като глобален free-text шаблон", () => {
    const payload = {
      assignments: [
        { userId: "user-1", displayName: "%", role: "seer" },
        { userId: "user-2", displayName: "%", role: "werewolf" },
      ],
      pair: { firstUserId: "user-1", firstName: "Ан" },
      note: "100% запис за Ан и literal user-1",
    };

    expect(scrubDeletedIdentityFromEventPayload(payload, {
      userId: "user-1",
      anonymousUserId: "deleted_anon",
      displayNames: ["%", "Ан"],
    })).toEqual({
      assignments: [
        { userId: "deleted_anon", displayName: "Изтрит играч" },
        { userId: "user-2", displayName: "%", role: "werewolf" },
      ],
      pair: { firstUserId: "deleted_anon", firstName: "Изтрит играч" },
      note: "100% запис за Ан и literal user-1",
    });
  });

  it("не променя same-name target поле само защото deleted user е actor", () => {
    expect(scrubDeletedIdentityFromEventPayload(
      { displayName: "Ан", targetName: "Ан", role: "seer" },
      {
        userId: "user-1",
        anonymousUserId: "deleted_anon",
        displayNames: ["Ан"],
        stripRootSecretRoles: true,
        rootIdentityNameStems: [""],
      },
    )).toEqual({
      displayName: "Изтрит играч",
      targetName: "Ан",
    });
  });
});

describe("getAccountExportPage", () => {
  it("ограничава games/events на query boundary и не връща hostId или payload", async () => {
    const getAccountExportPage = (databaseQueries as Record<string, unknown>).getAccountExportPage;
    expect(getAccountExportPage).toBeTypeOf("function");
    if (typeof getAccountExportPage !== "function") {
      return;
    }

    const gameLimit = vi.fn((limit: number) => ({
      offset: vi.fn(async () => [
        exportGameRow({ id: "game-1", hostId: "foreign-host" }),
        exportGameRow({ id: "game-2", isHost: true }),
      ]),
    }));
    const eventOffset = vi.fn(async () => [{
      id: "event-1",
      gameId: "game-1",
      round: 1,
      phase: "day",
      type: "vote",
      actorId: "other-user",
      targetId: "user-1",
      visibility: "public",
      payload: { privateMarker: "must-not-escape" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }]);
    const eventLimit = vi.fn(() => ({ offset: eventOffset }));
    const select = vi.fn(() => ({
      from: vi.fn((table: unknown) => table === games
        ? {
            leftJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({ limit: gameLimit })),
              })),
            })),
          }
        : {
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({ limit: eventLimit })),
            })),
          }),
    }));

    const result = await (getAccountExportPage as (
      db: Database,
      userId: string,
      options: { page: number; pageSize: number; eventPage: number; eventPageSize: number },
    ) => Promise<Record<string, unknown>>)(
      { select } as unknown as Database,
      "user-1",
      { page: 2, pageSize: 1, eventPage: 3, eventPageSize: 200 },
    );

    expect(gameLimit).toHaveBeenCalledWith(2);
    expect(gameLimit.mock.results[0]?.value.offset).toHaveBeenCalledWith(1);
    expect(eventLimit).toHaveBeenCalledWith(201);
    expect(eventOffset).toHaveBeenCalledWith(400);
    expect(result).toMatchObject({
      page: 2,
      pageSize: 1,
      hasMore: true,
      eventPage: 3,
      eventPageSize: 200,
      eventsHasMore: false,
    });
    expect(JSON.stringify(result)).not.toContain("foreign-host");
    expect(JSON.stringify(result)).not.toContain("must-not-escape");
    expect(result.games).toEqual([
      expect.objectContaining({
        id: "game-1",
        isHost: false,
        events: [expect.objectContaining({ target: "self", actor: null })],
      }),
    ]);
  });
});

function exportGameRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "game-1",
    code: "ROOM1",
    config: { mode: "werewolves_classic" },
    status: "ended",
    winnerTeam: "village",
    startedAt: null,
    endedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    isHost: false,
    playerDisplayName: "Анна",
    playerRole: "seer",
    playerIsAlive: true,
    playerDeathRound: null,
    playerDeathCause: null,
    playerIsLover: false,
    playerCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function queryResult(rows: unknown[]) {
  const result = Promise.resolve(rows) as Promise<unknown[]> & {
    for: () => Promise<unknown[]>;
    limit: () => Promise<unknown[]> & { for: () => Promise<unknown[]> };
  };
  result.for = vi.fn(async () => rows);
  result.limit = vi.fn(() => {
    const limited = Promise.resolve(rows) as Promise<unknown[]> & { for: () => Promise<unknown[]> };
    limited.for = vi.fn(async () => rows);
    return limited;
  });
  return result;
}
