import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

export function assertMigrationHistory(rows, migrations, entries, expectedHead) {
  if (rows.length > migrations.length || rows.some((row, index) =>
    row.hash !== migrations[index].hash || Number(row.created_at) !== entries[index].when
  )) {
    throw new Error("Database migration history does not match the signed migrator artifact.");
  }
  if (expectedHead && entries[rows.length - 1]?.tag !== expectedHead) {
    throw new Error("Database migration head does not match the signed schema head.");
  }
}

async function migrationHistory(sql) {
  const [table] = await sql`SELECT to_regclass('drizzle.__drizzle_migrations') AS name`;
  return table.name
    ? sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at, id`
    : [];
}

export async function runMigrations({
  databaseUrl,
  expectedHead,
  backupHead,
  migrationsFolder = fileURLToPath(new URL("./drizzle", import.meta.url)),
}) {
  const { entries } = JSON.parse(readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8"));
  const migrations = readMigrationFiles({ migrationsFolder });
  if (!expectedHead || entries.at(-1)?.tag !== expectedHead) {
    throw new Error("Signed release migration head does not match the migrator artifact.");
  }
  if (backupHead && !entries.some((entry) => entry.tag === backupHead)) {
    throw new Error("Signed backup schema is not supported by the selected migrator artifact.");
  }
  const sql = postgres(databaseUrl, { max: 1, onnotice() {} });
  try {
    const settings = await sql`
      SELECT name, setting FROM pg_settings
      WHERE name IN ('lock_timeout', 'statement_timeout', 'idle_in_transaction_session_timeout')
    `;
    if (settings.length !== 3 || settings.some(({ setting }) => !(Number(setting) > 0))) {
      throw new Error("Migration SQL timeouts must be enabled on the actual connection.");
    }
    assertMigrationHistory(await migrationHistory(sql), migrations, entries, backupHead);
    await migrate(drizzle(sql), { migrationsFolder });
    assertMigrationHistory(await migrationHistory(sql), migrations, entries, expectedHead);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const { default: config } = await import("./drizzle.config.ts");
    await runMigrations({
      databaseUrl: config.dbCredentials.url,
      expectedHead: process.env.MIGRATION_HEAD,
      backupHead: process.env.RESTORE_BACKUP_MIGRATION_HEAD,
    });
  } catch {
    // Driver errors can contain SQL or credentials; operational logs stay private-data free.
    console.error("Migration failed: schema provenance, SQL timeout, or migration execution check failed.");
    process.exitCode = 1;
  }
}
