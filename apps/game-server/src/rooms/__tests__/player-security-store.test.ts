import { describe, expect, it, vi } from "vitest";
import {
  MemoryPlayerSecurityStore,
  createRedisPlayerSecurityStore,
  type RedisPlayerSecurityClient,
} from "../player-security-store.js";

class SharedFakeRedisClient implements RedisPlayerSecurityClient {
  readonly nonces = new Map<string, number>();
  readonly joinCounts = new Map<string, { count: number; expiresAt: number }>();

  async set(
    key: string,
    _value: string,
    options: { expiration: { type: "PX"; value: number }; condition: "NX" },
  ) {
    const now = Date.now();
    const existingExpiry = this.nonces.get(key);
    if (existingExpiry && existingExpiry > now) {
      return null;
    }
    this.nonces.set(key, now + options.expiration.value);
    return "OK";
  }

  async eval(
    _script: string,
    options: { keys: string[]; arguments: string[] },
  ) {
    const [key] = options.keys;
    const [windowMs] = options.arguments;
    const now = Date.now();
    const existing = this.joinCounts.get(key);
    const bucket = existing && existing.expiresAt > now
      ? existing
      : { count: 0, expiresAt: now + Number(windowMs) };
    bucket.count += 1;
    this.joinCounts.set(key, bucket);
    return [bucket.count, Math.max(0, bucket.expiresAt - now)];
  }
}

describe("createRedisPlayerSecurityStore", () => {
  it("rejects a nonce consumed by another game-server replica", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T10:00:00Z"));
    const client = new SharedFakeRedisClient();
    const firstReplica = createRedisPlayerSecurityStore(client);
    const secondReplica = createRedisPlayerSecurityStore(client);
    const expiresAt = Date.now() + 300_000;

    await expect(firstReplica.consumeTokenNonce("nonce-1", expiresAt)).resolves.toBe(true);
    await expect(secondReplica.consumeTokenNonce("nonce-1", expiresAt)).resolves.toBe(false);
    vi.useRealTimers();
  });

  it("shares the join window across replicas", async () => {
    const client = new SharedFakeRedisClient();
    const firstReplica = createRedisPlayerSecurityStore(client);
    const secondReplica = createRedisPlayerSecurityStore(client);

    await expect(Promise.all([
      firstReplica.checkJoinRateLimit("user-1"),
      secondReplica.checkJoinRateLimit("user-1"),
      firstReplica.checkJoinRateLimit("user-1"),
      secondReplica.checkJoinRateLimit("user-1"),
      firstReplica.checkJoinRateLimit("user-1"),
    ])).resolves.toEqual([true, true, true, true, true]);
    await expect(secondReplica.checkJoinRateLimit("user-1")).resolves.toBe(false);
  });

  it("fails closed when Redis cannot persist a nonce", async () => {
    const client: RedisPlayerSecurityClient = {
      set: vi.fn(async () => {
        throw new Error("Redis unavailable");
      }),
      eval: vi.fn(),
    };
    const store = createRedisPlayerSecurityStore(client);

    await expect(store.consumeTokenNonce("nonce-1", Date.now() + 60_000)).rejects.toThrow("Redis unavailable");
  });
});

describe("MemoryPlayerSecurityStore", () => {
  it("prunes inactive join buckets without a background timer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T10:00:00Z"));
    const store = new MemoryPlayerSecurityStore({ joinRateWindowMs: 1_000 });

    await store.checkJoinRateLimit("user-1");
    await store.checkJoinRateLimit("user-2");
    expect(store.getJoinAttemptUserCountForTests()).toBe(2);

    vi.advanceTimersByTime(30_001);
    await store.checkJoinRateLimit("user-3");
    expect(store.getJoinAttemptUserCountForTests()).toBe(1);
    vi.useRealTimers();
  });
});
