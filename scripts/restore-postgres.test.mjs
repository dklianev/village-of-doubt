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
  const fakeNode = path.join(fixtureDir, "fake-node.sh");
  const logFile = path.join(fixtureDir, "commands.log");
  const releaseStateDir = path.join(fixtureDir, "release-state");
  const releasePublicKey = path.join(fixtureDir, "release-manifest.pub");
  mkdirSync(scratchDir);
  mkdirSync(releaseStateDir);
  writeFileSync(backupFile, gzipSync("-- restore fixture\n"));
  writeFileSync(path.join(releaseStateDir, "current.json"), '{"signed":"active-release"}\n');
  writeFileSync(path.join(releaseStateDir, "current.json.sig"), "signed-active-release\n");
  writeFileSync(path.join(releaseStateDir, "migration-pending.json"), '{"signed":"unresolved-candidate"}\n');
  writeFileSync(path.join(releaseStateDir, "migration-pending.json.sig"), "signed-unresolved-candidate\n");
  writeFileSync(releasePublicKey, "test-public-key\n");
  writeFileSync(fakeDocker, fakeDockerSource(), { mode: 0o755 });
  writeFileSync(fakeNode, `#!/usr/bin/env sh
printf 'node %s\\n' "$*" >> "$RESTORE_TEST_LOG"
env_output=""
previous=""
for argument in "$@"; do
  if [ "$previous" = "--env-output" ]; then
    env_output="$argument"
  fi
  previous="$argument"
done
if [ -n "$env_output" ]; then
  cat > "$env_output" <<'EOF'
RELEASE_VERSION=cccccccccccccccccccccccccccccccccccccccc
WEB_IMAGE=ghcr.io/example/project/web@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
GAME_IMAGE=ghcr.io/example/project/game@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
MIGRATOR_IMAGE=ghcr.io/example/project/migrator@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
MIGRATION_HEAD=0013_restore_contract
EOF
fi
exit 0
`, { mode: 0o755 });
  chmodSync(fakeDocker, 0o755);
  chmodSync(fakeNode, 0o755);

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
      RESTORE_NODE_COMMAND: toShellPath(fakeNode),
      RESTORE_RUN_ID: runId,
      RESTORE_TEST_FAILURE: failure,
      RESTORE_TEST_LOG: toShellPath(logFile),
      RESTORE_ONLY: options.restoreOnly ? "1" : "",
      RELEASE_STATE_DIR: toShellPath(releaseStateDir),
      RELEASE_MANIFEST_PUBLIC_KEY: toShellPath(releasePublicKey),
      RELEASE_ALLOWED_IMAGE_PREFIX: "ghcr.io/example/project",
      RELEASE_VERSION: "",
      WEB_IMAGE: "",
      GAME_IMAGE: "",
      MIGRATOR_IMAGE: "",
      TMPDIR: toShellPath(scratchDir),
    },
  });
  let commands = [];
  try {
    commands = readFileSync(logFile, "utf8").trim().split(/\r?\n/).filter(Boolean);
  } catch {
    // The pre-fix script never reaches the injectable command runner.
  }
  let schemaManifest = "";
  try {
    schemaManifest = readFileSync(path.join(releaseStateDir, "schema-current.json"), "utf8");
  } catch {
    // Failed restores must not claim a new applied schema.
  }
  const pendingMigration = readFileIfPresent(path.join(releaseStateDir, "migration-pending.json"));
  rmSync(fixtureDir, { recursive: true, force: true });
  return { ...result, commands, pendingMigration, schemaManifest };
}

function readFileIfPresent(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
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
  *"run --name werewolf-restore-migrator-review --rm --no-deps"*"migrate")
    printf 'migrator-database-url=%s\\n' "$MIGRATION_DATABASE_URL" >> "$RESTORE_TEST_LOG"
    printf 'active-release=%s|%s\\n' "$RELEASE_VERSION" "$MIGRATOR_IMAGE" >> "$RESTORE_TEST_LOG"
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
  "compose up -d --force-recreate --no-build --no-deps --wait --wait-timeout 180 web game caddy")
    [ "$RESTORE_TEST_FAILURE" = "restart" ] && exit 44
    ;;
  *"restore_semantic_check"*)
    [ "$RESTORE_TEST_FAILURE" = "semantic" ] && exit 45
    printf 'ok\\n'
    ;;
  *"psql -v ON_ERROR_STOP=1"*"-Atqc"*)
    case "$*" in
      *"original_user_id || E'\\t'"*)
        printf 'user-deleted-after-backup\\tdeleted_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\\n'
        ;;
      *)
        printf 'ok\\n'
        ;;
    esac
    ;;
  *"psql -v ON_ERROR_STOP=1"*"--single-transaction"*)
    cat >/dev/null
    ;;
  *"psql -v ON_ERROR_STOP=1"*"${stagingDb}"*)
    sed 's/^/stdin: /' >> "$RESTORE_TEST_LOG"
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
    "compose up -d --force-recreate --no-build --no-deps --wait --wait-timeout 180 web game caddy",
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

