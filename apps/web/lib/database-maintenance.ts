import {
  countUnversionedOAuthTokens,
  createDatabase,
  encryptLegacyOAuthTokens,
  runDatabaseMaintenance,
  type DatabaseMaintenanceOptions,
  type DatabaseMaintenanceResult,
} from "@werewolf/database";
import {
  symmetricDecrypt,
  symmetricEncrypt,
  type SecretConfig,
} from "better-auth/crypto";
import { safeMonitoringErrorMetadata } from "@werewolf/shared";

type MaintenanceEnvironment = Record<string, string | undefined>;
type MaintenanceTimer = ReturnType<typeof setInterval>;
type BetterAuthEncryptionKey = string | SecretConfig;

const OAUTH_TOKEN_BATCH_SIZE = 100;
const OAUTH_TOKEN_MAX_BATCHES_PER_PASS = 10;
const TRANSIENT_DATABASE_MAINTENANCE_ERROR_CODES = new Set([
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_DESTROYED",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
  "08000",
  "08001",
  "08003",
  "08006",
  "08007",
  "57P01",
  "57P02",
  "57P03",
]);

interface MaintenanceRuntime {
  run: () => Promise<MaintenanceRunResult | undefined>;
  setInterval: typeof setInterval;
  logger?: MaintenanceLogger;
  now?: () => number;
}

interface MaintenanceRunResult {
  maintenance: DatabaseMaintenanceResult;
  oauthTokens: {
    accountsUpdated: number;
    tokensEncrypted: number;
    unversionedTokensRemaining: number;
  };
}

interface MaintenanceLogger {
  info: (message: string, context: Record<string, unknown>) => void;
  error: (message: string, context: Record<string, unknown>) => void;
}

export async function startDatabaseMaintenanceLoop(
  environment: MaintenanceEnvironment = process.env,
  runtime?: MaintenanceRuntime,
): Promise<MaintenanceTimer | null> {
  if (environment.NODE_ENV !== "production" || !environment.DATABASE_URL) {
    return null;
  }

  const maintenanceRuntime = runtime ?? createMaintenanceRuntime(environment);
  const intervalMs = readBoundedInteger(
    environment.DATABASE_MAINTENANCE_INTERVAL_MS,
    60 * 60 * 1_000,
    60_000,
    24 * 60 * 60 * 1_000,
  );
  const logger = maintenanceRuntime.logger ?? console;
  const now = maintenanceRuntime.now ?? Date.now;
  const runPass = async () => {
    const startedAt = now();
    try {
      const result = await maintenanceRuntime.run();
      const finishedAt = now();
      if (result) {
        logger.info("[database-maintenance]", {
          event: result.maintenance.acquired ? "completed" : "skipped",
          timestamp: new Date(finishedAt).toISOString(),
          durationMs: Math.max(0, finishedAt - startedAt),
          maintenance: result.maintenance,
          oauthTokens: result.oauthTokens,
        });
      }
      return result;
    } catch (error) {
      const finishedAt = now();
      logger.error("[database-maintenance]", {
        event: "failed",
        timestamp: new Date(finishedAt).toISOString(),
        durationMs: Math.max(0, finishedAt - startedAt),
        error: safeMonitoringErrorMetadata(error),
      });
      throw error;
    }
  };

  try {
    await runPass();
  } catch (error) {
    if (!isTransientDatabaseMaintenanceError(error)) {
      throw error;
    }
  }
  const run = () => {
    void runPass().catch(() => undefined);
  };

  const timer = maintenanceRuntime.setInterval(run, intervalMs);
  timer.unref?.();
  return timer;
}

function isTransientDatabaseMaintenanceError(error: unknown): boolean {
  let candidate = error;
  for (let depth = 0; depth < 2; depth += 1) {
    if (!candidate || typeof candidate !== "object") {
      return false;
    }

    const code = "code" in candidate ? candidate.code : undefined;
    if (typeof code === "string" && TRANSIENT_DATABASE_MAINTENANCE_ERROR_CODES.has(code)) {
      return true;
    }
    candidate = "cause" in candidate ? candidate.cause : undefined;
  }
  return false;
}

export function readDatabaseMaintenanceConfig(
  environment: MaintenanceEnvironment = process.env,
): DatabaseMaintenanceOptions {
  return {
    batchSize: readBoundedInteger(
      environment.DATABASE_MAINTENANCE_BATCH_SIZE,
      1_000,
      100,
      10_000,
    ),
    staleLobbyHours: readBoundedInteger(
      environment.DATABASE_STALE_LOBBY_HOURS,
      48,
      1,
      24 * 30,
    ),
    staleActiveHours: readBoundedInteger(
      environment.DATABASE_STALE_ACTIVE_HOURS,
      24,
      1,
      24 * 30,
    ),
    eventRetentionDays: readBoundedInteger(
      environment.DATABASE_EVENT_RETENTION_DAYS,
      730,
      0,
      3_650,
    ),
  };
}

