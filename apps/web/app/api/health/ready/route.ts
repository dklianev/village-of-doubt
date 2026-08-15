import { checkDatabaseReadiness, createDatabase } from "@werewolf/database";
import { checkRuntimeRedisReadiness } from "@/lib/runtime-rate-limit";

const GAME_SERVER_READINESS_TIMEOUT_MS = 1_500;
const READINESS_CACHE_TTL_MS = 15_000;
const loadCachedReadiness = createReadinessLoader(loadDeepReadiness, READINESS_CACHE_TTL_MS);

export async function GET() {
  const ready = process.env.NODE_ENV === "test"
    ? await loadDeepReadiness()
    : await loadCachedReadiness();

  return Response.json(
    {
      ok: ready,
      service: "werewolf-web",
      kind: "readiness",
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

async function loadDeepReadiness() {
  const databaseUrl = process.env.DATABASE_URL;
  let databaseReady = false;

  if (databaseUrl) {
    try {
      databaseReady = await checkDatabaseReadiness(createDatabase(databaseUrl));
    } catch {
      databaseReady = false;
    }
  }

  const gameServerReady = await checkGameServerReadiness(process.env.GAME_SERVER_HTTP_URL);
  const redisReady = await checkRuntimeRedisReadiness();
  return databaseReady && gameServerReady && redisReady;
}

export function createReadinessLoader(
  probe: () => Promise<boolean>,
  ttlMs: number,
  now: () => number = Date.now,
) {
  let cached: { value: boolean; expiresAt: number } | null = null;
  let pending: Promise<boolean> | null = null;

  return async () => {
    const currentTime = now();
    if (cached && cached.expiresAt > currentTime) {
      return cached.value;
    }
    if (pending) {
      return pending;
    }

    pending = probe()
      .then((value) => {
        cached = { value, expiresAt: now() + ttlMs };
        return value;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
}

async function checkGameServerReadiness(baseUrl: string | undefined) {
  if (!baseUrl?.trim()) {
    return process.env.NODE_ENV !== "production";
  }

  try {
    const readinessUrl = new URL("/health/ready", baseUrl);
    if (readinessUrl.protocol !== "http:" && readinessUrl.protocol !== "https:") {
      return false;
    }

    const response = await fetch(readinessUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(GAME_SERVER_READINESS_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
