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

  it("fails startup and does not schedule recurring work when the initial pass fails", async () => {
    const run = vi.fn(async () => {
      throw new Error("unsafe OAuth key retirement");
    });
    const setInterval = vi.fn() as never;

    await expect(startDatabaseMaintenanceLoop(
      {
        NODE_ENV: "production",
        DATABASE_URL: "postgres://local/db",
      },
      { run, setInterval },
    )).rejects.toThrow("unsafe OAuth key retirement");
    expect(setInterval).not.toHaveBeenCalled();
  });

  it("parses bounded cleanup and retention settings", () => {
    expect(readDatabaseMaintenanceConfig({
      DATABASE_MAINTENANCE_BATCH_SIZE: "2500",
      DATABASE_STALE_LOBBY_HOURS: "72",
      DATABASE_EVENT_RETENTION_DAYS: "365",
    })).toEqual({
      batchSize: 2_500,
      staleLobbyHours: 72,
      eventRetentionDays: 365,
    });
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
