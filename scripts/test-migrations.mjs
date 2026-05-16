import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const root = process.cwd();
const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/werewolf_test";
const databaseRequire = createRequire(path.join(root, "packages/database/package.json"));
const postgres = databaseRequire("postgres");

async function recreateTestDb() {
  const adminUrl = TEST_DB_URL.replace(/\/[^/]+$/, "/postgres");
  const dbName = new URL(TEST_DB_URL).pathname.slice(1);
  const sql = postgres(adminUrl, { max: 1 });
  await sql.unsafe(`DROP DATABASE IF EXISTS ${quoteIdent(dbName)}`);
  await sql.unsafe(`CREATE DATABASE ${quoteIdent(dbName)}`);
  await sql.end();
}

function runMigrations() {
  const result = spawnSync("pnpm", ["--filter", "@werewolf/database", "db:migrate"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  return result.status === 0;
}

async function verifySchema() {
  const sql = postgres(TEST_DB_URL, { max: 1 });
  const rows = await sql`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  `;
  await sql.end();

  const tables = rows.map((row) => row.table_name);
  const expected = ["user", "session", "account", "verification", "games", "game_events", "game_players", "user_achievements"];
  const missing = expected.filter((table) => !tables.includes(table));
  if (missing.length > 0) {
    console.error("Липсващи таблици:", missing.join(", "));
    return false;
  }
  return true;
}

try {
  console.log("▶ Пресъздавам test database...");
  await recreateTestDb();

  console.log("▶ Пускам migrations...");
  if (!runMigrations()) {
    throw new Error("Migrations failed");
  }

  console.log("▶ Проверявам schema...");
  if (!(await verifySchema())) {
    throw new Error("Schema verification failed");
  }

  console.log("✓ Migration tests passed");
} catch (error) {
  console.error("✗ Migration tests failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function quoteIdent(value) {
  return `"${value.replace(/"/g, '""')}"`;
}
