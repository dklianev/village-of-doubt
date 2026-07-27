import { createClient, type RedisClientType } from "redis";
import { createMemoryRateLimitBackend } from "./rate-limit";
import {
  createRedisRateLimitBackend,
  RedisUnavailableError,
  type RedisEvalClient,
} from "./redis-rate-limit";

const backends = new Map<string, ReturnType<typeof createMemoryRateLimitBackend>>();
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

export function getRuntimeRateLimitBackend(namespace: string) {
  const existing = backends.get(namespace);
  if (existing) {
    return existing;
  }

  const backend = process.env.REDIS_URL
    ? createRedisRateLimitBackend({
        namespace,
        client: createRuntimeRedisEvalClient(() => getOrCreateRedisClient(process.env.REDIS_URL)),
      })
    : createMemoryRateLimitBackend();
  backends.set(namespace, backend);
  return backend;
}

function getOrCreateRedisClient(url: string | undefined) {
  if (!url) {
    return null;
  }
  if (redisClient) {
    return redisClient;
  }

  const client = createClient({
    url,
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
