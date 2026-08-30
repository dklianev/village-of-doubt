import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  checkoutCommit = "a".repeat(40),
}) {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-rollback-guard-"));
  const releaseDir = path.join(directory, "release-state");
  const binDir = path.join(directory, "bin");
  const dockerLog = path.join(directory, "docker.log");
  const target = path.join(directory, "previous.json");
  mkdirSync(releaseDir);
  mkdirSync(binDir);

  const keys = generateKeyPairSync("ed25519");
  const publicKey = path.join(directory, "release.pub");
  writeFileSync(publicKey, keys.publicKey.export({ type: "spki", format: "pem" }));
  writeSignedManifest(target, manifest("a", targetHead), keys.privateKey);
  writeSignedManifest(path.join(releaseDir, "current.json"), manifest("b", schemaHead), keys.privateKey);
  writeSignedManifest(path.join(releaseDir, "schema-current.json"), manifest("b", schemaHead), keys.privateKey);
  if (pending) {
    writeSignedManifest(path.join(releaseDir, "migration-pending.json"), manifest("c", "0014_pending"), keys.privateKey);
  }

  writeFileSync(path.join(binDir, "pnpm"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(path.join(binDir, "git"), "#!/bin/sh\nprintf '%s\\n' \"$FAKE_SOURCE_COMMIT\"\n", { mode: 0o755 });
  writeFileSync(path.join(binDir, "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
case "$*" in
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
    env: {
      ...process.env,
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
  rmSync(directory, { recursive: true, force: true });
  return { ...result, dockerCalls };
}

test("permits image rollback only when the signed applied-schema head is identical", { skip: !isPosix }, () => {
  const result = runRollback({ targetHead: "0013_safe", schemaHead: "0013_safe" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.dockerCalls, /up -d --force-recreate --no-build --no-deps web game caddy/);
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
