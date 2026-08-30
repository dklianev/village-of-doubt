import { createClient, type RedisClientType } from "redis";
import { randomUUID } from "node:crypto";
import { safeMonitoringErrorMetadata } from "@werewolf/shared";
import { resolveRedisUrl } from "@werewolf/shared/server";
import {
  createMemoryRateLimitBackend,
  type SharedRateLimitBackend,
} from "./rate-limit";
import {
  createRedisRateLimitBackend,
  RedisUnavailableError,
  type RedisEvalClient,
  type RedisOutageMode,
} from "./redis-rate-limit";

const backends = new Map<string, SharedRateLimitBackend>();
let redisClient: RedisClientType | null = null;
let redisConnectPromise: Promise<void> | null = null;
const REDIS_COMMAND_TIMEOUT_MS = 500;

interface RuntimeRedisClient {
  readonly isReady: boolean;
  withAbortSignal?(signal: AbortSignal): RuntimeRedisClient;
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
}

interface RuntimeRedisReadinessClient {
  readonly isReady: boolean;
  withAbortSignal?(signal: AbortSignal): RuntimeRedisReadinessClient;
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
}

interface RuntimeRedisPublishClient {
  readonly isReady: boolean;
  withAbortSignal?(signal: AbortSignal): RuntimeRedisPublishClient;
  publish(channel: string, message: string): Promise<number>;
}

interface RuntimeRedisValueClient {
  readonly isReady: boolean;
  withAbortSignal?(signal: AbortSignal): RuntimeRedisValueClient;
  set(key: string, value: string, options: { expiration: { type: "PX"; value: number } }): Promise<unknown>;
}

const REDIS_READINESS_SCRIPT = `
local written = redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2], 'NX')
if not written then
  return false
end
local value = redis.call('GET', KEYS[1])
redis.call('DEL', KEYS[1])
return value
`;

export function createRuntimeRedisEvalClient(
  getClient: () => RuntimeRedisClient | null,
  timeoutMs = REDIS_COMMAND_TIMEOUT_MS,
  waitUntilReady?: () => Promise<void> | null,
): RedisEvalClient {
  return {
    async eval(script, options) {
      let client = getClient();
      if (!client?.isReady) {
        const connection = waitUntilReady?.();
        if (!connection) {
          throw new RedisUnavailableError("Redis още не е готов.");
        }

        await withRedisTimeout(() => connection, timeoutMs, "Redis връзката изтече.");
        client = getClient();
        if (!client?.isReady) {
          throw new RedisUnavailableError("Redis още не е готов.");
        }
      }

      try {
        return await withRedisTimeout(
          (signal) => bindRedisAbortSignal(client, signal).eval(script, options),
          timeoutMs,
          "Redis командата изтече.",
        );
      } catch (error) {
        if (error instanceof RedisUnavailableError) {
          throw error;
        }
        if (isRedisConnectivityError(error)) {
          throw new RedisUnavailableError("Redis връзката прекъсна.", { cause: error });
        }
        throw error;
      }
    },
  };
}

export function getRuntimeRateLimitBackend(
  namespace: string,
  {
    outageMode = process.env.NODE_ENV === "production" ? "deny" : "memory",
  }: { outageMode?: RedisOutageMode } = {},
) {
  const cacheKey = `${namespace}:${outageMode}`;
  const existing = backends.get(cacheKey);
  if (existing) {
    return existing;
  }

  const backend = process.env.REDIS_URL
      ? createRedisRateLimitBackend({
        namespace,
        client: createRuntimeRedisEvalClient(
          () => getOrCreateRedisClient(process.env.REDIS_URL),
          REDIS_COMMAND_TIMEOUT_MS,
          () => redisConnectPromise,
        ),
        outageMode,
      })
    : outageMode === "deny"
      ? createUnavailableRateLimitBackend()
      : createMemoryRateLimitBackend();
  backends.set(cacheKey, backend);
  return backend;
}

export function createRuntimeRedisReadinessProbe(
  getClient: () => RuntimeRedisReadinessClient | null,
  timeoutMs = REDIS_COMMAND_TIMEOUT_MS,
  waitUntilReady?: () => Promise<void> | null,
) {
  return async () => {
    try {
      let client = getClient();
      if (!client?.isReady) {
        const connection = waitUntilReady?.();
        if (!connection) {
          return false;
        }
        await withRedisTimeout(() => connection, timeoutMs, "Redis връзката изтече.");
        client = getClient();
      }

      if (!client?.isReady) {
        return false;
      }

      const key = `wm:health:web:${randomUUID()}`;
      return await withRedisTimeout(
        (signal) => bindRedisAbortSignal(client, signal)
          .eval(REDIS_READINESS_SCRIPT, {
            keys: [key],
            arguments: ["ready", "5000"],
          })
          .then((response) => response === "ready"),
        timeoutMs,
        "Redis readiness проверката изтече.",
      );
    } catch {
      return false;
    }
  };
}

export async function checkRuntimeRedisReadiness(
  timeoutMs = REDIS_COMMAND_TIMEOUT_MS,
) {
  if (!process.env.REDIS_URL) {
    return process.env.NODE_ENV !== "production";
  }

  try {
    return await createRuntimeRedisReadinessProbe(
      () => getOrCreateRedisClient(process.env.REDIS_URL),
      timeoutMs,
      () => redisConnectPromise,
    )();
  } catch {
    return false;
  }
}

