import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const restoreScript = path.join(root, "scripts", "restore-postgres.sh");
const runId = "review";
const stagingDb = `werewolf_restore_stage_${runId}`;
const rollbackDb = `werewolf_restore_rollback_${runId}`;

function shellInvocation() {
  const configured = process.env.POSIX_SHELL;
  if (configured) {
    return path.basename(configured).toLowerCase().startsWith("busybox")
      ? { command: configured, prefix: ["sh"] }
      : { command: configured, prefix: [] };
  }
  return process.platform === "win32" ? null : { command: "sh", prefix: [] };
}

function runRestore(failure = "", options = {}) {
  const shell = shellInvocation();
  assert.ok(shell, "Set POSIX_SHELL to run restore-postgres behavioral tests on Windows");

  const fixtureDir = mkdtempSync(path.join(root, ".restore-test-"));
  const scratchDir = path.join(fixtureDir, "tmp");
  const backupFile = path.join(fixtureDir, "backup.sql.gz");
  const fakeDocker = path.join(fixtureDir, "fake-docker.sh");
  const logFile = path.join(fixtureDir, "commands.log");
  mkdirSync(scratchDir);
  writeFileSync(backupFile, gzipSync("-- restore fixture\n"));
  writeFileSync(fakeDocker, fakeDockerSource(), { mode: 0o755 });
  chmodSync(fakeDocker, 0o755);

  const result = spawnSync(shell.command, [...shell.prefix, toShellPath(restoreScript), toShellPath(backupFile)], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      MIGRATION_DATABASE_URL:
        "postgres://werewolf_migrator:secret@postgres:5432/werewolf?application_name=werewolf-migrator",
      POSTGRES_USER: "werewolf",
      POSTGRES_DB: "werewolf",
      BACKUP_REQUIRE_SIGNATURE: "0",
      RESTORE_CONFIRM_DATABASE: "werewolf",
      RESTORE_DOCKER_COMMAND: toShellPath(fakeDocker),
      RESTORE_RUN_ID: runId,
      RESTORE_TEST_FAILURE: failure,
      RESTORE_TEST_LOG: toShellPath(logFile),
      RESTORE_ONLY: options.restoreOnly ? "1" : "",
      TMPDIR: toShellPath(scratchDir),
    },
  });
  let commands = [];
  try {
    commands = readFileSync(logFile, "utf8").trim().split(/\r?\n/).filter(Boolean);
  } catch {
    // The pre-fix script never reaches the injectable command runner.
  }
  rmSync(fixtureDir, { recursive: true, force: true });
  return { ...result, commands };
}

function fakeDockerSource() {
  return `#!/usr/bin/env sh
printf '%s\\n' "$*" >> "$RESTORE_TEST_LOG"
case "$*" in
  "compose ps --status running --services web game")
    if [ "$RESTORE_TEST_FAILURE" = "partial-writers" ]; then
      printf 'web\\n'
    else
      printf 'web\\ngame\\n'
    fi
    ;;
  *"run --rm --no-deps"*"migrate")
    printf 'migrator-database-url=%s\\n' "$MIGRATION_DATABASE_URL" >> "$RESTORE_TEST_LOG"
    [ "$RESTORE_TEST_FAILURE" = "migrate" ] && exit 41
    ;;
  *"ALTER DATABASE \\"werewolf_restore_stage_review\\" RENAME TO \\"werewolf\\""*)
    [ "$RESTORE_TEST_FAILURE" = "promote" ] || [ "$RESTORE_TEST_FAILURE" = "promote-recovery" ] && exit 42
    ;;
  *"ALTER DATABASE \\"werewolf_restore_rollback_review\\" RENAME TO \\"werewolf\\""*)
    [ "$RESTORE_TEST_FAILURE" = "promote-recovery" ] && exit 43
    ;;
  "compose up -d --no-recreate --wait --wait-timeout 180 web game")
    [ "$RESTORE_TEST_FAILURE" = "restart" ] && exit 44
    ;;
  *"psql -v ON_ERROR_STOP=1"*"-Atqc"*)
    printf 'ok\\n'
    ;;
  *"psql -v ON_ERROR_STOP=1"*"--single-transaction"*)
    cat >/dev/null
    ;;
esac
exit 0
`;
}

function toShellPath(value) {
  return value.replaceAll("\\", "/");
}

function indexOf(commands, fragment) {
  return commands.findIndex((command) => command.includes(fragment));
}

test("restores the rollback database and preserves the candidate when promotion fails", () => {
  const result = runRestore("promote");
  const renameTarget = indexOf(result.commands, `ALTER DATABASE "werewolf" RENAME TO "${rollbackDb}"`);
  const promote = indexOf(result.commands, `ALTER DATABASE "${stagingDb}" RENAME TO "werewolf"`);
  const recover = indexOf(result.commands, `ALTER DATABASE "${rollbackDb}" RENAME TO "werewolf"`);
  const dropStaging = indexOf(result.commands, `dropdb --if-exists --force -U werewolf ${stagingDb}`);

  assert.notEqual(result.status, 0);
  assert.ok(renameTarget >= 0);
  assert.ok(promote > renameTarget);
  assert.ok(recover > promote);
  assert.equal(dropStaging, -1);
  assert.equal(indexOf(result.commands, `dropdb --if-exists --force -U werewolf ${rollbackDb}`), -1);
  assert.match(result.stderr, /preserved for diagnosis/i);
});

