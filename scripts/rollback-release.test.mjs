import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { chmodSync, chownSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { signReleaseManifest } from "./release-manifest.mjs";

const posixShell = process.env.POSIX_SHELL || "/bin/sh";
const isPosix = process.platform !== "win32" || Boolean(process.env.POSIX_SHELL);

function manifest(commitCharacter, migrationHead) {
  const commit = commitCharacter.repeat(40);
  const digest = commitCharacter.repeat(64);
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

function writeSignedManifest(file, value, privateKey) {
  writeFileSync(file, JSON.stringify(value) + "\n");
  writeFileSync(file + ".sig", signReleaseManifest(value, privateKey, {
    allowedImagePrefix: "ghcr.io/example/project",
  }) + "\n");
}

function runRollback({
  targetHead,
  schemaHead,
  pending = false,
  targetCurrent = false,
  checkoutCommit = "a".repeat(40),
  stateOwnerUid = null,
  stall = "",
}) {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-rollback-guard-"));
  const releaseDir = path.join(directory, "release-state");
  const binDir = path.join(directory, "bin");
  const dockerLog = path.join(directory, "docker.log");
  const target = path.join(targetCurrent ? releaseDir : directory, targetCurrent ? "current.json" : "previous.json");
  mkdirSync(releaseDir);
  mkdirSync(binDir);

  const keys = generateKeyPairSync("ed25519");
  const publicKey = path.join(directory, "release.pub");
  writeFileSync(publicKey, keys.publicKey.export({ type: "spki", format: "pem" }));
  writeSignedManifest(target, manifest("a", targetHead), keys.privateKey);
  if (!targetCurrent) writeSignedManifest(path.join(releaseDir, "current.json"), manifest("b", schemaHead), keys.privateKey);
  writeSignedManifest(path.join(releaseDir, "schema-current.json"), manifest("b", schemaHead), keys.privateKey);
  if (pending) {
    writeSignedManifest(path.join(releaseDir, "migration-pending.json"), manifest("c", "0014_pending"), keys.privateKey);
  }
  const stateGroup = stateOwnerUid === null ? process.getgid?.() ?? 0 : 1002;
  if (stateOwnerUid !== null) {
    chmodSync(directory, 0o755);
    chownSync(releaseDir, stateOwnerUid, stateGroup);
    for (const name of readdirSync(releaseDir)) {
      chownSync(path.join(releaseDir, name), stateOwnerUid, stateGroup);
      chmodSync(path.join(releaseDir, name), 0o640);
    }
  }

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
  *"ps --format json web"*|*"ps --format json game"*|*"ps --format json caddy"*)
    printf '{"Health":"healthy"}\\n'
    ;;
esac
exit 0
`, { mode: 0o755 });
  writeFileSync(path.join(binDir, "node"), `#!/bin/sh
case "$*" in
  *"deploy-public-health.mjs"*) exit 0 ;;
esac
exec "${process.execPath.replaceAll("\\", "/")}" "$@"
`, { mode: 0o755 });

  const result = spawnSync(posixShell, ["scripts/rollback-release.sh", target.replaceAll("\\", "/")], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 30_000,
    env: {
      ...process.env,
      COMPOSE_PROJECT_NAME: "werewolf_fixture",
      RELEASE_STATE_GROUP: String(stateGroup),
      STALL: stall,
      RELEASE_HEALTH_TIMEOUT_SECONDS: stall ? "2" : "10",
      RELEASE_HEALTH_POLL_INTERVAL_SECONDS: "1",
      PATH: binDir.replaceAll("\\", "/") + ":" + process.env.PATH,
      FAKE_DOCKER_LOG: dockerLog.replaceAll("\\", "/"),
      FAKE_SOURCE_COMMIT: checkoutCommit,
      RELEASE_STATE_DIR: releaseDir.replaceAll("\\", "/"),
      RELEASE_ALLOWED_IMAGE_PREFIX: "ghcr.io/example/project",
      RELEASE_MANIFEST_PUBLIC_KEY: publicKey.replaceAll("\\", "/"),
      RELEASE_GIT_COMMAND: path.join(binDir, "git").replaceAll("\\", "/"),
      SKIP_DEPLOY_DRAIN: "1",
    },
  });

  const dockerCalls = existsSync(dockerLog) ? readFileSync(dockerLog, "utf8") : "";
  let nextWriter;
  let publishedOwners;
  if (stateOwnerUid !== null && result.status === 0) {
    publishedOwners = ["current.json", "current.json.sig"].map((name) => statSync(path.join(releaseDir, name)).uid);
    nextWriter = spawnSync(posixShell, ["-c", [
      'set -eu',
      'test "$(id -u)" = 1001',
      'cp "$STATE/current.json" "$STATE/previous.json"',
      'cp "$STATE/current.json.sig" "$STATE/previous.json.sig"',
      'cp "$STATE/previous.json" "$STATE/current.json"',
      'cp "$STATE/previous.json.sig" "$STATE/current.json.sig"',
    ].join("\n")], {
      uid: stateOwnerUid, gid: stateGroup, encoding: "utf8", timeout: 30_000,
      env: { ...process.env, STATE: releaseDir },
    });
  }
  rmSync(directory, { recursive: true, force: true });
  return { ...result, dockerCalls, nextWriter, publishedOwners };
}

test("permits image rollback only when the signed applied-schema head is identical", { skip: !isPosix }, () => {
  const result = runRollback({ targetHead: "0013_safe", schemaHead: "0013_safe" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.dockerCalls, /up -d --force-recreate --no-build --no-deps web game caddy/);
});

for (const stall of ["ps", "readiness"]) {
  test(`rollback bounds a stalled ${stall} check`, { skip: !isPosix }, () => {
    const started = Date.now();
    const result = runRollback({ targetHead: "0013_safe", schemaHead: "0013_safe", stall });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /did not become healthy/);
    assert.ok(Date.now() - started < 15_000);
  });
}

test("recovers using current.json itself after failed readiness without self-copy failure", { skip: !isPosix }, () => {
  const result = runRollback({ targetHead: "0013_safe", schemaHead: "0013_safe", targetCurrent: true });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Rollback to a{40} is healthy/);
});

test("root self-target rollback leaves current writable by the original deploy UID", {
  skip: process.platform !== "linux" || process.getuid?.() !== 0,
}, () => {
  const result = runRollback({
    targetHead: "0013_safe", schemaHead: "0013_safe", targetCurrent: true, stateOwnerUid: 1001,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.publishedOwners, [1001, 1001]);
  assert.equal(result.nextWriter?.status, 0, result.nextWriter?.stderr);
});

test("blocks rollback before image changes when schema compatibility cannot be proven", { skip: !isPosix }, () => {
  const result = runRollback({ targetHead: "0012_previous", schemaHead: "0013_current" });
  assert.notEqual(result.status, 0);
  assert.equal(result.dockerCalls, "");
  assert.match(result.stderr, /maintenance required/i);
  assert.match(result.stderr, /0012_previous.*0013_current|0013_current.*0012_previous/i);
});

test("blocks rollback while a migration outcome is unresolved", { skip: !isPosix }, () => {
  const result = runRollback({ targetHead: "0013_safe", schemaHead: "0013_safe", pending: true });
  assert.notEqual(result.status, 0);
  assert.equal(result.dockerCalls, "");
  assert.match(result.stderr, /migration.*pending|pending.*migration/i);
});

test("blocks rollback from a checkout that does not match the signed target", { skip: !isPosix }, () => {
  const result = runRollback({
    targetHead: "0013_safe",
    schemaHead: "0013_safe",
    checkoutCommit: "c".repeat(40),
  });
  assert.notEqual(result.status, 0);
  assert.equal(result.dockerCalls, "");
  assert.match(result.stderr, /source checkout.*sourceCommit/i);
});
