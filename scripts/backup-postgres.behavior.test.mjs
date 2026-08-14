import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { signReleaseManifest } from "./release-manifest.mjs";

const posixShell = process.env.POSIX_SHELL || "/bin/sh";
const isPosix = process.platform !== "win32" || Boolean(process.env.POSIX_SHELL);

function createFixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-backup-test-"));
  const backupDir = path.join(directory, "backups");
  const backupScript = path.join(directory, "backup-postgres.sh");
  const freshnessScript = path.join(directory, "check-backup-freshness.sh");
  const restoreScript = path.join(directory, "restore-postgres.sh");
  const manifestScript = path.join(directory, "backup-manifest.mjs");
  const releaseManifestScript = path.join(directory, "release-manifest.mjs");
  const signingPrivateKey = path.join(directory, "backup-signing.key");
  const signingPublicKey = path.join(directory, "backup-signing.pub");
  const dockerStub = path.join(directory, "fake-docker");
  const ageStub = path.join(directory, "fake-age");
  const dockerLog = path.join(directory, "docker.log");

  writeFileSync(backupScript, normalized("scripts/backup-postgres.sh"), { mode: 0o755 });
  writeFileSync(freshnessScript, normalized("scripts/check-backup-freshness.sh"), { mode: 0o755 });
  writeFileSync(restoreScript, normalized("scripts/restore-postgres.sh"), { mode: 0o755 });
  writeFileSync(manifestScript, normalized("scripts/backup-manifest.mjs"), { mode: 0o755 });
  writeFileSync(releaseManifestScript, normalized("scripts/release-manifest.mjs"), { mode: 0o755 });
  const signingKeys = generateKeyPairSync("ed25519");
  writeFileSync(signingPrivateKey, signingKeys.privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  writeFileSync(signingPublicKey, signingKeys.publicKey.export({ type: "spki", format: "pem" }));
  writeFileSync(
    ageStub,
    `#!/bin/sh
set -eu
output=""
input=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    -r|-i) shift 2 ;;
    -d) shift ;;
    *) input="$1"; shift ;;
  esac
done
cp "$input" "$output"
`,
    { mode: 0o755 },
  );
  writeFileSync(
    dockerStub,
    `#!/bin/sh
set -eu
printf '%s\n' "$*" >> "$FAKE_DOCKER_LOG"
case "\${1:-}" in
  ps)
    case "\${FAKE_DOCKER_MODE:-one}" in
      none) exit 0 ;;
      one) printf 'postgres-one\n' ;;
      two) printf 'postgres-one\npostgres-two\n' ;;
      *) exit 65 ;;
    esac
    ;;
  exec)
    printf 'CREATE TABLE backup_probe(id integer);\n'
    ;;
  compose)
    printf 'CREATE TABLE compose_backup_probe(id integer);\n'
    ;;
  *)
    exit 64
    ;;
esac
`,
    { mode: 0o755 },
  );

  return {
    ageStub,
    backupDir,
    backupScript,
    directory,
    dockerLog,
    dockerStub,
    freshnessScript,
    manifestScript,
    releaseManifestScript,
    restoreScript,
    signingPrivateKey,
    signingPublicKey,
  };
}

function createSignedActiveRelease(fixture) {
  const releaseManifest = path.join(fixture.directory, "current.json");
  const releasePublicKey = path.join(fixture.directory, "release-manifest.pub");
  const releaseKeys = generateKeyPairSync("ed25519");
  const digest = "a".repeat(64);
  const commit = "b".repeat(40);
  const release = {
    schemaVersion: 1,
    releaseVersion: commit,
    sourceCommit: commit,
    migrationHead: "0011_account_deletion_boundary",
    createdAt: "2026-08-14T00:00:00.000Z",
    images: {
      web: `ghcr.io/example/project/web@sha256:${digest}`,
      game: `ghcr.io/example/project/game@sha256:${digest}`,
      migrator: `ghcr.io/example/project/migrator@sha256:${digest}`,
    },
  };
  writeFileSync(releaseManifest, `${JSON.stringify(release)}\n`);
  writeFileSync(
    `${releaseManifest}.sig`,
    `${signReleaseManifest(release, releaseKeys.privateKey, { allowedImagePrefix: "ghcr.io/example/project" })}\n`,
  );
  writeFileSync(
    releasePublicKey,
    releaseKeys.publicKey.export({ type: "spki", format: "pem" }),
  );
  return { commit, release, releaseManifest, releasePublicKey };
}

function normalized(file) {
  return readFileSync(file, "utf8").replaceAll("\r\n", "\n");
}

