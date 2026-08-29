import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const drizzleDir = path.join(root, "packages", "database", "drizzle");
const policy = JSON.parse(readFileSync(path.join(drizzleDir, "migration-policy.json"), "utf8"));
const policyBaselineIndex = 7;
const policyBaselineTimestamp = 1784497305534;
const policyBaselineTag = "0007_cuddly_felicia_hardy";

test("keeps the migration-safety baseline byte-for-byte", () => {
  const baselineMigration = `${policyBaselineTag}.sql`;
  const baselineSnapshot = `meta/${String(policyBaselineIndex).padStart(4, "0")}_snapshot.json`;
  const currentMigration = readFileSync(path.join(drizzleDir, baselineMigration));
  const currentSnapshot = readFileSync(path.join(drizzleDir, baselineSnapshot));
  const trackedMigration = execFileSync("git", ["show", `HEAD:packages/database/drizzle/${baselineMigration}`], { cwd: root });
  const trackedSnapshot = execFileSync("git", ["show", `HEAD:packages/database/drizzle/${baselineSnapshot}`], { cwd: root });

  assert.deepEqual(currentMigration, trackedMigration);
  assert.deepEqual(currentSnapshot, trackedSnapshot);
});

test("appends reviewed migrations after the safety-policy baseline", () => {
  const journal = JSON.parse(readFileSync(path.join(drizzleDir, "meta", "_journal.json"), "utf8"));
  const applied = journal.entries.find((entry) => entry.idx === policyBaselineIndex);
  const appended = journal.entries.filter((entry) => entry.idx > policyBaselineIndex);

  assert.deepEqual(applied, {
    idx: policyBaselineIndex,
    version: "7",
    when: policyBaselineTimestamp,
    tag: policyBaselineTag,
    breakpoints: true,
  });
  assert.equal(policy.baselineTag, policyBaselineTag);
  assert.deepEqual(appended.map((entry) => entry.tag), [
    "0008_steady_edwin_jarvis",
    "0009_certain_iron_man",
    "0010_complete_triton",
    "0011_account_deletion_boundary",
    "0012_soft_alex_power",
    "0013_hesitant_blur",
  ]);
  assert.ok(appended.every((entry) => entry.when > policyBaselineTimestamp));
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