export function resolveBetterAuthEncryptionKey(
  environment: MaintenanceEnvironment = process.env,
): BetterAuthEncryptionKey | null {
  const legacySecret = environment.BETTER_AUTH_SECRET?.trim();
  const versionedSecrets = environment.BETTER_AUTH_SECRETS?.trim();
  if (!versionedSecrets) {
    return legacySecret || null;
  }

  const keys = new Map<number, string>();
  let currentVersion: number | undefined;
  let previousVersion: number | undefined;
  for (const rawEntry of versionedSecrets.split(",")) {
    const entry = rawEntry.trim();
    const colonIndex = entry.indexOf(":");
    if (colonIndex === -1) {
      throw new Error('BETTER_AUTH_SECRETS трябва да използва формат "<version>:<secret>".');
    }

    const rawVersion = entry.slice(0, colonIndex).trim();
    const secret = entry.slice(colonIndex + 1).trim();
    if (!/^(?:0|[1-9]\d*)$/.test(rawVersion) || !secret) {
      throw new Error("BETTER_AUTH_SECRETS съдържа невалидна версия или празна тайна.");
    }

    const version = Number.parseInt(rawVersion, 10);
    if (keys.has(version)) {
      throw new Error(`BETTER_AUTH_SECRETS съдържа повторена версия ${version}.`);
    }
    if (previousVersion !== undefined && version >= previousVersion) {
      throw new Error(
        "BETTER_AUTH_SECRETS трябва да е подреден строго от най-новата към най-старата версия.",
      );
    }
    currentVersion ??= version;
    previousVersion = version;
    keys.set(version, secret);
  }

  if (currentVersion === undefined) {
    throw new Error("BETTER_AUTH_SECRETS трябва да съдържа поне една версия.");
  }

  return {
    keys,
    currentVersion,
    ...(legacySecret ? { legacySecret } : {}),
  };
}

function createMaintenanceRuntime(environment: MaintenanceEnvironment): MaintenanceRuntime {
  const db = createDatabase(environment.DATABASE_URL);
  const options = readDatabaseMaintenanceConfig(environment);
  const encryptionKey = resolveBetterAuthEncryptionKey(environment);
  return {
    run: async () => {
      const maintenance = await runDatabaseMaintenance(db, options);
      let accountsUpdated = 0;
      let tokensEncrypted = 0;

      if (encryptionKey) {
        for (let batch = 0; batch < OAUTH_TOKEN_MAX_BATCHES_PER_PASS; batch += 1) {
          const result = await encryptLegacyOAuthTokens(
            db,
            (token) => symmetricEncrypt({ key: encryptionKey, data: token }),
            {
              batchSize: OAUTH_TOKEN_BATCH_SIZE,
              ...(typeof encryptionKey !== "string" && encryptionKey.legacySecret
                ? {
                    rewrapToken: (token: string) =>
                      rewrapLegacyOAuthToken(token, encryptionKey),
                  }
                : {}),
            },
          );
          accountsUpdated += result.accountsUpdated;
          tokensEncrypted += result.tokensEncrypted;
          if (!result.acquired || result.accountsUpdated < OAUTH_TOKEN_BATCH_SIZE) {
            break;
          }
        }
      }

      const unversionedTokensRemaining =
        typeof encryptionKey !== "string" && encryptionKey
          ? await countUnversionedOAuthTokens(db)
          : 0;
      if (
        typeof encryptionKey !== "string"
        && encryptionKey
        && !encryptionKey.legacySecret
        && unversionedTokensRemaining > 0
      ) {
        throw new Error(
          `BETTER_AUTH_SECRET не може да бъде оттеглен: ${unversionedTokensRemaining} OAuth токена още не са versioned.`,
        );
      }

      return {
        maintenance,
        oauthTokens: {
          accountsUpdated,
          tokensEncrypted,
          unversionedTokensRemaining,
        },
      };
    },
    setInterval,
  };
}

export async function rewrapLegacyOAuthToken(
  token: string,
  encryptionKey: SecretConfig,
): Promise<string> {
  const legacySecret = encryptionKey.legacySecret;
  if (!legacySecret) {
    throw new Error("Legacy OAuth token rewrap requires BETTER_AUTH_SECRET.");
  }

  let plaintext = token;
  try {
    plaintext = await symmetricDecrypt({ key: legacySecret, data: token });
  } catch {
    // A provider token may itself be hexadecimal. Preserve it as plaintext.
  }
  return symmetricEncrypt({ key: encryptionKey, data: plaintext });
}

function readBoundedInteger(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed >= minimum
    ? Math.min(parsed, maximum)
    : fallback;
}
