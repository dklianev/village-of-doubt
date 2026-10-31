import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { signReleaseManifest } from "./release-manifest.mjs";

const posixShell = process.env.POSIX_SHELL || "/bin/sh";
const isPosix = process.platform !== "win32" || Boolean(process.env.POSIX_SHELL);

function release(character, migrationHead) {
  const commit = character.repeat(40);
  const digest = character.repeat(64);
  return {
    schemaVersion: 1,
    releaseVersion: commit,
    sourceCommit: commit,
    migrationHead,
    createdAt: "2026-08-27T00:00:00.000Z",
    images: {
      web: "ghcr.io/example/project/web@sha256:" + digest,
      game: "ghcr.io/example/project/game@sha256:" + digest,
      migrator: "ghcr.io/example/project/migrator@sha256:" + digest,
    },
  };
}

function writeSigned(file, value, privateKey) {
  writeFileSync(file, JSON.stringify(value) + "\n");
  writeFileSync(file + ".sig", signReleaseManifest(value, privateKey, {
    allowedImagePrefix: "ghcr.io/example/project",
  }) + "\n");
}

function runDeploy({ failMigration = false, failReadiness = false, withPrevious = false, firstDeploy = false, checkoutCommit = "b".repeat(40), stall = "" } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-deploy-state-"));
  const releaseDir = path.join(directory, "release-state");
  const binDir = path.join(directory, "bin");
  const dockerLog = path.join(directory, "docker.log");
  const candidatePath = path.join(directory, "candidate.json");
  mkdirSync(releaseDir);
  mkdirSync(binDir);
  const keys = generateKeyPairSync("ed25519");
  const publicKey = path.join(directory, "release.pub");
  writeFileSync(publicKey, keys.publicKey.export({ type: "spki", format: "pem" }));
  const current = release("a", "0012_previous");
  const candidate = release("b", "0013_candidate");
  if (!firstDeploy) writeSigned(path.join(releaseDir, "current.json"), current, keys.privateKey);
  if (withPrevious) writeSigned(path.join(releaseDir, "previous.json"), release("c", "0011_older"), keys.privateKey);
  writeSigned(candidatePath, candidate, keys.privateKey);

  writeFileSync(path.join(binDir, "id"), "#!/bin/sh\nprintf '0\\n'\n", { mode: 0o755 });
  writeFileSync(path.join(binDir, "systemctl"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(path.join(binDir, "pnpm"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(path.join(binDir, "git"), "#!/bin/sh\nprintf '%s\\n' \"$FAKE_SOURCE_COMMIT\"\n", { mode: 0o755 });
  writeFileSync(path.join(binDir, "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
[ "$COMPOSE_PROJECT_NAME" = "werewolf_fixture" ] || exit 98
case "$*" in
  *"ps --format json web"*)
    [ "$STALL" = "ps" ] && exec sleep 60
    printf '{"Health":"healthy"}\\n'
    ;;
  *"exec -T web wget"*) [ "$STALL" = "readiness" ] && exec sleep 60 ;;
  *"run --name werewolf-migrator-"*"--rm --no-deps"*"migrate"*)
    [ "$FAIL_MIGRATION" = "1" ] && exit 91
    ;;
  *"ps --format json web"*|*"ps --format json game"*|*"ps --format json caddy"*)
    printf '{"Health":"healthy"}\\n'
    ;;
esac
exit 0
`, { mode: 0o755 });
  writeFileSync(path.join(binDir, "node"), `#!/bin/sh
case "$*" in
  *"check-production-env.mjs"*) exit 0 ;;
  *"deploy-public-health.mjs"*) [ "$FAIL_READINESS" = "1" ] && exit 92; exit 0 ;;
esac
exec "${process.execPath.replaceAll("\\", "/")}" "$@"
`, { mode: 0o755 });

  const result = spawnSync(posixShell, ["scripts/deploy-release.sh", candidatePath.replaceAll("\\", "/")], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 30_000,
    env: {
      ...process.env,
      COMPOSE_PROJECT_NAME: "werewolf_fixture",
      RELEASE_STATE_GROUP: String(process.getgid?.() ?? 0),
      RELEASE_HEALTH_TIMEOUT_SECONDS: failReadiness || stall ? "2" : "10",
      RELEASE_HEALTH_POLL_INTERVAL_SECONDS: "1",
      FAIL_READINESS: failReadiness ? "1" : "0",
      STALL: stall,
      PATH: binDir.replaceAll("\\", "/") + ":" + process.env.PATH,
      FAKE_DOCKER_LOG: dockerLog.replaceAll("\\", "/"),
      FAIL_MIGRATION: failMigration ? "1" : "0",
      FAKE_SOURCE_COMMIT: checkoutCommit,
      RELEASE_STATE_DIR: releaseDir.replaceAll("\\", "/"),
      RELEASE_ALLOWED_IMAGE_PREFIX: "ghcr.io/example/project",
      RELEASE_MANIFEST_PUBLIC_KEY: publicKey.replaceAll("\\", "/"),
      RELEASE_GIT_COMMAND: path.join(binDir, "git").replaceAll("\\", "/"),
      SKIP_DEPLOY_DRAIN: "1",
      SKIP_DEPLOY_BACKUP: "1",
    },
  });

  const files = {
    current: existsSync(path.join(releaseDir, "current.json")) ? readFileSync(path.join(releaseDir, "current.json"), "utf8") : "",
    previous: existsSync(path.join(releaseDir, "previous.json")) ? readFileSync(path.join(releaseDir, "previous.json"), "utf8") : "",
    stateMode: statSync(releaseDir).mode & 0o7777,
    pending: existsSync(path.join(releaseDir, "migration-pending.json")),
    schema: existsSync(path.join(releaseDir, "schema-current.json"))
      ? readFileSync(path.join(releaseDir, "schema-current.json"), "utf8")
      : "",
  };
  const dockerCalls = existsSync(dockerLog) ? readFileSync(dockerLog, "utf8") : "";
  rmSync(directory, { recursive: true, force: true });
  return { ...result, candidate, dockerCalls, files, releaseDir };
}

test("records the signed applied schema only after a bounded migrator succeeds", { skip: !isPosix }, () => {
  const result = runDeploy();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.files.schema).migrationHead, "0013_candidate");
  assert.equal(result.files.pending, false);
  assert.equal(result.files.stateMode, 0o2750);
  assert.match(result.dockerCalls, /up -d --wait --wait-timeout 120 postgres redis/);
  assert.match(
    result.dockerCalls,
    /run --name werewolf-migrator-[a-f0-9]+ --rm --no-deps -e PGOPTIONS=.*lock_timeout=.*statement_timeout=.*migrate/,
  );
  assert.match(result.dockerCalls, /-e MIGRATION_HEAD=0013_candidate migrate node \.\/migrator\.mjs/);
});

for (const withPrevious of [false, true]) {
  test(`failed readiness recommends surviving current, older previous present: ${withPrevious}`, { skip: !isPosix }, () => {
    const result = runDeploy({ failReadiness: true, withPrevious });
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.files.current).releaseVersion, "a".repeat(40));
    assert.equal(JSON.parse(result.files.schema).migrationHead, "0013_candidate");
    assert.equal(result.files.pending, false);
    assert.ok(result.stderr.includes(`scripts/rollback-release.sh '${result.releaseDir.replaceAll("\\", "/")}/current.json'`));
    assert.doesNotMatch(result.stderr, /rollback-release\.sh .*previous\.json/);
    assert.match(result.stderr, /matching immutable source checkout/);
    assert.match(result.stderr, /exact applied-schema match/);
    if (withPrevious) assert.equal(JSON.parse(result.files.previous).releaseVersion, "c".repeat(40));
    else assert.equal(result.files.previous, "");
  });
}

test("passes the signed schema head to the guarded migrator before publishing schema state", { skip: !isPosix }, () => {
  const result = runDeploy();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.dockerCalls, /-e MIGRATION_HEAD=0013_candidate migrate node \.\/migrator\.mjs/);
  assert.equal(JSON.parse(result.files.schema).migrationHead, "0013_candidate");
  assert.equal(result.files.pending, false);
});

test("first deployment readiness failure does not invent a rollback target", { skip: !isPosix }, () => {
  const result = runDeploy({ failReadiness: true, firstDeploy: true });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /No healthy signed release is recorded/);
  assert.doesNotMatch(result.stderr, /run scripts\/rollback-release\.sh/i);
});

test("preserves an unresolved migration marker when the migrator fails", { skip: !isPosix }, () => {
  const result = runDeploy({ failMigration: true });
  assert.notEqual(result.status, 0);
  assert.equal(result.files.pending, true);
  assert.equal(JSON.parse(result.files.schema).migrationHead, "0012_previous");
  assert.doesNotMatch(result.dockerCalls, /up -d --force-recreate --no-build --no-deps web game caddy/);
});

test("rejects a signed release from a different source checkout", { skip: !isPosix }, () => {
  const result = runDeploy({ checkoutCommit: "c".repeat(40) });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source checkout.*sourceCommit/i);
  assert.equal(result.dockerCalls, "");
});

for (const stall of ["ps", "readiness"]) {
  test(`deploy fails closed when ${stall} blocks inside the readiness loop`, { skip: !isPosix }, () => {
    const started = Date.now();
    const result = runDeploy({ stall });
    assert.equal(result.status, 1, result.stderr);
    assert.ok(Date.now() - started < 15_000);
    assert.equal(JSON.parse(result.files.current).releaseVersion, "a".repeat(40));
    assert.match(result.stderr, /failed readiness/);
  });
}
