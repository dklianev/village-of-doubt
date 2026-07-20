import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const drizzleDir = path.join(root, "packages", "database", "drizzle");
const oldMigration = "0005_sparkling_christian_walker.sql";
const oldTimestamp = 1784320024474;

test("keeps the applied 0005 migration and snapshot byte-for-byte", () => {
  const currentMigration = readFileSync(path.join(drizzleDir, oldMigration));
  const currentSnapshot = readFileSync(path.join(drizzleDir, "meta", "0005_snapshot.json"));
  const trackedMigration = execFileSync("git", ["show", `HEAD:packages/database/drizzle/${oldMigration}`], { cwd: root });
  const trackedSnapshot = execFileSync("git", ["show", "HEAD:packages/database/drizzle/meta/0005_snapshot.json"], { cwd: root });

  assert.deepEqual(currentMigration, trackedMigration);
  assert.deepEqual(currentSnapshot, trackedSnapshot);
});

test("appends new migrations after the applied 0005 timestamp", () => {
  const journal = JSON.parse(readFileSync(path.join(drizzleDir, "meta", "_journal.json"), "utf8"));
  const applied = journal.entries.find((entry) => entry.idx === 5);
  const appended = journal.entries.filter((entry) => entry.idx > 5);

  assert.deepEqual(applied, {
    idx: 5,
    version: "7",
    when: oldTimestamp,
    tag: "0005_sparkling_christian_walker",
    breakpoints: true,
  });
  assert.deepEqual(appended.map((entry) => entry.tag), ["0006_smooth_shatterstar"]);
  assert.ok(appended.every((entry) => entry.when > oldTimestamp));
});

test("migration rehearsal uses Drizzle's applied-migrations table", () => {
  const source = readFileSync(path.join(root, "scripts", "test-migrations.mjs"), "utf8");

  assert.match(source, /drizzle-orm\/postgres-js\/migrator/);
  assert.match(source, /drizzle\.__drizzle_migrations/);
  assert.match(source, /"avatarId"/);
  assert.match(source, /"playerIndex"/);
  assert.doesNotMatch(source, /applyMigrationFiles/);
});

test("refuses destructive migration tests against an unconfirmed database", () => {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "test-migrations.mjs")], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      TEST_DATABASE_URL: "postgres://postgres:postgres@localhost:5432/werewolf",
      UPGRADE_TEST_DATABASE_URL: "postgres://postgres:postgres@localhost:5432/werewolf_upgrade",
      CONFLICT_TEST_DATABASE_URL: "postgres://postgres:postgres@localhost:5432/werewolf_conflict",
      MIGRATION_TEST_VALIDATE_ONLY: "1",
      MIGRATION_TEST_CONFIRM_DATABASES: "",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing destructive migration test.*werewolf/i);
});

test("accepts exact confirmations for nonstandard test database names", () => {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "test-migrations.mjs")], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      TEST_DATABASE_URL: "postgres://postgres:postgres@localhost:5432/werewolf_rehearsal",
      UPGRADE_TEST_DATABASE_URL: "postgres://postgres:postgres@localhost:5432/werewolf_rehearsal_upgrade",
      CONFLICT_TEST_DATABASE_URL: "postgres://postgres:postgres@localhost:5432/werewolf_rehearsal_conflict",
      MIGRATION_TEST_VALIDATE_ONLY: "1",
      MIGRATION_TEST_CONFIRM_DATABASES: "werewolf_rehearsal,werewolf_rehearsal_upgrade,werewolf_rehearsal_conflict",
    },
  });

  assert.equal(result.status, 0, result.stderr);
});

test("0006 rejects conflicting player state before deduplicating retry rows", () => {
  const migration = readFileSync(path.join(drizzleDir, "0006_smooth_shatterstar.sql"), "utf8");

  assert.match(migration, /Conflicting duplicate game_players/);
  assert.match(migration, /count\(DISTINCT ROW\(/i);
  assert.match(migration, /RAISE EXCEPTION/);
});
