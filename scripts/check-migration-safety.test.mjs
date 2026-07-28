import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateMigrationSafety,
  findBlockedOperations,
} from "./check-migration-safety.mjs";

function fixture(sql, approval) {
  return {
    journal: {
      entries: [{ tag: "0001_baseline" }, { tag: "0002_candidate" }],
    },
    migrations: {
      "0001_baseline": "CREATE TABLE legacy (id text);",
      "0002_candidate": sql,
    },
    policy: {
      schemaVersion: 1,
      baselineTag: "0001_baseline",
      approvedDestructiveMigrations: approval
        ? { "0002_candidate": approval }
        : {},
    },
  };
}

test("accepts additive expand migrations", () => {
  const results = evaluateMigrationSafety(
    fixture('ALTER TABLE "user" ADD COLUMN "avatar_id" text; CREATE INDEX "avatar_idx" ON "user" ("avatar_id");'),
  );
  assert.deepEqual(results, [{ tag: "0002_candidate", findings: [], approved: false }]);
});

test("rejects destructive schema and data operations by default", () => {
  for (const sql of [
    "ALTER TABLE games DROP COLUMN legacy;",
    "ALTER TABLE games RENAME COLUMN code TO room_code;",
    "ALTER TABLE games ALTER COLUMN code TYPE varchar(12);",
    "DELETE FROM games;",
  ]) {
    assert.throws(() => evaluateMigrationSafety(fixture(sql)), /rollback-breaking operations/);
  }
});

test("permits an explicit reviewed maintenance exception", () => {
  const results = evaluateMigrationSafety(
    fixture("ALTER TABLE games DROP COLUMN legacy;", {
      mode: "maintenance",
      backupRequired: true,
      reason: "The contract window has closed after two complete releases.",
      rollbackPlan: "Restore the pre-release backup into a new database and verify it before switching traffic.",
    }),
  );
  assert.equal(results[0]?.approved, true);
});

test("ignores blocked words inside SQL comments", () => {
  assert.deepEqual(
    findBlockedOperations("-- Never DROP TABLE here.\nALTER TABLE games ADD COLUMN note text;"),
    [],
  );
});
