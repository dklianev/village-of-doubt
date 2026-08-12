import { createHash } from "node:crypto";
import { gameSessionRevocationKey } from "@werewolf/shared/server";

const DEFAULT_JOIN_RATE_WINDOW_MS = 10_000;
const DEFAULT_JOIN_RATE_LIMIT = 5;
const DEFAULT_MAX_USED_NONCES = 10_000;
const DEFAULT_MAX_ACTIVE_ROOMS = 6;
const JOIN_BUCKET_PRUNE_INTERVAL_MS = 30_000;

const JOIN_RATE_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
local ttl = redis.call("PTTL", KEYS[1])
if count == 1 or ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`;

const CLAIM_ACTIVE_ROOM_SCRIPT = `
local now = tonumber(ARGV[1])
local expiresAt = tonumber(ARGV[2])
local room = ARGV[3]
local limit = tonumber(ARGV[4])
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", now)
if redis.call("ZSCORE", KEYS[1], room) then
  redis.call("ZADD", KEYS[1], expiresAt, room)
else
  if redis.call("ZCARD", KEYS[1]) >= limit then
    return 0
  end
  redis.call("ZADD", KEYS[1], expiresAt, room)
end
local latest = redis.call("ZREVRANGE", KEYS[1], 0, 0, "WITHSCORES")
if latest[2] then
  redis.call("PEXPIREAT", KEYS[1], tonumber(latest[2]))
end
return 1
`;

const RELEASE_ACTIVE_ROOM_SCRIPT = `
redis.call("ZREM", KEYS[1], ARGV[1])
if redis.call("ZCARD", KEYS[1]) == 0 then
  redis.call("DEL", KEYS[1])
