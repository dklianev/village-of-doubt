import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const isPosix = process.platform !== "win32";

function createFixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-backup-test-"));
  const backupDir = path.join(directory, "backups");
  const backupScript = path.join(directory, "backup-postgres.sh");
  const freshnessScript = path.join(directory, "check-backup-freshness.sh");
  const dockerStub = path.join(directory, "fake-docker");
  const dockerLog = path.join(directory, "docker.log");

  writeFileSync(backupScript, normalized("scripts/backup-postgres.sh"), { mode: 0o755 });
  writeFileSync(freshnessScript, normalized("scripts/check-backup-freshness.sh"), { mode: 0o755 });
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

  return { backupDir, backupScript, directory, dockerLog, dockerStub, freshnessScript };
}

function normalized(file) {
  return readFileSync(file, "utf8").replaceAll("\r\n", "\n");
}

function run(script, env) {
  return spawnSync("/bin/sh", [script], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function baseEnv(fixture) {
  return {
    BACKUP_DIR: fixture.backupDir,
    BACKUP_DOCKER_COMMAND: fixture.dockerStub,
    BACKUP_REQUIRE_FIXED_CONTAINER: "1",
    FAKE_DOCKER_LOG: fixture.dockerLog,
  };
}

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
  assert.equal(readdirSync(fixture.backupDir).filter((file) => file.endsWith(".sql.gz")).length, 1);
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

test("freshness rejects backups timestamped beyond clock-skew tolerance", { skip: !isPosix }, () => {
  const fixture = createFixture();
  const backup = run(fixture.backupScript, {
    ...baseEnv(fixture),
    BACKUP_COMPOSE_PROJECT: "werewolf",
  });
  assert.equal(backup.status, 0, backup.stderr);

  const backupName = readdirSync(fixture.backupDir).find((file) => file.endsWith(".sql.gz"));
  assert.ok(backupName);
  const backupPath = path.join(fixture.backupDir, backupName);
  const future = new Date(Date.now() + 60 * 60 * 1000);
  utimesSync(backupPath, future, future);

  const freshness = run(fixture.freshnessScript, {
    BACKUP_CLOCK_SKEW_SECONDS: "300",
    BACKUP_DIR: fixture.backupDir,
  });
  assert.notEqual(freshness.status, 0);
  assert.match(freshness.stderr, /timestamp is in the future/);
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

  const result = spawnSync("/bin/sh", ["scripts/deploy-release.sh", releaseManifest], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      FAKE_SYSTEMCTL_LOG: serviceLog,
      PATH: `${binDir}:${process.env.PATH}`,
      RELEASE_STATE_DIR: releaseDir,
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

  const result = spawnSync("/bin/sh", ["scripts/rollback-release.sh", releaseManifest], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      RELEASE_STATE_DIR: releaseDir,
    },
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(readFileSync(path.join(releaseDir, "current.json"), "utf8"), readFileSync(releaseManifest, "utf8"));
  assert.equal(readdirSync(releaseDir).includes("rollback.env"), false);
});
