import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const posixShell = process.env.POSIX_SHELL || "/bin/sh";
const isPosix = process.platform !== "win32" || Boolean(process.env.POSIX_SHELL);
const library = path.resolve("scripts/deploy-operations-lib.sh").replaceAll("\\", "/");

function runProbe(directory, body) {
  const probe = path.join(directory, "probe.sh");
  writeFileSync(probe, "#!/bin/sh\nset -eu\n. \"$OPERATIONS_LIBRARY\"\n" + body + "\n", { mode: 0o755 });
  return spawnSync(posixShell, [probe.replaceAll("\\", "/")], {
    encoding: "utf8",
    env: {
      ...process.env,
      OPERATIONS_LIBRARY: library,
      OPERATIONS_LOCK_DIR: path.join(directory, "operations.lock").replaceAll("\\", "/"),
    },
  });
}

test("the host operation lock is exclusive and is removed only by its owner", { skip: !isPosix }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-ops-lock-"));
  try {
    const lockDir = path.join(directory, "operations.lock");
    const result = runProbe(directory, [
      "acquire_operations_lock deploy \"$OPERATIONS_LOCK_DIR\"",
      "test -s \"$OPERATIONS_LOCK_DIR/owner\"",
      "release_operations_lock",
      "test ! -e \"$OPERATIONS_LOCK_DIR\"",
    ].join("\n"));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(lockDir), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a contending operation fails closed and preserves the first owner's evidence", { skip: !isPosix }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-ops-lock-"));
  try {
    const lockDir = path.join(directory, "operations.lock");
    mkdirSync(lockDir);
    writeFileSync(path.join(lockDir, "owner"), "action=restore\npid=4242\nstarted_at=2026-08-27T00:00:00Z\n");

    const result = runProbe(directory, "acquire_operations_lock rollback \"$OPERATIONS_LOCK_DIR\"");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /another production operation|restore/i);
    assert.equal(existsSync(path.join(lockDir, "owner")), true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