end
return 1
`;

export interface PlayerSecurityStore {
  consumeTokenNonce(nonce: string, expiresAtMs: number): Promise<boolean>;
  checkJoinRateLimit(userId: string): Promise<boolean>;
  claimActiveRoom(userId: string, roomCode: string, expiresAtMs: number): Promise<boolean>;
  releaseActiveRoom(userId: string, roomCode: string): Promise<void>;
  isGameSessionRevoked(userId: string, tokenIssuedAtMs: number): Promise<boolean>;
}

export interface RedisPlayerSecurityClient {
  set(
    key: string,
    value: string,
    options: {
      expiration: { type: "PX"; value: number };
      condition: "NX";
    },
  ): Promise<unknown>;
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
  get(key: string): Promise<unknown>;
}

interface RedisPlayerSecurityStoreOptions {
  joinRateLimit?: number;
  joinRateWindowMs?: number;
  maxActiveRooms?: number;
}

export function createRedisPlayerSecurityStore(
  client: RedisPlayerSecurityClient,
  {
    joinRateLimit = DEFAULT_JOIN_RATE_LIMIT,
    joinRateWindowMs = DEFAULT_JOIN_RATE_WINDOW_MS,
    maxActiveRooms = DEFAULT_MAX_ACTIVE_ROOMS,
  }: RedisPlayerSecurityStoreOptions = {},
): PlayerSecurityStore {
  return {
    async consumeTokenNonce(nonce, expiresAtMs) {
      const ttlMs = expiresAtMs - Date.now();
      if (ttlMs <= 0) {
        return false;
      }

      const result = await client.set(
        securityKey("nonce", nonce),
        "1",
        {
          expiration: { type: "PX", value: ttlMs },
          condition: "NX",
        },
      );
      return result === "OK";
    },

    async checkJoinRateLimit(userId) {
      const reply = await client.eval(JOIN_RATE_SCRIPT, {
        keys: [securityKey("join", userId)],
        arguments: [String(joinRateWindowMs)],
      });
      const [count] = parseJoinRateReply(reply);
      return count <= joinRateLimit;
    },

    async claimActiveRoom(userId, roomCode, expiresAtMs) {
      if (expiresAtMs <= Date.now()) {
        return false;
      }
      const reply = await client.eval(CLAIM_ACTIVE_ROOM_SCRIPT, {
        keys: [securityKey("active", userId)],
        arguments: [
          String(Date.now()),
          String(expiresAtMs),
          securityDigest(roomCode),
          String(maxActiveRooms),
        ],
      });
      return Number(reply) === 1;
    },

    async releaseActiveRoom(userId, roomCode) {
      await client.eval(RELEASE_ACTIVE_ROOM_SCRIPT, {
        keys: [securityKey("active", userId)],
        arguments: [securityDigest(roomCode)],
      });
    },

    async isGameSessionRevoked(userId, tokenIssuedAtMs) {
      const value = await client.get(gameSessionRevocationKey(userId));
      if (value === null) {
        return false;
      }
      const revokedAtMs = Number(value);
      if (!Number.isSafeInteger(revokedAtMs) || revokedAtMs < 0) {
        throw new Error("Redis върна невалиден game-session marker.");
      }
      return tokenIssuedAtMs <= revokedAtMs;
    },
  };
}

export class MemoryPlayerSecurityStore implements PlayerSecurityStore {
  readonly #usedNonces = new Map<string, number>();
  readonly #joinAttempts = new Map<string, number[]>();
  readonly #activeRooms = new Map<string, Map<string, number>>();
  readonly #maxUsedNonces: number;
  readonly #joinRateLimit: number;
  readonly #joinRateWindowMs: number;
  readonly #maxActiveRooms: number;
  #nextJoinPruneAtMs = 0;

  constructor({
    maxUsedNonces = DEFAULT_MAX_USED_NONCES,
    joinRateLimit = DEFAULT_JOIN_RATE_LIMIT,
    joinRateWindowMs = DEFAULT_JOIN_RATE_WINDOW_MS,
    maxActiveRooms = DEFAULT_MAX_ACTIVE_ROOMS,
  }: RedisPlayerSecurityStoreOptions & { maxUsedNonces?: number } = {}) {
    this.#maxUsedNonces = maxUsedNonces;
    this.#joinRateLimit = joinRateLimit;
    this.#joinRateWindowMs = joinRateWindowMs;
    this.#maxActiveRooms = maxActiveRooms;
  }

  async consumeTokenNonce(nonce: string, expiresAtMs: number) {
    const now = Date.now();
    if (expiresAtMs <= now) {
      return false;
    }
    this.#pruneExpiredNonces(now);
    if (this.#usedNonces.has(nonce) || this.#usedNonces.size >= this.#maxUsedNonces) {
      return false;
    }
    this.#usedNonces.set(nonce, expiresAtMs);
    return true;
  }

  async checkJoinRateLimit(userId: string) {
    const now = Date.now();
    if (now >= this.#nextJoinPruneAtMs) {
      this.#pruneJoinAttempts(now);
      this.#nextJoinPruneAtMs = now + JOIN_BUCKET_PRUNE_INTERVAL_MS;
    }
    const cutoff = now - this.#joinRateWindowMs;
    const timestamps = (this.#joinAttempts.get(userId) ?? []).filter((timestamp) => timestamp > cutoff);
    if (timestamps.length >= this.#joinRateLimit) {
      this.#joinAttempts.set(userId, timestamps);
      return false;
    }
    timestamps.push(now);
    this.#joinAttempts.set(userId, timestamps);
    return true;
  }

  async claimActiveRoom(userId: string, roomCode: string, expiresAtMs: number) {
    const now = Date.now();
    if (expiresAtMs <= now) {
      return false;
    }
    const rooms = this.#activeRooms.get(userId) ?? new Map<string, number>();
    for (const [code, expiry] of rooms) {
      if (expiry <= now) {
        rooms.delete(code);
      }
    }
    if (!rooms.has(roomCode) && rooms.size >= this.#maxActiveRooms) {
      this.#activeRooms.set(userId, rooms);
      return false;
    }
    rooms.set(roomCode, expiresAtMs);
    this.#activeRooms.set(userId, rooms);
    return true;
  }

  async releaseActiveRoom(userId: string, roomCode: string) {
    const rooms = this.#activeRooms.get(userId);
    rooms?.delete(roomCode);
    if (rooms?.size === 0) {
      this.#activeRooms.delete(userId);
    }
  }

  async isGameSessionRevoked() {
    return false;
  }

  getUsedNonceCountForTests() {
    return this.#usedNonces.size;
  }

  getJoinAttemptUserCountForTests() {
    return this.#joinAttempts.size;
  }

  #pruneExpiredNonces(now: number) {
    for (const [nonce, expiresAt] of this.#usedNonces) {
      if (expiresAt <= now) {
        this.#usedNonces.delete(nonce);
      }
    }
  }

  #pruneJoinAttempts(now: number) {
    const cutoff = now - this.#joinRateWindowMs;
    for (const [userId, timestamps] of this.#joinAttempts) {
      const activeTimestamps = timestamps.filter((timestamp) => timestamp > cutoff);
      if (activeTimestamps.length === 0) {
        this.#joinAttempts.delete(userId);
      } else {
        this.#joinAttempts.set(userId, activeTimestamps);
      }
    }
  }
}

function securityKey(kind: "nonce" | "join" | "active", value: string) {
  return `wm:security:${kind}:${securityDigest(value)}`;
}

function securityDigest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function parseJoinRateReply(reply: unknown): [count: number, ttlMs: number] {
  if (!Array.isArray(reply) || reply.length < 2) {
    throw new Error("Redis върна невалиден join-rate отговор.");
  }
  const count = Number(reply[0]);
  const ttlMs = Number(reply[1]);
  if (!Number.isFinite(count) || !Number.isFinite(ttlMs) || count < 1 || ttlMs < 0) {
    throw new Error("Redis върна невалидни join-rate стойности.");
  }
  return [count, ttlMs];
}
