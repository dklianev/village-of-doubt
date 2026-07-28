import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  drizzle: vi.fn(),
  postgres: vi.fn(),
}));

vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: mocks.drizzle }));
vi.mock("postgres", () => ({ default: mocks.postgres }));

import {
  checkDatabaseReadiness,
  closeAllDatabases,
  closeDatabase,
  createDatabase,
} from "./client.js";

describe("database pool lifecycle", () => {
  beforeEach(async () => {
    await closeAllDatabases();
    vi.clearAllMocks();
    mocks.postgres.mockImplementation(() => ({ end: vi.fn(async () => {}) }));
    mocks.drizzle.mockImplementation((client) => ({ client }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("limits the default process pool to eight connections", () => {
    vi.stubEnv("DATABASE_POOL_MAX", "");

    createDatabase("postgres://localhost/werewolf");

    expect(mocks.postgres).toHaveBeenCalledWith(
      "postgres://localhost/werewolf",
      expect.objectContaining({ max: 8 }),
    );
  });

  it("accepts an explicit positive pool limit", () => {
    vi.stubEnv("DATABASE_POOL_MAX", "12");

    createDatabase("postgres://localhost/werewolf");

    expect(mocks.postgres).toHaveBeenCalledWith(
      "postgres://localhost/werewolf",
      expect.objectContaining({ max: 12 }),
    );
  });

  it("reuses one process-wide pool for the same connection string", () => {
    const first = createDatabase("postgres://localhost/werewolf");
    const second = createDatabase("postgres://localhost/werewolf");

    expect(second).toBe(first);
    expect(mocks.postgres).toHaveBeenCalledOnce();
    expect(mocks.drizzle).toHaveBeenCalledOnce();
  });

  it("keeps separate pools for separate connection strings", () => {
    const first = createDatabase("postgres://localhost/werewolf");
    const second = createDatabase("postgres://localhost/werewolf_test");

    expect(second).not.toBe(first);
    expect(mocks.postgres).toHaveBeenCalledTimes(2);
  });

  it("closes and evicts a pool so a later call creates a fresh one", async () => {
    const first = createDatabase("postgres://localhost/werewolf") as unknown as {
      client: { end: ReturnType<typeof vi.fn> };
    };

    await expect(closeDatabase("postgres://localhost/werewolf")).resolves.toBe(true);
    expect(first.client.end).toHaveBeenCalledWith({ timeout: 5 });

    const second = createDatabase("postgres://localhost/werewolf");
    expect(second).not.toBe(first);
    expect(mocks.postgres).toHaveBeenCalledTimes(2);
  });

  it("closes every process-wide pool", async () => {
    const first = createDatabase("postgres://localhost/one") as unknown as {
      client: { end: ReturnType<typeof vi.fn> };
    };
    const second = createDatabase("postgres://localhost/two") as unknown as {
      client: { end: ReturnType<typeof vi.fn> };
    };

    await closeAllDatabases();

    expect(first.client.end).toHaveBeenCalledOnce();
    expect(second.client.end).toHaveBeenCalledOnce();
    await expect(closeDatabase("postgres://localhost/one")).resolves.toBe(false);
  });

  it("reports database readiness without exposing driver errors", async () => {
    await expect(
      checkDatabaseReadiness({ execute: vi.fn(async () => [{ value: 1 }]) } as never),
    ).resolves.toBe(true);
    await expect(
      checkDatabaseReadiness({ execute: vi.fn(async () => Promise.reject(new Error("private DSN details"))) } as never),
    ).resolves.toBe(false);
  });

  it("bounds a stalled readiness probe", async () => {
    const execute = vi.fn(() => new Promise(() => {}));

    await expect(
      checkDatabaseReadiness({ execute } as never, 10),
    ).resolves.toBe(false);
    expect(execute).toHaveBeenCalledOnce();
  });
});
