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

    expect(result).toMatchObject({ acquired: true });
    expect(statements.some((query) => query.sql.includes('DELETE FROM "session"'))).toBe(true);
    expect(statements.some((query) => query.sql.includes('DELETE FROM "verification"'))).toBe(true);
    expect(statements.some((query) => query.sql.includes("'abandoned'"))).toBe(true);
    expect(statements.every((query) => !query.sql.includes('"status" = \'active\''))).toBe(true);
    const eventCleanup = statements.find((query) => query.sql.includes('DELETE FROM "game_events"'));
    expect(eventCleanup).toBeDefined();
    expect(eventCleanup?.sql).not.toContain("FOR UPDATE OF event");
    expect(statements.every((query) => !query.sql.includes("TRUNCATE"))).toBe(true);
    expect(statements.flatMap((query) => query.params).every((param) => !(param instanceof Date))).toBe(true);
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
      eventsDeleted: 0,
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
