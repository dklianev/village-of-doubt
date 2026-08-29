import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client.js";
import {
  countUnversionedOAuthTokens,
  encryptLegacyOAuthTokens,
  runDatabaseMaintenance,
} from "./maintenance.js";

describe("runDatabaseMaintenance", () => {
  it("runs bounded cleanup and stale-game reconciliation under one advisory lock", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const execute = vi.fn(async (statement: unknown) => {
      const query = new PgDialect().sqlToQuery(
        statement as Parameters<PgDialect["sqlToQuery"]>[0],
      );
      statements.push(query);
      if (query.sql.includes("pg_try_advisory_xact_lock")) {
        return [{ acquired: true }];
      }
      return [{ affected: 2 }];
    });
    const transaction = vi.fn(async (operation: (tx: { execute: typeof execute }) => Promise<unknown>) =>
      operation({ execute }),
    );

    const result = await runDatabaseMaintenance(
      { transaction } as unknown as Database,
      {
        now: new Date("2026-07-29T12:00:00.000Z"),
        batchSize: 500,
        staleLobbyHours: 48,
        eventRetentionDays: 365,
      },
    );

    expect(result).toMatchObject({ acquired: true, activeGamesAbandoned: 2 });
    expect(statements.some((query) => query.sql.includes('DELETE FROM "session"'))).toBe(true);
    expect(statements.some((query) => query.sql.includes('DELETE FROM "verification"'))).toBe(true);
    expect(statements.some((query) => query.sql.includes("'abandoned'"))).toBe(true);
    expect(statements.some((query) => query.sql.includes('"status" = \'active\''))).toBe(true);
    expect(statements.some((query) => query.sql.includes('active_game_reconciliation'))).toBe(true);
    const eventCleanup = statements.find((query) => query.sql.includes('DELETE FROM "game_events"'));
    expect(eventCleanup).toBeDefined();
    expect(eventCleanup?.sql).not.toContain("FOR UPDATE OF event");
    expect(statements.every((query) => !query.sql.includes("TRUNCATE"))).toBe(true);
    expect(statements.flatMap((query) => query.params).every((param) => !(param instanceof Date))).toBe(true);
  });

  it("reports bounded remaining backlog and oldest age without extra scans", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const maintenanceRow = (
      affected: number,
      remainingAtLeast: number,
      batchSaturated: boolean,
      oldestEligibleAt: string | null,
    ) => [{ affected, remainingAtLeast, batchSaturated, oldestEligibleAt }];
    const execute = vi.fn(async (statement: unknown) => {
      const query = new PgDialect().sqlToQuery(
        statement as Parameters<PgDialect["sqlToQuery"]>[0],
      );
      statements.push(query);
      if (query.sql.includes("pg_try_advisory_xact_lock")) {
        return [{ acquired: true }];
      }
      if (query.sql.includes('DELETE FROM "session"')) {
        return maintenanceRow(500, 1, true, "2026-07-29T10:00:00.000Z");
      }
      if (query.sql.includes('DELETE FROM "verification"')) {
        return maintenanceRow(3, 0, false, null);
      }
      if (query.sql.includes('"status" = \'lobby\'')) {
        return maintenanceRow(500, 1, true, "2026-07-28T00:00:00.000Z");
      }
      if (query.sql.includes('"status" = \'active\'')) {
        return maintenanceRow(500, 1, true, "2026-07-27T12:00:00.000Z");
      }
      if (query.sql.includes('DELETE FROM "game_events"')) {
        return maintenanceRow(500, 1, true, "2026-07-01T12:00:00.000Z");
      }
      throw new Error(`Unexpected maintenance statement: ${query.sql}`);
    });
    const transaction = vi.fn(async (operation: (tx: { execute: typeof execute }) => Promise<unknown>) =>
      operation({ execute }),
    );

    const result = await runDatabaseMaintenance(
      { transaction } as unknown as Database,
      {
        now: new Date("2026-07-29T12:00:00.000Z"),
        batchSize: 500,
        staleLobbyHours: 48,
        staleActiveHours: 24,
        eventRetentionDays: 365,
      },
    );

    expect(result.backlog).toEqual({
      expiredSessions: {
        remainingAtLeast: 1,
        batchSaturated: true,
        oldestEligibleAt: "2026-07-29T10:00:00.000Z",
        oldestAgeMs: 7_200_000,
      },
      expiredVerifications: {
        remainingAtLeast: 0,
        batchSaturated: false,
        oldestEligibleAt: null,
        oldestAgeMs: null,
      },
      staleLobbies: {
        remainingAtLeast: 1,
        batchSaturated: true,
        oldestEligibleAt: "2026-07-28T00:00:00.000Z",
        oldestAgeMs: 129_600_000,
      },
      staleActiveGames: {
        remainingAtLeast: 1,
        batchSaturated: true,
        oldestEligibleAt: "2026-07-27T12:00:00.000Z",
        oldestAgeMs: 172_800_000,
      },
      expiredEvents: {
        remainingAtLeast: 1,
        batchSaturated: true,
        oldestEligibleAt: "2026-07-01T12:00:00.000Z",
        oldestAgeMs: 2_419_200_000,
      },
    });
    expect(execute).toHaveBeenCalledTimes(6);
    const mutationStatements = statements.filter(
      (query) => !query.sql.includes("pg_try_advisory_xact_lock"),
    );
    expect(mutationStatements).toHaveLength(5);
    for (const statement of mutationStatements) {
      expect(statement.params).toContain(501);
      expect(statement.params).toContain(500);
    }
    const activeReconciliation = mutationStatements.find(
      (query) => query.sql.includes('"status" = \'active\''),
    );
    expect(activeReconciliation?.params).toContain("2026-07-28T12:00:00.000Z");
  });

  it("does not probe or delete retained events when event retention is disabled", async () => {
    const statements: string[] = [];
    const execute = vi.fn(async (statement: unknown) => {
      const query = new PgDialect().sqlToQuery(
        statement as Parameters<PgDialect["sqlToQuery"]>[0],
      );
      statements.push(query.sql);
      if (query.sql.includes("pg_try_advisory_xact_lock")) {
        return [{ acquired: true }];
      }
      return [{
        affected: 0,
        remainingAtLeast: 0,
        batchSaturated: false,
        oldestEligibleAt: null,
      }];
    });
    const transaction = vi.fn(async (operation: (tx: { execute: typeof execute }) => Promise<unknown>) =>
      operation({ execute }),
    );

    const result = await runDatabaseMaintenance(
      { transaction } as unknown as Database,
      { eventRetentionDays: 0 },
    );

    expect(statements.some((statement) => statement.includes('FROM "game_events"'))).toBe(false);
    expect(statements.some((statement) => statement.includes('DELETE FROM "game_events"'))).toBe(false);
    expect(result.backlog?.expiredEvents).toEqual({
      remainingAtLeast: 0,
      batchSaturated: false,
      oldestEligibleAt: null,
      oldestAgeMs: null,
    });
  });

  it("skips cleanup when another replica owns the maintenance lock", async () => {
    const execute = vi.fn(async () => [{ acquired: false }]);
    const transaction = vi.fn(async (operation: (tx: { execute: typeof execute }) => Promise<unknown>) =>
      operation({ execute }),
    );

    await expect(
      runDatabaseMaintenance({ transaction } as unknown as Database),
    ).resolves.toEqual({
      acquired: false,
      sessionsDeleted: 0,
      verificationsDeleted: 0,
      gamesAbandoned: 0,
      activeGamesAbandoned: 0,
      eventsDeleted: 0,
      backlog: {
        expiredSessions: {
          remainingAtLeast: 0,
          batchSaturated: false,
          oldestEligibleAt: null,
          oldestAgeMs: null,
        },
        expiredVerifications: {
          remainingAtLeast: 0,
          batchSaturated: false,
          oldestEligibleAt: null,
          oldestAgeMs: null,
        },
        staleLobbies: {
          remainingAtLeast: 0,
          batchSaturated: false,
          oldestEligibleAt: null,
          oldestAgeMs: null,
        },
        staleActiveGames: {
          remainingAtLeast: 0,
          batchSaturated: false,
          oldestEligibleAt: null,
          oldestAgeMs: null,
        },
        expiredEvents: {
          remainingAtLeast: 0,
          batchSaturated: false,
          oldestEligibleAt: null,
          oldestAgeMs: null,
        },
      },
    });
    expect(execute).toHaveBeenCalledOnce();
  });
});

