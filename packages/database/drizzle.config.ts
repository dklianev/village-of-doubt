import { defineConfig } from "drizzle-kit";

export function migrationDatabaseUrl(databaseUrl: string, pgOptions = process.env.PGOPTIONS) {
  const url = new URL(databaseUrl);
  // Postgres.js ignores the libpq environment, but forwards URL options at startup.
  url.searchParams.set("options", pgOptions ?? "-c lock_timeout=5000 -c statement_timeout=300000 -c idle_in_transaction_session_timeout=300000");
  for (const setting of ["lock_timeout", "statement_timeout", "idle_in_transaction_session_timeout"]) {
    url.searchParams.delete(setting);
  }
  return url.toString();
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationDatabaseUrl(process.env.DATABASE_URL ?? "postgres://werewolf:dev@localhost:5432/werewolf"),
  },
});
