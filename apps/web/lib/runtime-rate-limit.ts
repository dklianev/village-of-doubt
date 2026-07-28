import { createClient, type RedisClientType } from "redis";
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
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
}

interface RuntimeRedisReadinessClient {
  readonly isReady: boolean;
  ping(): Promise<string>;
}

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

        await withRedisTimeout(connection, timeoutMs, "Redis връзката изтече.");
        client = getClient();
        if (!client?.isReady) {
          throw new RedisUnavailableError("Redis още не е готов.");
        }
      }

      try {
        return await withRedisTimeout(
          client.eval(script, options),
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
        await withRedisTimeout(connection, timeoutMs, "Redis връзката изтече.");
        client = getClient();
      }

      if (!client?.isReady) {
        return false;
      }

      return await withRedisTimeout(
        client.ping().then((response) => response === "PONG"),
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
      console.error("[redis] Връзката не можа да бъде установена.", error);
    });
  return client;
}

async function withRedisTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        reject(new RedisUnavailableError(message));
      }, timeoutMs);
      timeout.unref?.();
    });
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
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
  ].includes(code) || /socket (?:closed|ended)|client is closed/i.test(error.message);
}
