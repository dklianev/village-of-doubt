import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = process.cwd();
const acceptScript = path.join(root, "scripts", "restore-accept.sh");
const rollbackDatabase = "werewolf_restore_rollback_acceptance";

function shellInvocation() {
  const configured = process.env.POSIX_SHELL;
  if (configured) {
    return path.basename(configured).toLowerCase().startsWith("busybox")
      ? { command: configured, prefix: ["sh"] }
      : { command: configured, prefix: [] };
  }
  return process.platform === "win32" ? null : { command: "sh", prefix: [] };
}

function runAcceptance({ confirmed = true, schemaProof = true } = {}) {
  const shell = shellInvocation();
  assert.ok(shell, "Set POSIX_SHELL to run restore acceptance tests on Windows");
  const directory = mkdtempSync(path.join(root, ".restore-accept-test-"));
  const fakeDocker = path.join(directory, "fake-docker.sh");
  const fakeNode = path.join(directory, "fake-node.sh");
  const log = path.join(directory, "commands.log");
  const releaseStateDir = path.join(directory, "release-state");
  const releasePublicKey = path.join(directory, "release-manifest.pub");
  mkdirSync(releaseStateDir);
  if (schemaProof) {
    writeFileSync(path.join(releaseStateDir, "schema-current.json"), '{"signed":"applied-schema"}\n');
    writeFileSync(path.join(releaseStateDir, "schema-current.json.sig"), "signed-applied-schema\n");
  }
  writeFileSync(releasePublicKey, "test-public-key\n");
  writeFileSync(fakeDocker, `#!/usr/bin/env sh
printf '%s\\n' "$*" >> "$RESTORE_ACCEPT_TEST_LOG"
case "$*" in
  *"restore_semantic_check"*) printf 'ok\\n' ;;
  *"to_regclass('public.user')"*) printf 'ok\\n' ;;
  *"SELECT count(*) FROM pg_database"*) printf '1\\n' ;;
esac
exit 0
`, { mode: 0o755 });
  writeFileSync(fakeNode, `#!/usr/bin/env sh
printf 'node %s\\n' "$*" >> "$RESTORE_ACCEPT_TEST_LOG"
exit 0
`, { mode: 0o755 });
  chmodSync(fakeDocker, 0o755);
  chmodSync(fakeNode, 0o755);

  const result = spawnSync(shell.command, [...shell.prefix, toShellPath(acceptScript), rollbackDatabase], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      POSTGRES_USER: "werewolf",
      POSTGRES_DB: "werewolf",
      RESTORE_DOCKER_COMMAND: toShellPath(fakeDocker),
      RESTORE_NODE_COMMAND: toShellPath(fakeNode),
      RESTORE_ACCEPT_DATABASE: confirmed ? "werewolf" : "",
      RESTORE_ACCEPT_ROLLBACK_DATABASE: confirmed ? rollbackDatabase : "",
      RESTORE_ACCEPT_TEST_LOG: toShellPath(log),
      RELEASE_STATE_DIR: toShellPath(releaseStateDir),
      RELEASE_MANIFEST_PUBLIC_KEY: toShellPath(releasePublicKey),
      RELEASE_ALLOWED_IMAGE_PREFIX: "ghcr.io/example/project",
    },
  });

  let commands = [];
  try {
    commands = readFileSync(log, "utf8").trim().split(/\r?\n/).filter(Boolean);
  } catch {
    // Confirmation failures intentionally stop before Docker is invoked.
  }
  rmSync(directory, { recursive: true, force: true });
  return { ...result, commands };
}

function toShellPath(value) {
  return value.replaceAll("\\", "/");
}

test("does not delete the rollback database without two exact acceptance values", () => {
  const result = runAcceptance({ confirmed: false });
  assert.notEqual(result.status, 0);
  assert.equal(result.commands.some((command) => command.includes("dropdb")), false);
  assert.match(result.stderr, /RESTORE_ACCEPT_DATABASE|RESTORE_ACCEPT_ROLLBACK_DATABASE/);
});

test("revalidates database semantics and live ingress before explicit rollback deletion", () => {
  const result = runAcceptance();
  const schemaProof = result.commands.findIndex((command) => command.includes("release-manifest.mjs"));
  const semantic = result.commands.findIndex((command) => command.includes("restore_semantic_check"));
  const webReady = result.commands.findIndex((command) => command.includes("/api/health/ready"));
  const gameReady = result.commands.findIndex((command) => command.includes("2567/health/ready"));
  const publicReady = result.commands.findIndex((command) => command.includes("deploy-public-health.mjs"));
  const drop = result.commands.findIndex((command) => command.includes("dropdb --if-exists --force"));

  assert.equal(result.status, 0, result.stderr);
  assert.ok(schemaProof >= 0);
  assert.ok(semantic > schemaProof);
  assert.ok(webReady > semantic);
  assert.ok(gameReady > semantic);
  assert.ok(publicReady > semantic);
  assert.ok(drop > publicReady);
});

test("retains rollback when signed applied-schema provenance is missing", () => {
  const result = runAcceptance({ schemaProof: false });

  assert.notEqual(result.status, 0);
  assert.equal(result.commands.some((command) => command.includes("dropdb")), false);
  assert.match(result.stderr, /schema|provenance|manifest/i);
});
