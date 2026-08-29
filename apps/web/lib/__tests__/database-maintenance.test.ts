import { describe, expect, it, vi } from "vitest";
import {
  readDatabaseMaintenanceConfig,
  rewrapLegacyOAuthToken,
  resolveBetterAuthEncryptionKey,
  startDatabaseMaintenanceLoop,
} from "../database-maintenance";

describe("database maintenance loop", () => {
  it("runs only in production with a configured database", async () => {
    const run = vi.fn(async () => undefined);
    const setInterval = vi.fn(() => ({ unref: vi.fn() })) as never;

    await expect(startDatabaseMaintenanceLoop(
      { NODE_ENV: "development", DATABASE_URL: "postgres://local/db" },
      { run, setInterval },
    )).resolves.toBeNull();
    await expect(startDatabaseMaintenanceLoop(
      { NODE_ENV: "production" },
      { run, setInterval },
    )).resolves.toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it("starts immediately and schedules an unrefed maintenance interval", async () => {
    const run = vi.fn(async () => undefined);
    const unref = vi.fn();
    const setInterval = vi.fn(() => ({ unref })) as never;

    const timer = await startDatabaseMaintenanceLoop(
      {
        NODE_ENV: "production",
        DATABASE_URL: "postgres://local/db",
        DATABASE_MAINTENANCE_INTERVAL_MS: "3600000",
      },
      { run, setInterval },
    );
    expect(timer).not.toBeNull();
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 3_600_000);
    expect(unref).toHaveBeenCalledOnce();
  });

  it("logs a structured summary for a completed maintenance pass", async () => {
    const info = vi.fn();
    const error = vi.fn();
    const now = vi.fn()
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_042);
    const run = vi.fn(async () => ({
      maintenance: {
        acquired: true,
        sessionsDeleted: 2,
        verificationsDeleted: 3,
        gamesAbandoned: 1,
        activeGamesAbandoned: 0,
        eventsDeleted: 40,
      },
      oauthTokens: {
        accountsUpdated: 4,
        tokensEncrypted: 5,
        unversionedTokensRemaining: 0,
      },
    }));
    const setInterval = vi.fn(() => ({ unref: vi.fn() })) as never;

    await startDatabaseMaintenanceLoop(
      { NODE_ENV: "production", DATABASE_URL: "postgres://local/db" },
      { run, setInterval, logger: { info, error }, now },
    );

    expect(info).toHaveBeenCalledWith("[database-maintenance]", {
      event: "completed",
      timestamp: "1970-01-01T00:00:01.042Z",
      durationMs: 42,
      maintenance: {
        acquired: true,
        sessionsDeleted: 2,
        verificationsDeleted: 3,
        gamesAbandoned: 1,
        activeGamesAbandoned: 0,
        eventsDeleted: 40,
      },
      oauthTokens: {
        accountsUpdated: 4,
        tokensEncrypted: 5,
        unversionedTokensRemaining: 0,
      },
    });
    expect(error).not.toHaveBeenCalled();
  });

  it("records an advisory-lock skip without reporting a failure", async () => {
    const info = vi.fn();
    const error = vi.fn();
    const now = vi.fn()
      .mockReturnValueOnce(2_000)
      .mockReturnValueOnce(2_005);
    const run = vi.fn(async () => ({
      maintenance: {
        acquired: false,
        sessionsDeleted: 0,
        verificationsDeleted: 0,
        gamesAbandoned: 0,
        activeGamesAbandoned: 0,
        eventsDeleted: 0,
      },
      oauthTokens: {
        accountsUpdated: 0,
        tokensEncrypted: 0,
        unversionedTokensRemaining: 0,
      },
    }));
    const setInterval = vi.fn(() => ({ unref: vi.fn() })) as never;

    await startDatabaseMaintenanceLoop(
      { NODE_ENV: "production", DATABASE_URL: "postgres://local/db" },
      { run, setInterval, logger: { info, error }, now },
    );

    expect(info).toHaveBeenCalledWith("[database-maintenance]", expect.objectContaining({
      event: "skipped",
      durationMs: 5,
      maintenance: expect.objectContaining({ acquired: false }),
    }));
    expect(error).not.toHaveBeenCalled();
  });

  it("keeps startup available and schedules retry after an allowlisted connection failure", async () => {
    const info = vi.fn();
    const error = vi.fn();
    const now = vi.fn()
      .mockReturnValueOnce(2_500)
      .mockReturnValueOnce(2_515);
    const connectionError = Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    });
    const run = vi.fn().mockRejectedValueOnce(connectionError);
    const unref = vi.fn();
    const setInterval = vi.fn(() => ({ unref })) as never;

    const timer = await startDatabaseMaintenanceLoop(
      { NODE_ENV: "production", DATABASE_URL: "postgres://local/db" },
      { run, setInterval, logger: { info, error }, now },
    );

    expect(timer).not.toBeNull();
    expect(setInterval).toHaveBeenCalledOnce();
    expect(unref).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith("[database-maintenance]", {
      event: "failed",
      timestamp: "1970-01-01T00:00:02.515Z",
      durationMs: 15,
      error: {
        name: "Error",
        code: "ECONNREFUSED",
        status: null,
      },
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain("connect ECONNREFUSED");
  });

  it.each(["28P01", "42P01"])(
    "fails startup for non-transient database error %s",
    async (code) => {
      const databaseError = Object.assign(new Error(`database error ${code}`), { code });
      const run = vi.fn().mockRejectedValueOnce(databaseError);
      const setInterval = vi.fn() as never;
      const logger = { info: vi.fn(), error: vi.fn() };

      await expect(startDatabaseMaintenanceLoop(
        { NODE_ENV: "production", DATABASE_URL: "postgres://local/db" },
        { run, setInterval, logger },
      )).rejects.toBe(databaseError);
      expect(setInterval).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledOnce();
    },
  );

  it("fails startup and does not schedule recurring work when the initial pass fails", async () => {
    const info = vi.fn();
    const error = vi.fn();
    const now = vi.fn()
      .mockReturnValueOnce(3_000)
      .mockReturnValueOnce(3_015);
    const run = vi.fn(async () => {
      throw new Error("unsafe OAuth key retirement");
    });
    const setInterval = vi.fn() as never;

    await expect(startDatabaseMaintenanceLoop(
      {
        NODE_ENV: "production",
        DATABASE_URL: "postgres://local/db",
      },
      { run, setInterval, logger: { info, error }, now },
    )).rejects.toThrow("unsafe OAuth key retirement");
    expect(setInterval).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("[database-maintenance]", {
      event: "failed",
      timestamp: "1970-01-01T00:00:03.015Z",
      durationMs: 15,
      error: {
        name: "Error",
        code: "UNKNOWN",
        status: null,
      },
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain("unsafe OAuth key retirement");
  });

  it("parses bounded cleanup and retention settings", () => {
    expect(readDatabaseMaintenanceConfig({
      DATABASE_MAINTENANCE_BATCH_SIZE: "2500",
      DATABASE_STALE_LOBBY_HOURS: "72",
      DATABASE_STALE_ACTIVE_HOURS: "36",
      DATABASE_EVENT_RETENTION_DAYS: "365",
    })).toEqual({
      batchSize: 2_500,
      staleLobbyHours: 72,
      staleActiveHours: 36,
      eventRetentionDays: 365,
    });
  });

  it("defaults detailed game-event retention to 12 months", () => {
    expect(readDatabaseMaintenanceConfig({}).eventRetentionDays).toBe(365);
  });

  it("builds the same versioned key ring used by Better Auth token encryption", () => {
    const key = resolveBetterAuthEncryptionKey({
      BETTER_AUTH_SECRET: "legacy-secret-that-remains-during-rotation",
      BETTER_AUTH_SECRETS: [
        "2:current-secret-that-is-long-enough-for-production",
        "1:previous-secret-that-is-long-enough-for-production",
      ].join(","),
    });

    expect(key).toMatchObject({
      currentVersion: 2,
      legacySecret: "legacy-secret-that-remains-during-rotation",
    });
    expect(key && typeof key !== "string" ? [...key.keys.entries()] : []).toEqual([
      [2, "current-secret-that-is-long-enough-for-production"],
      [1, "previous-secret-that-is-long-enough-for-production"],
    ]);
    expect(resolveBetterAuthEncryptionKey({
      BETTER_AUTH_SECRET: "single-secret-that-is-long-enough-for-production",
    })).toBe("single-secret-that-is-long-enough-for-production");
  });

  it.each([
    ["missing separator", "2-secret"],
    ["duplicate version", "2:first-secret,2:second-secret"],
    ["empty secret", "2:"],
    ["invalid version", "02:secret"],
    ["versions not newest-first", "1:older-secret,2:newer-secret"],
  ])("rejects malformed BETTER_AUTH_SECRETS: %s", (_label, secrets) => {
    expect(() => resolveBetterAuthEncryptionKey({
      BETTER_AUTH_SECRET: "legacy-secret-that-is-long-enough-for-production",
      BETTER_AUTH_SECRETS: secrets,
    })).toThrow("BETTER_AUTH_SECRETS");
  });

  it("rewraps bare-hex OAuth ciphertext with the current versioned key", async () => {
    const legacySecret = "legacy-secret-that-is-long-enough-for-production";
    const encryptionKey = resolveBetterAuthEncryptionKey({
      BETTER_AUTH_SECRET: legacySecret,
      BETTER_AUTH_SECRETS: "2:current-secret-that-is-long-enough-for-production",
    });
    expect(encryptionKey).not.toBeNull();
    expect(typeof encryptionKey).not.toBe("string");

    const { symmetricDecrypt, symmetricEncrypt } = await import("better-auth/crypto");
    const legacyCiphertext = await symmetricEncrypt({
      key: legacySecret,
      data: "provider-access-token",
    });
    const rewrapped = await rewrapLegacyOAuthToken(
      legacyCiphertext,
      encryptionKey as Exclude<typeof encryptionKey, string | null>,
    );

    expect(rewrapped).toMatch(/^\$ba\$2\$/);
    await expect(symmetricDecrypt({
      key: encryptionKey as Exclude<typeof encryptionKey, string | null>,
      data: rewrapped,
    })).resolves.toBe("provider-access-token");
  });

  it("treats a hexadecimal provider token as plaintext when legacy decryption fails", async () => {
    const encryptionKey = resolveBetterAuthEncryptionKey({
      BETTER_AUTH_SECRET: "legacy-secret-that-is-long-enough-for-production",
      BETTER_AUTH_SECRETS: "2:current-secret-that-is-long-enough-for-production",
    });
    expect(encryptionKey).not.toBeNull();
    expect(typeof encryptionKey).not.toBe("string");

    const { symmetricDecrypt } = await import("better-auth/crypto");
    const providerToken = "0123456789abcdef";
    const rewrapped = await rewrapLegacyOAuthToken(
      providerToken,
      encryptionKey as Exclude<typeof encryptionKey, string | null>,
    );

    await expect(symmetricDecrypt({
      key: encryptionKey as Exclude<typeof encryptionKey, string | null>,
      data: rewrapped,
    })).resolves.toBe(providerToken);
  });
});
