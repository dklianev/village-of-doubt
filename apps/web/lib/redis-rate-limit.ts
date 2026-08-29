import { createHash } from "node:crypto";
import type { BetterAuthRateLimitStorage } from "better-auth";
import { safeMonitoringErrorMetadata } from "@werewolf/shared";
import {
  BoundedMemoryRateLimitStore,
  type SharedRateLimitBackend,
} from "./rate-limit";

export interface RedisEvalClient {
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
}

interface RedisRateLimitBackendOptions {
  client: RedisEvalClient;
  namespace: string;
  maxFallbackEntries?: number;
  outageMode?: RedisOutageMode;
  onError?: (error: unknown) => void;
}

export type RedisOutageMode = "deny" | "memory";

const FIXED_WINDOW_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
local ttl = redis.call("PTTL", KEYS[1])
if count == 1 or ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`;

export class RedisUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RedisUnavailableError";
  }
}

export function isRedisUnavailableError(error: unknown): error is RedisUnavailableError {
  return error instanceof RedisUnavailableError;
}

export function createRedisRateLimitBackend({
  client,
  namespace,
  maxFallbackEntries = 10_000,
  outageMode = "memory",
  onError = defaultRedisErrorReporter(outageMode),
}: RedisRateLimitBackendOptions): SharedRateLimitBackend {
  const fallback = new BoundedMemoryRateLimitStore(maxFallbackEntries);
  let lastErrorReportAt = Number.NEGATIVE_INFINITY;

  return {
    async consume(input) {
      let reply: unknown;
      try {
        reply = await client.eval(FIXED_WINDOW_SCRIPT, {
          keys: [redisRateLimitKey(namespace, input.key)],
          arguments: [String(input.windowMs)],
        });
      } catch (error) {
        if (!isRedisUnavailableError(error)) {
          throw error;
        }
        if (input.now - lastErrorReportAt >= 60_000) {
          lastErrorReportAt = input.now;
          onError(error);
        }
        if (outageMode === "deny") {
          return {
            allowed: false,
            retryAfterSeconds: 5,
          };
        }
        return fallback.consume(input);
      }

      const [count, ttlMs] = parseFixedWindowReply(reply);
      return count <= input.limit
        ? { allowed: true }
        : {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1_000)),
          };
    },
  };
}

export function createBetterAuthRateLimitStorage(
  backend: SharedRateLimitBackend,
): BetterAuthRateLimitStorage {
  return {
    async consume(key, rule) {
      const result = await backend.consume({
        key,
        limit: rule.max,
        windowMs: rule.window * 1_000,
        now: Date.now(),
      });
      return result.allowed
        ? { allowed: true, retryAfter: null }
        : {
            allowed: false,
            retryAfter: result.retryAfterSeconds,
          };
    },
  };
}

function redisRateLimitKey(namespace: string, key: string) {
  const digest = createHash("sha256").update(key).digest("hex");
  return `wm:rate:${namespace}:${digest}`;
}

function parseFixedWindowReply(reply: unknown): [count: number, ttlMs: number] {
  if (!Array.isArray(reply) || reply.length < 2) {
    throw new Error("Redis върна невалиден rate-limit отговор.");
  }
  const count = Number(reply[0]);
  const ttlMs = Number(reply[1]);
  if (!Number.isFinite(count) || !Number.isFinite(ttlMs) || count < 1 || ttlMs < 0) {
    throw new Error("Redis върна невалидни rate-limit стойности.");
  }
  return [count, ttlMs];
}

function defaultRedisErrorReporter(outageMode: RedisOutageMode) {
  return (error: unknown) => {
    const action = outageMode === "deny"
      ? "Заявката е отказана."
      : "Използва се локален fallback.";
    console.error(
      `[redis-rate-limit] Redis е недостъпен. ${action}`,
      safeMonitoringErrorMetadata(error),
    );
  };
}