describe("encryptLegacyOAuthTokens", () => {
  it("encrypts only legacy plaintext token fields in one bounded locked batch", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const execute = vi.fn(async (statement: unknown) => {
      const query = new PgDialect().sqlToQuery(
        statement as Parameters<PgDialect["sqlToQuery"]>[0],
      );
      statements.push(query);
      if (query.sql.includes("pg_try_advisory_xact_lock")) {
        return [{ acquired: true }];
      }
      if (query.sql.includes('FROM "account"') && query.sql.includes("FOR UPDATE SKIP LOCKED")) {
        return [{
          id: "account-1",
          accessToken: "legacy-access-token",
          refreshToken: "$ba$2$already-encrypted",
          idToken: "0123456789abcdef",
        }];
      }
      return [{ affected: 1 }];
    });
    const transaction = vi.fn(async (operation: (tx: { execute: typeof execute }) => Promise<unknown>) =>
      operation({ execute }),
    );
    const encryptToken = vi.fn(async (token: string) => `encrypted:${token}`);

    await expect(encryptLegacyOAuthTokens(
      { transaction } as unknown as Database,
      encryptToken,
      {
        now: new Date("2026-07-29T12:00:00.000Z"),
        batchSize: 25,
      },
    )).resolves.toEqual({
      acquired: true,
      accountsUpdated: 1,
      tokensEncrypted: 1,
    });

    expect(encryptToken).toHaveBeenCalledExactlyOnceWith("legacy-access-token");
    const select = statements.find((query) => query.sql.includes('FROM "account"'));
    expect(select?.sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(select?.sql).toContain("^[0-9a-fA-F]+$");
    expect(select?.params).toContain(25);
    const update = statements.find((query) => query.sql.includes('UPDATE "account"'));
    expect(update?.params).toContain("encrypted:legacy-access-token");
    expect(update?.params).not.toContain("legacy-access-token");
    expect(update?.params.every((param) => !(param instanceof Date))).toBe(true);
  });

  it("does not read accounts when another replica owns the encryption lock", async () => {
    const execute = vi.fn(async () => [{ acquired: false }]);
    const transaction = vi.fn(async (operation: (tx: { execute: typeof execute }) => Promise<unknown>) =>
      operation({ execute }),
    );
    const encryptToken = vi.fn(async (token: string) => token);

    await expect(encryptLegacyOAuthTokens(
      { transaction } as unknown as Database,
      encryptToken,
    )).resolves.toEqual({
      acquired: false,
      accountsUpdated: 0,
      tokensEncrypted: 0,
    });
    expect(execute).toHaveBeenCalledOnce();
    expect(encryptToken).not.toHaveBeenCalled();
  });

  it("rewraps unversioned Better Auth ciphertext when a legacy decryptor is available", async () => {
    const execute = vi.fn(async (statement: unknown) => {
      const query = new PgDialect().sqlToQuery(
        statement as Parameters<PgDialect["sqlToQuery"]>[0],
      );
      if (query.sql.includes("pg_try_advisory_xact_lock")) {
        return [{ acquired: true }];
      }
      if (query.sql.includes('FROM "account"') && query.sql.includes("FOR UPDATE SKIP LOCKED")) {
        return [{
          id: "account-legacy",
          accessToken: "0123456789abcdef",
          refreshToken: "$ba$2$current",
          idToken: null,
        }];
      }
      return [{ affected: 1 }];
    });
    const transaction = vi.fn(async (operation: (tx: { execute: typeof execute }) => Promise<unknown>) =>
      operation({ execute }),
    );
    const encryptToken = vi.fn(async (token: string) => `$ba$2$plain:${token}`);
    const rewrapToken = vi.fn(async (token: string) => `$ba$2$rewrapped:${token}`);

    await expect(encryptLegacyOAuthTokens(
      { transaction } as unknown as Database,
      encryptToken,
      { rewrapToken },
    )).resolves.toEqual({
      acquired: true,
      accountsUpdated: 1,
      tokensEncrypted: 1,
    });

    expect(encryptToken).not.toHaveBeenCalled();
    expect(rewrapToken).toHaveBeenCalledExactlyOnceWith("0123456789abcdef");
    const selectStatement = execute.mock.calls
      .map(([statement]) => new PgDialect().sqlToQuery(
        statement as Parameters<PgDialect["sqlToQuery"]>[0],
      ).sql)
      .find((statement) => statement.includes('FROM "account"'));
    expect(selectStatement).toContain("NOT LIKE '$ba$%'");
    expect(selectStatement).not.toContain("^[0-9a-fA-F]+$");
  });

  it("counts every token that is not wrapped in a versioned Better Auth envelope", async () => {
    const execute = vi.fn(async () => [{ affected: 3 }]);

    await expect(countUnversionedOAuthTokens(
      { execute } as unknown as Database,
    )).resolves.toBe(3);
    expect(execute).toHaveBeenCalledOnce();
  });
});
