import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("explicit persistence gate rejects missing or non-test database URLs without exposing them", () => {
  for (const url of ["", "not-a-url", "https://user:synthetic-secret@localhost/app_test", "postgres://user:synthetic-secret@localhost/production"]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./test-postgres.mjs", import.meta.url))], {
      env: { ...process.env, TEST_DATABASE_URL: url },
      encoding: "utf8", timeout: 10_000, windowsHide: true,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /dedicated migrated test database/);
    assert.ok(!(result.stdout + result.stderr).includes("synthetic-secret"));
  }
});