function run(script, env, args = []) {
  return spawnSync(posixShell, [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function baseEnv(fixture) {
  return {
    BACKUP_DIR: fixture.backupDir,
    BACKUP_DOCKER_COMMAND: fixture.dockerStub,
    BACKUP_AGE_COMMAND: fixture.ageStub,
    BACKUP_AGE_RECIPIENT: "age1testrecipient",
    BACKUP_REQUIRE_FIXED_CONTAINER: "1",
    BACKUP_REQUIRE_SIGNATURE: "1",
    BACKUP_MANIFEST_COMMAND: fixture.manifestScript,
    BACKUP_SIGNING_PRIVATE_KEY_FILE: fixture.signingPrivateKey,
    BACKUP_RELEASE_VERSION: "release-test-42",
    BACKUP_MIGRATION_HEAD: "0010_complete_triton",
    FAKE_DOCKER_LOG: fixture.dockerLog,
  };
}

test("scheduled signed backup fails closed without release provenance", { skip: !isPosix }, () => {
  const fixture = createFixture();
  const result = run(fixture.backupScript, {
    ...baseEnv(fixture),
    BACKUP_RELEASE_VERSION: "",
    BACKUP_COMPOSE_PROJECT: "werewolf",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BACKUP_RELEASE_VERSION/);
  assert.equal(existsSync(fixture.backupDir), false);
});

test("scheduled backup derives provenance from the signed active release", { skip: !isPosix }, () => {
  const fixture = createFixture();
  const active = createSignedActiveRelease(fixture);
  const result = run(fixture.backupScript, {
    ...baseEnv(fixture),
    BACKUP_RELEASE_VERSION: "",
    BACKUP_MIGRATION_HEAD: "",
    BACKUP_REQUIRE_ACTIVE_RELEASE: "1",
    BACKUP_RELEASE_MANIFEST: active.releaseManifest,
    BACKUP_RELEASE_MANIFEST_COMMAND: fixture.releaseManifestScript,
    BACKUP_RELEASE_MANIFEST_PUBLIC_KEY_FILE: active.releasePublicKey,
    BACKUP_RELEASE_ALLOWED_IMAGE_PREFIX: "ghcr.io/example/project",
    BACKUP_COMPOSE_PROJECT: "werewolf",
  });

  assert.equal(result.status, 0, result.stderr);
  const manifestName = readdirSync(fixture.backupDir).find((file) => file.endsWith(".manifest.json"));
  assert.ok(manifestName);
  const manifest = JSON.parse(readFileSync(path.join(fixture.backupDir, manifestName), "utf8"));
  assert.equal(manifest.releaseVersion, active.commit);
  assert.equal(manifest.migrationHead, active.release.migrationHead);
});

test("scheduled backup rejects tampered active release provenance", { skip: !isPosix }, () => {
  const fixture = createFixture();
  const active = createSignedActiveRelease(fixture);
  writeFileSync(active.releaseManifest, `${JSON.stringify({
    ...active.release,
    migrationHead: "tampered_migration",
  })}\n`);
  const result = run(fixture.backupScript, {
    ...baseEnv(fixture),
    BACKUP_RELEASE_VERSION: "",
    BACKUP_MIGRATION_HEAD: "",
    BACKUP_REQUIRE_ACTIVE_RELEASE: "1",
    BACKUP_RELEASE_MANIFEST: active.releaseManifest,
    BACKUP_RELEASE_MANIFEST_COMMAND: fixture.releaseManifestScript,
    BACKUP_RELEASE_MANIFEST_PUBLIC_KEY_FILE: active.releasePublicKey,
    BACKUP_RELEASE_ALLOWED_IMAGE_PREFIX: "ghcr.io/example/project",
    BACKUP_COMPOSE_PROJECT: "werewolf",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /signature is invalid/i);
  assert.equal(existsSync(fixture.backupDir), false);
});

test("scheduled backup resolves one labeled PostgreSQL container", { skip: !isPosix }, () => {
  const fixture = createFixture();
  const result = run(fixture.backupScript, {
    ...baseEnv(fixture),
    BACKUP_COMPOSE_PROJECT: "werewolf",
    FAKE_DOCKER_MODE: "one",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(fixture.dockerLog, "utf8"), /^ps .+compose\.project=werewolf/m);
  assert.match(readFileSync(fixture.dockerLog, "utf8"), /^exec -i postgres-one pg_dump /m);
  assert.equal(readdirSync(fixture.backupDir).filter((file) => file.endsWith(".sql.gz.age")).length, 1);
});

test("scheduled backup fails closed without an encryption recipient", { skip: !isPosix }, () => {
  const fixture = createFixture();
  const result = run(fixture.backupScript, {
    ...baseEnv(fixture),
    BACKUP_AGE_RECIPIENT: "",
    BACKUP_COMPOSE_PROJECT: "werewolf",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BACKUP_AGE_RECIPIENT is required/);
  assert.equal(existsSync(fixture.backupDir), false);
});

for (const mode of ["none", "two"]) {
  test(`scheduled backup fails closed when container discovery returns ${mode}`, { skip: !isPosix }, () => {
    const fixture = createFixture();
    const result = run(fixture.backupScript, {
      ...baseEnv(fixture),
      BACKUP_COMPOSE_PROJECT: "werewolf",
      FAKE_DOCKER_MODE: mode,
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Expected exactly one running PostgreSQL container/);
    assert.deepEqual(readdirSync(fixture.backupDir), []);
  });
}

test("scheduled backup requires a fixed container selector", { skip: !isPosix }, () => {
  const fixture = createFixture();
  const result = run(fixture.backupScript, baseEnv(fixture));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BACKUP_COMPOSE_PROJECT or BACKUP_POSTGRES_CONTAINER is required/);
  assert.deepEqual(readdirSync(fixture.backupDir), []);
});

test("scheduled backup rejects unsafe project selectors", { skip: !isPosix }, () => {
  const fixture = createFixture();
  const result = run(fixture.backupScript, {
    ...baseEnv(fixture),
    BACKUP_COMPOSE_PROJECT: "werewolf;touch-pwned",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BACKUP_COMPOSE_PROJECT must contain only/);
  assert.deepEqual(readdirSync(fixture.backupDir), []);
});

test("scheduled backup accepts an explicit fixed container without discovery", { skip: !isPosix }, () => {
  const fixture = createFixture();
  const result = run(fixture.backupScript, {
    ...baseEnv(fixture),
    BACKUP_POSTGRES_CONTAINER: "werewolf-postgres-1",
  });

  assert.equal(result.status, 0, result.stderr);
  const calls = readFileSync(fixture.dockerLog, "utf8");
  assert.doesNotMatch(calls, /^ps /m);
  assert.match(calls, /^exec -i werewolf-postgres-1 pg_dump /m);
});

test("freshness trusts the signed creation time instead of mutable file metadata", { skip: !isPosix }, () => {
  const fixture = createFixture();
  const backup = run(fixture.backupScript, {
    ...baseEnv(fixture),
    BACKUP_COMPOSE_PROJECT: "werewolf",
  });
  assert.equal(backup.status, 0, backup.stderr);

  const backupName = readdirSync(fixture.backupDir).find((file) => file.endsWith(".sql.gz.age"));
  assert.ok(backupName);
  const backupPath = path.join(fixture.backupDir, backupName);
  const future = new Date(Date.now() + 60 * 60 * 1000);
  utimesSync(backupPath, future, future);

  const freshness = run(fixture.freshnessScript, {
    BACKUP_CLOCK_SKEW_SECONDS: "300",
    BACKUP_DIR: fixture.backupDir,
    BACKUP_MANIFEST_COMMAND: fixture.manifestScript,
    BACKUP_SIGNING_PUBLIC_KEY_FILE: fixture.signingPublicKey,
  });
  assert.equal(freshness.status, 0, freshness.stderr);
  assert.match(freshness.stdout, /Backup verified/);
});

test("encrypted restore fails closed without the private identity", { skip: !isPosix }, () => {
  const fixture = createFixture();
  mkdirSync(fixture.backupDir);
  const backupPath = path.join(fixture.backupDir, "werewolf_2026-08-12_12-00-00.sql.gz.age");
  writeFileSync(backupPath, "encrypted");
  const checksum = createHash("sha256").update(readFileSync(backupPath)).digest("hex");
  writeFileSync(`${backupPath}.sha256`, `${checksum}  ${path.basename(backupPath)}\n`);

  const result = run(fixture.restoreScript, {
    BACKUP_AGE_COMMAND: fixture.ageStub,
    MIGRATION_DATABASE_URL: "postgres://werewolf:dev@localhost:5432/werewolf",
    RESTORE_CONFIRM_DATABASE: "werewolf",
  }, [backupPath]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BACKUP_AGE_IDENTITY_FILE/);
});

test("release deployment waits for the hardened backup service", { skip: !isPosix }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-deploy-test-"));
  const binDir = path.join(directory, "bin");
  const releaseDir = path.join(directory, "release-state");
  const releaseManifest = path.join(directory, "release.json");
  const serviceLog = path.join(directory, "systemctl.log");
  mkdirSync(binDir);

  const digest = "a".repeat(64);
  const commit = "b".repeat(40);
  writeFileSync(
    releaseManifest,
    `${JSON.stringify({
      schemaVersion: 1,
      releaseVersion: commit,
      sourceCommit: commit,
      migrationHead: "0007_cuddly_felicia_hardy",
      createdAt: "2026-07-29T00:00:00.000Z",
      images: {
        web: `ghcr.io/example/project/web@sha256:${digest}`,
        game: `ghcr.io/example/project/game@sha256:${digest}`,
        migrator: `ghcr.io/example/project/migrator@sha256:${digest}`,
      },
    })}\n`,
  );
  const release = JSON.parse(readFileSync(releaseManifest, "utf8"));
  const releaseKeys = generateKeyPairSync("ed25519");
  const releasePublicKey = path.join(directory, "release-manifest.pub");
  writeFileSync(releasePublicKey, releaseKeys.publicKey.export({ type: "spki", format: "pem" }));
  writeFileSync(
    `${releaseManifest}.sig`,
    `${signReleaseManifest(release, releaseKeys.privateKey, { allowedImagePrefix: "ghcr.io/example/project" })}\n`,
  );
  writeFileSync(
    path.join(binDir, "id"),
    "#!/bin/sh\nprintf '1000\\n'\n",
    { mode: 0o755 },
  );
  writeFileSync(
    path.join(binDir, "systemctl"),
    "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$FAKE_SYSTEMCTL_LOG\"\n",
    { mode: 0o755 },
  );
  writeFileSync(
    path.join(binDir, "sudo"),
    `#!/bin/sh
set -eu
test "\${1:-}" = "-n"
shift
exec "$@"
`,
    { mode: 0o755 },
  );
  writeFileSync(
    path.join(binDir, "docker"),
    `#!/bin/sh
set -eu
case "$*" in
  *"ps --format json web"*|*"ps --format json game"*)
    printf '{"Health":"healthy"}\n'
    ;;
esac
`,
    { mode: 0o755 },
  );
  writeFileSync(
    path.join(binDir, "node"),
    `#!/bin/sh
case "$*" in
  *"check-production-env.mjs"*) exit 0 ;;
esac
exec "${process.execPath}" "$@"
`,
    { mode: 0o755 },
  );

  const result = spawnSync(posixShell, ["scripts/deploy-release.sh", releaseManifest], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      FAKE_SYSTEMCTL_LOG: serviceLog,
      PATH: `${binDir}:${process.env.PATH}`,
      RELEASE_STATE_DIR: releaseDir,
      RELEASE_ALLOWED_IMAGE_PREFIX: "ghcr.io/example/project",
      RELEASE_MANIFEST_PUBLIC_KEY: releasePublicKey,
      SKIP_DEPLOY_DRAIN: "1",
    },
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(readFileSync(serviceLog, "utf8").trim(), "start werewolf-backup.service");
});

test("rollback writes transient state outside the immutable checkout", { skip: !isPosix }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-rollback-test-"));
  const binDir = path.join(directory, "bin");
  const releaseDir = path.join(directory, "release-state");
  const releaseManifest = path.join(directory, "previous.json");
  mkdirSync(binDir);

  const digest = "c".repeat(64);
  const commit = "d".repeat(40);
  writeFileSync(
    releaseManifest,
    `${JSON.stringify({
      schemaVersion: 1,
      releaseVersion: commit,
      sourceCommit: commit,
      migrationHead: "0007_cuddly_felicia_hardy",
      createdAt: "2026-07-29T00:00:00.000Z",
      images: {
        web: `ghcr.io/example/project/web@sha256:${digest}`,
        game: `ghcr.io/example/project/game@sha256:${digest}`,
        migrator: `ghcr.io/example/project/migrator@sha256:${digest}`,
      },
    })}\n`,
  );
  const release = JSON.parse(readFileSync(releaseManifest, "utf8"));
  const releaseKeys = generateKeyPairSync("ed25519");
  const releasePublicKey = path.join(directory, "release-manifest.pub");
  writeFileSync(releasePublicKey, releaseKeys.publicKey.export({ type: "spki", format: "pem" }));
  writeFileSync(
    `${releaseManifest}.sig`,
    `${signReleaseManifest(release, releaseKeys.privateKey, { allowedImagePrefix: "ghcr.io/example/project" })}\n`,
  );
  writeFileSync(path.join(binDir, "pnpm"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(
    path.join(binDir, "docker"),
    `#!/bin/sh
set -eu
case "$*" in
  *"ps --format json web"*|*"ps --format json game"*)
    printf '{"Health":"healthy"}\n'
    ;;
esac
`,
    { mode: 0o755 },
  );

  const result = spawnSync(posixShell, ["scripts/rollback-release.sh", releaseManifest], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      RELEASE_STATE_DIR: releaseDir,
      RELEASE_ALLOWED_IMAGE_PREFIX: "ghcr.io/example/project",
      RELEASE_MANIFEST_PUBLIC_KEY: releasePublicKey,
    },
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(readFileSync(path.join(releaseDir, "current.json"), "utf8"), readFileSync(releaseManifest, "utf8"));
  assert.equal(readdirSync(releaseDir).includes("rollback.env"), false);
});
