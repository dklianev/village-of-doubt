import { checkDatabaseReadiness, createDatabase } from "@werewolf/database";

export const dynamic = "force-dynamic";

const GAME_SERVER_READINESS_TIMEOUT_MS = 1_500;

export async function GET() {
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
  const ready = databaseReady && gameServerReady;

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
