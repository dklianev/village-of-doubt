import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema.js";

type SqlClient = ReturnType<typeof postgres>;

interface DatabasePoolEntry {
  client: SqlClient;
  database: Database;
}

interface DatabaseGlobal {
  __werewolfDatabasePools?: Map<string, DatabasePoolEntry>;
}

const databaseGlobal = globalThis as typeof globalThis & DatabaseGlobal;
const databasePools = (databaseGlobal.__werewolfDatabasePools ??= new Map());

export function createDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL липсва.");
  }

  const existing = databasePools.get(databaseUrl);
  if (existing) {
    return existing.database;
  }

  const client = postgres(databaseUrl, {
    max: readPositiveInteger("DATABASE_POOL_MAX", 8),
    idle_timeout: readPositiveInteger("DATABASE_IDLE_TIMEOUT_SECONDS", 30),
    connect_timeout: readPositiveInteger("DATABASE_CONNECT_TIMEOUT_SECONDS", 5),
    max_lifetime: readPositiveInteger("DATABASE_MAX_LIFETIME_SECONDS", 30 * 60),
    prepare: false,
    connection: {
      statement_timeout: 15_000,
    },
    onnotice: (notice) => {
      const severity = notice.severity ?? notice.severity_local;
      if (severity && ["WARNING", "ERROR", "FATAL", "PANIC"].includes(severity)) {
        console.error("[db-pool]", notice.message ?? notice);
      }
    },
  });

  const database = createDrizzleDatabase(client);
  databasePools.set(databaseUrl, { client, database });
  return database;
}

export async function closeDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    return false;
  }

  const entry = databasePools.get(databaseUrl);
  if (!entry) {
    return false;
  }

  databasePools.delete(databaseUrl);
  await entry.client.end({
    timeout: readPositiveInteger("DATABASE_CLOSE_TIMEOUT_SECONDS", 5),
  });
  return true;
}

export async function closeAllDatabases() {
  const entries = [...databasePools.values()];
  databasePools.clear();
  await Promise.all(
    entries.map((entry) =>
      entry.client.end({
        timeout: readPositiveInteger("DATABASE_CLOSE_TIMEOUT_SECONDS", 5),
      }),
    ),
  );
}

export async function checkDatabaseReadiness(
  db: Database,
  timeoutMs = readPositiveInteger("DATABASE_READINESS_TIMEOUT_MS", 1_500),
): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      db.execute(sql`SELECT 1`).then(() => true, () => false),
      new Promise<false>((resolve) => {
        timeout = setTimeout(() => resolve(false), Math.max(1, timeoutMs));
        timeout.unref?.();
      }),
    ]);
  } catch {
    return false;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function createDrizzleDatabase(client: SqlClient) {
  return drizzle(client, { schema });
}

function readPositiveInteger(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export type Database = ReturnType<typeof createDrizzleDatabase>;