test("preserves staging and rollback copies when rollback recovery also fails", () => {
  const result = runRestore("promote-recovery");

  assert.notEqual(result.status, 0);
  assert.equal(indexOf(result.commands, `dropdb --if-exists --force -U werewolf ${stagingDb}`), -1);
  assert.equal(indexOf(result.commands, `dropdb --if-exists --force -U werewolf ${rollbackDb}`), -1);
  assert.match(result.stderr, new RegExp(`${stagingDb}.*${rollbackDb}|${rollbackDb}.*${stagingDb}`));
});

test("preserves rollback and reports stopped writers when restart fails", () => {
  const result = runRestore("restart");
  const failedRestart = indexOf(
    result.commands,
    "compose up -d --no-recreate --wait --wait-timeout 180 web game",
  );
  const cleanupStop = result.commands.findIndex(
    (command, index) => index > failedRestart && command.includes("compose stop web game"),
  );
  const terminateTargetSessions = result.commands.findIndex(
    (command, index) =>
      index > cleanupStop
      && command.includes("pg_terminate_backend"),
  );
  const demoteCandidate = indexOf(
    result.commands,
    `ALTER DATABASE "werewolf" RENAME TO "${stagingDb}"`,
  );

  assert.notEqual(result.status, 0);
  assert.ok(indexOf(result.commands, `ALTER DATABASE "${stagingDb}" RENAME TO "werewolf"`) >= 0);
  assert.ok(failedRestart >= 0);
  assert.ok(cleanupStop > failedRestart);
  assert.ok(terminateTargetSessions > cleanupStop);
  assert.ok(demoteCandidate > terminateTargetSessions);
  assert.ok(indexOf(result.commands, `ALTER DATABASE "${rollbackDb}" RENAME TO "werewolf"`) >= 0);
  assert.equal(indexOf(result.commands, `dropdb --if-exists --force -U werewolf ${rollbackDb}`), -1);
  assert.equal(indexOf(result.commands, `dropdb --if-exists --force -U werewolf ${stagingDb}`), -1);
  assert.match(result.stderr, /restart did not complete/i);
  assert.match(result.stderr, /treated as stopped|remain stopped/i);
});

test("runs the real migrator before stopping writers and removes rollback only after health verification", () => {
  const result = runRestore();
  const migrate = indexOf(result.commands, "compose run --rm --no-deps -T migrate");
  const stop = indexOf(result.commands, "compose stop web game");
  const restart = indexOf(
    result.commands,
    "compose up -d --no-recreate --wait --wait-timeout 180 web game",
  );
  const dropRollback = indexOf(result.commands, `dropdb --if-exists --force -U werewolf ${rollbackDb}`);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(migrate >= 0);
  assert.ok(
    result.commands.includes(
      `migrator-database-url=postgres://werewolf_migrator:secret@postgres:5432/${stagingDb}?application_name=werewolf-migrator`,
    ),
  );
  assert.ok(
    indexOf(result.commands, "compose run --rm --no-deps -T postgres-roles") < migrate,
  );
  assert.equal(
    result.commands.filter((command) =>
      command.includes("compose run --rm --no-deps -T postgres-roles"),
    ).length,
    2,
  );
  assert.ok(stop > migrate);
  assert.ok(restart > stop);
  assert.ok(dropRollback > restart);
});

test("leaves writers and target untouched when staging migration fails", () => {
  const result = runRestore("migrate");

  assert.notEqual(result.status, 0);
  assert.ok(indexOf(result.commands, "compose run --rm --no-deps") >= 0);
  assert.equal(indexOf(result.commands, "compose stop web game"), -1);
  assert.equal(indexOf(result.commands, "ALTER DATABASE"), -1);
});

test("refuses cutover unless both application writers can be health-checked", () => {
  const result = runRestore("partial-writers");

  assert.notEqual(result.status, 0);
  assert.equal(indexOf(result.commands, "compose stop web game"), -1);
  assert.equal(indexOf(result.commands, "ALTER DATABASE"), -1);
  assert.match(result.stderr, /web and game|RESTORE_ONLY/i);
});

test("offline restore preserves rollback instead of claiming application readiness", () => {
  const result = runRestore("partial-writers", { restoreOnly: true });

  assert.equal(result.status, 0, result.stderr);
  assert.ok(indexOf(result.commands, `ALTER DATABASE "${stagingDb}" RENAME TO "werewolf"`) >= 0);
  assert.equal(
    indexOf(result.commands, "compose up -d --no-recreate --wait --wait-timeout 180 web game"),
    -1,
  );
  assert.equal(indexOf(result.commands, `dropdb --if-exists --force -U werewolf ${rollbackDb}`), -1);
  assert.match(result.stdout, /rollback.*preserved|preserved.*rollback/i);
});
