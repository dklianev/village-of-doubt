import { describe, expect, it, vi } from "vitest";
import {
  MemoryPlayerSecurityStore,
  createRedisPlayerSecurityStore,
  type RedisPlayerSecurityClient,
} from "../player-security-store.js";

class SharedFakeRedisClient implements RedisPlayerSecurityClient {
  readonly nonces = new Map<string, number>();
  readonly joinCounts = new Map<string, { count: number; expiresAt: number }>();
  readonly activeRooms = new Map<string, Map<string, number>>();

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
    script: string,
    options: { keys: string[]; arguments: string[] },
  ) {
    const [key] = options.keys;
    if (script.includes("ZREMRANGEBYSCORE")) {
      const [nowRaw, expiresAtRaw, roomDigest, limitRaw] = options.arguments;
      const now = Number(nowRaw);
      const expiresAt = Number(expiresAtRaw);
      const limit = Number(limitRaw);
      const rooms = this.activeRooms.get(key) ?? new Map<string, number>();
      for (const [room, expiry] of rooms) {
        if (expiry <= now) {
          rooms.delete(room);
        }
      }
      if (rooms.has(roomDigest)) {
        rooms.set(roomDigest, expiresAt);
        this.activeRooms.set(key, rooms);
        return 1;
      }
      if (rooms.size >= limit) {
        return 0;
      }
      rooms.set(roomDigest, expiresAt);
      this.activeRooms.set(key, rooms);
      return 1;
    }
    if (script.includes("ZREM")) {
      const [roomDigest] = options.arguments;
      const rooms = this.activeRooms.get(key);
      rooms?.delete(roomDigest);
      if (rooms?.size === 0) {
        this.activeRooms.delete(key);
      }
      return 1;
    }
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

  it("shares the active-room quota across replicas and releases a room", async () => {
    const client = new SharedFakeRedisClient();
    const firstReplica = createRedisPlayerSecurityStore(client, { maxActiveRooms: 2 });
    const secondReplica = createRedisPlayerSecurityStore(client, { maxActiveRooms: 2 });
    const expiresAt = Date.now() + 60_000;

    await expect(firstReplica.claimActiveRoom("user-1", "ROOM01", expiresAt)).resolves.toBe(true);
    await expect(secondReplica.claimActiveRoom("user-1", "ROOM02", expiresAt)).resolves.toBe(true);
    await expect(firstReplica.claimActiveRoom("user-1", "ROOM03", expiresAt)).resolves.toBe(false);

    await secondReplica.releaseActiveRoom("user-1", "ROOM01");
    await expect(firstReplica.claimActiveRoom("user-1", "ROOM03", expiresAt)).resolves.toBe(true);
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

  it("bounds active rooms per user while allowing an idempotent refresh", async () => {
    const store = new MemoryPlayerSecurityStore({ maxActiveRooms: 2 });
    const expiresAt = Date.now() + 60_000;

    await expect(store.claimActiveRoom("user-1", "ROOM01", expiresAt)).resolves.toBe(true);
    await expect(store.claimActiveRoom("user-1", "ROOM02", expiresAt)).resolves.toBe(true);
    await expect(store.claimActiveRoom("user-1", "ROOM01", expiresAt + 1_000)).resolves.toBe(true);
    await expect(store.claimActiveRoom("user-1", "ROOM03", expiresAt)).resolves.toBe(false);

    await store.releaseActiveRoom("user-1", "ROOM02");
    await expect(store.claimActiveRoom("user-1", "ROOM03", expiresAt)).resolves.toBe(true);
  });
});