export function createRuntimeRedisPublisher(
  getClient: () => RuntimeRedisPublishClient | null,
  timeoutMs = REDIS_COMMAND_TIMEOUT_MS,
  waitUntilReady?: () => Promise<void> | null,
) {
  return async (channel: string, message: string) => {
    let client = getClient();
    if (!client?.isReady) {
      const connection = waitUntilReady?.();
      if (!connection) {
        throw new RedisUnavailableError("Redis още не е готов.");
      }
      await withRedisTimeout(() => connection, timeoutMs, "Redis връзката изтече.");
      client = getClient();
    }
    if (!client?.isReady) {
      throw new RedisUnavailableError("Redis още не е готов.");
    }
    return withRedisTimeout(
      (signal) => bindRedisAbortSignal(client, signal).publish(channel, message),
      timeoutMs,
      "Redis publish командата изтече.",
    );
  };
}

export function createRuntimeRedisValueWriter(
  getClient: () => RuntimeRedisValueClient | null,
  timeoutMs = REDIS_COMMAND_TIMEOUT_MS,
  waitUntilReady?: () => Promise<void> | null,
) {
  return async (key: string, value: string, ttlMs: number) => {
    let client = getClient();
    if (!client?.isReady) {
      const connection = waitUntilReady?.();
      if (!connection) throw new RedisUnavailableError("Redis още не е готов.");
      await withRedisTimeout(() => connection, timeoutMs, "Redis връзката изтече.");
      client = getClient();
    }
    if (!client?.isReady) throw new RedisUnavailableError("Redis още не е готов.");
    return withRedisTimeout(
      (signal) => bindRedisAbortSignal(client, signal)
        .set(key, value, { expiration: { type: "PX", value: ttlMs } }),
      timeoutMs,
      "Redis write командата изтече.",
    );
  };
}

export async function writeRuntimeRedisValue(key: string, value: string, ttlMs: number) {
  if (!process.env.REDIS_URL) {
    if (process.env.NODE_ENV === "production") throw new RedisUnavailableError("Production Redis не е конфигуриран.");
    return null;
  }
  return createRuntimeRedisValueWriter(
    () => getOrCreateRedisClient(process.env.REDIS_URL),
    REDIS_COMMAND_TIMEOUT_MS,
    () => redisConnectPromise,
  )(key, value, ttlMs);
}

export async function publishRuntimeRedisMessage(channel: string, message: string) {
  if (!process.env.REDIS_URL) {
    if (process.env.NODE_ENV === "production") {
      throw new RedisUnavailableError("Production Redis не е конфигуриран.");
    }
    return 0;
  }
  return createRuntimeRedisPublisher(
    () => getOrCreateRedisClient(process.env.REDIS_URL),
    REDIS_COMMAND_TIMEOUT_MS,
    () => redisConnectPromise,
  )(channel, message);
}

function createUnavailableRateLimitBackend(): SharedRateLimitBackend {
  return {
    async consume() {
      return {
        allowed: false,
        retryAfterSeconds: 5,
      };
    },
  };
}

export function resolveRuntimeRedisUrl(
  url: string,
  passwordFile: string | undefined,
  nodeEnv = process.env.NODE_ENV,
) {
  const parsedUrl = new URL(url);
  if (nodeEnv === "production" && !parsedUrl.password && !passwordFile) {
    throw new Error("Production Redis изисква автентикация.");
  }
  return resolveRedisUrl(url, passwordFile);
}

function getOrCreateRedisClient(url: string | undefined) {
  if (!url) {
    return null;
  }
  if (redisClient) {
    return redisClient;
  }

  const authenticatedUrl = resolveRuntimeRedisUrl(url, process.env.REDIS_PASSWORD_FILE);
  const client = createClient({
    url: authenticatedUrl,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 1_500,
      reconnectStrategy(retries) {
        return Math.min(100 * 2 ** Math.min(retries, 5), 3_000);
      },
    },
  });
  client.on("error", () => {
    // Operational errors are reported by the consuming backend at a bounded rate.
  });
  redisClient = client;
  const connection = client.connect().then(() => undefined);
  redisConnectPromise = connection;
  void connection
    .catch((error) => {
      client.destroy();
      if (redisClient === client) {
        redisClient = null;
      }
      if (redisConnectPromise === connection) {
        redisConnectPromise = null;
      }
      console.error("[redis] Връзката не можа да бъде установена.", safeMonitoringErrorMetadata(error));
    });
  return client;
}

async function withRedisTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  message: string,
) {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: (value: T | unknown) => void, value: T | unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeoutError = new RedisUnavailableError(message);
    const timeout = setTimeout(() => {
      controller.abort(timeoutError);
      finish(reject, timeoutError);
    }, Math.max(0, timeoutMs));
    timeout.unref?.();

    try {
      operation(controller.signal).then(
        (value) => finish(resolve as (value: T | unknown) => void, value),
        (error) => finish(reject, controller.signal.aborted ? timeoutError : error),
      );
    } catch (error) {
      finish(reject, error);
    }
  });
}

function bindRedisAbortSignal<T extends { withAbortSignal?(signal: AbortSignal): T }>(
  client: T,
  signal: AbortSignal,
) {
  return client.withAbortSignal?.(signal) ?? client;
}

function isRedisConnectivityError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  return [
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENETUNREACH",
    "EHOSTUNREACH",
    "EPIPE",
  ].includes(code) || /socket (?:closed|ended)|client is closed|OOM command not allowed|noeviction/i.test(error.message);
}
