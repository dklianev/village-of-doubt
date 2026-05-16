import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL липсва.");
  }

  const client = postgres(databaseUrl, {
    max: 20,
    idle_timeout: 30,
    connect_timeout: 5,
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

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDatabase>;