test("runs a bounded migrator, validates after cutover, and retains rollback for explicit acceptance", () => {
  const result = runRestore();
  const migrate = indexOf(
    result.commands,
    "compose run --name werewolf-restore-migrator-review --rm --no-deps -T -e PGOPTIONS=",
  );
  const stop = indexOf(result.commands, "compose stop web game");
  const promote = indexOf(result.commands, `ALTER DATABASE "${stagingDb}" RENAME TO "werewolf"`);
  const semantic = indexOf(result.commands, "restore_semantic_check");
  const restart = indexOf(
    result.commands,
    "compose up -d --force-recreate --no-build --no-deps --wait --wait-timeout 180 web game caddy",
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
  assert.ok(semantic > promote);
  assert.ok(restart > stop);
  assert.ok(indexOf(result.commands, "wget -qO- http://127.0.0.1:3000/api/health/ready") > restart);
  assert.ok(indexOf(result.commands, "wget -qO- http://127.0.0.1:2567/health/ready") > restart);
  assert.ok(indexOf(result.commands, "deploy-public-health.mjs") > restart);
  assert.equal(dropRollback, -1);
  assert.match(result.stdout, new RegExp(`${rollbackDb}.*retained|retained.*${rollbackDb}`, "i"));
});

test("reapplies current deletion tombstones to staging before cutover", () => {
  const result = runRestore();
  const validate = indexOf(result.commands, "-d werewolf_restore_stage_review -Atqc");
  const stop = indexOf(result.commands, "compose stop web game");
  const captureTombstones = indexOf(result.commands, "-d werewolf -Atqc");
  const applyTombstones = result.commands.findIndex((command, index) =>
    index > captureTombstones && command.includes("-d werewolf_restore_stage_review")
  );
  const renameTarget = indexOf(result.commands, `ALTER DATABASE "werewolf" RENAME TO "${rollbackDb}"`);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(validate >= 0);
  assert.ok(stop > validate);
  assert.ok(captureTombstones > stop);
  assert.ok(applyTombstones > captureTombstones);
  assert.ok(renameTarget > applyTombstones);
  assert.ok(result.commands.some((command) =>
    /stdin:\s+PERFORM public\.werewolf_delete_account/.test(command)
  ));
  assert.ok(result.commands.some((command) =>
    command.includes("stdin: user-deleted-after-backup")
  ));
});

test("leaves writers and target untouched when staging migration fails", () => {
  const result = runRestore("migrate");

  assert.notEqual(result.status, 0);
  assert.ok(indexOf(result.commands, "compose run --rm --no-deps") >= 0);
  assert.equal(indexOf(result.commands, "compose stop web game"), -1);
  assert.equal(indexOf(result.commands, "ALTER DATABASE"), -1);
});

test("rolls back cutover instead of reporting success when semantic validation fails", () => {
  const result = runRestore("semantic");
  const promote = indexOf(result.commands, `ALTER DATABASE "${stagingDb}" RENAME TO "werewolf"`);
  const semantic = indexOf(result.commands, "restore_semantic_check");
  const recover = indexOf(result.commands, `ALTER DATABASE "${rollbackDb}" RENAME TO "werewolf"`);

  assert.notEqual(result.status, 0);
  assert.ok(promote >= 0);
  assert.ok(semantic > promote);
  assert.ok(recover > semantic);
  assert.equal(indexOf(result.commands, `dropdb --if-exists --force -U werewolf ${rollbackDb}`), -1);
  assert.doesNotMatch(result.stdout, /Restore completed/);
  assert.equal(result.schemaManifest, "");
  assert.match(result.pendingMigration, /unresolved-candidate/);
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
    indexOf(
      result.commands,
      "compose up -d --force-recreate --no-build --no-deps --wait --wait-timeout 180 web game caddy",
    ),
    -1,
  );
  assert.equal(indexOf(result.commands, `dropdb --if-exists --force -U werewolf ${rollbackDb}`), -1);
  assert.match(result.stdout, /rollback.*preserved|preserved.*rollback/i);
});

test("uses the signed active release images and recreates Caddy before live readiness", () => {
  const result = runRestore();
  const releaseValidation = indexOf(result.commands, "release-manifest.mjs");
  const pull = indexOf(result.commands, "compose pull migrate web game caddy");
  const createStaging = indexOf(result.commands, `createdb -U werewolf -O werewolf ${stagingDb}`);
  const recreate = indexOf(
    result.commands,
    "compose up -d --force-recreate --no-build --no-deps --wait --wait-timeout 180 web game caddy",
  );
  const publicHealth = indexOf(result.commands, "deploy-public-health.mjs");

  assert.equal(result.status, 0, result.stderr);
  assert.ok(releaseValidation >= 0);
  assert.ok(pull > releaseValidation);
  assert.ok(createStaging > pull);
  assert.ok(result.commands.includes(
    "active-release=cccccccccccccccccccccccccccccccccccccccc|ghcr.io/example/project/migrator@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  ));
  assert.ok(recreate > createStaging);
  assert.ok(publicHealth > recreate);
  assert.equal(result.schemaManifest, '{"signed":"active-release"}\n');
  assert.equal(result.pendingMigration, "");
});
