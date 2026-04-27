import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL липсва.");
  }

  const client = postgres(databaseUrl, {
    max: 10,
    prepare: false,
  });

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDatabase>;
