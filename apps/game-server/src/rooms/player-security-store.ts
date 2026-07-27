import { createHash } from "node:crypto";

const DEFAULT_JOIN_RATE_WINDOW_MS = 10_000;
const DEFAULT_JOIN_RATE_LIMIT = 5;
const DEFAULT_MAX_USED_NONCES = 10_000;
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

export interface PlayerSecurityStore {
  consumeTokenNonce(nonce: string, expiresAtMs: number): Promise<boolean>;
  checkJoinRateLimit(userId: string): Promise<boolean>;
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
}

interface RedisPlayerSecurityStoreOptions {
  joinRateLimit?: number;
  joinRateWindowMs?: number;
}

export function createRedisPlayerSecurityStore(
  client: RedisPlayerSecurityClient,
  {
    joinRateLimit = DEFAULT_JOIN_RATE_LIMIT,
    joinRateWindowMs = DEFAULT_JOIN_RATE_WINDOW_MS,
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
  };
}

export class MemoryPlayerSecurityStore implements PlayerSecurityStore {
  readonly #usedNonces = new Map<string, number>();
  readonly #joinAttempts = new Map<string, number[]>();
  readonly #maxUsedNonces: number;
  readonly #joinRateLimit: number;
  readonly #joinRateWindowMs: number;
  #nextJoinPruneAtMs = 0;

  constructor({
    maxUsedNonces = DEFAULT_MAX_USED_NONCES,
    joinRateLimit = DEFAULT_JOIN_RATE_LIMIT,
    joinRateWindowMs = DEFAULT_JOIN_RATE_WINDOW_MS,
  }: RedisPlayerSecurityStoreOptions & { maxUsedNonces?: number } = {}) {
    this.#maxUsedNonces = maxUsedNonces;
    this.#joinRateLimit = joinRateLimit;
    this.#joinRateWindowMs = joinRateWindowMs;
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

function securityKey(kind: "nonce" | "join", value: string) {
  const digest = createHash("sha256").update(value).digest("hex");
  return `wm:security:${kind}:${digest}`;
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
