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
const REDIS_COMMAND_TIMEOUT_MS = 500;

interface RuntimeRedisClient {
  readonly isReady: boolean;
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
}

export function createRuntimeRedisEvalClient(
  getClient: () => RuntimeRedisClient | null,
  timeoutMs = REDIS_COMMAND_TIMEOUT_MS,
): RedisEvalClient {
  return {
    async eval(script, options) {
      const client = getClient();
      if (!client?.isReady) {
        throw new RedisUnavailableError("Redis още не е готов.");
      }

      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            reject(new RedisUnavailableError("Redis командата изтече."));
          }, timeoutMs);
          timeout.unref?.();
        });
        return await Promise.race([
          client.eval(script, options),
          timeoutPromise,
        ]);
      } catch (error) {
        if (error instanceof RedisUnavailableError) {
          throw error;
        }
        if (isRedisConnectivityError(error)) {
          throw new RedisUnavailableError("Redis връзката прекъсна.", { cause: error });
        }
        throw error;
      } finally {
        if (timeout) {
          clearTimeout(timeout);
        }
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
        client: createRuntimeRedisEvalClient(() => getOrCreateRedisClient(process.env.REDIS_URL)),
        outageMode,
      })
    : outageMode === "deny"
      ? createUnavailableRateLimitBackend()
      : createMemoryRateLimitBackend();
  backends.set(cacheKey, backend);
  return backend;
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
  void client.connect()
    .catch((error) => {
      client.destroy();
      if (redisClient === client) {
        redisClient = null;
      }
      console.error("[redis] Връзката не можа да бъде установена.", error);
    });
  return client;
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
