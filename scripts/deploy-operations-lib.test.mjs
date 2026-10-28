import assert from "node:assert/strict";
import { chmodSync, chownSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { runDrain } from "./deploy-drain.mjs";
import { drainRequest, runBounded } from "./deploy-drain-lib.mjs";

const posixShell = process.env.POSIX_SHELL || "/bin/sh";
const isPosix = process.platform !== "win32" || Boolean(process.env.POSIX_SHELL);
const library = path.resolve("scripts/deploy-operations-lib.sh").replaceAll("\\", "/");

for (const stalled of ["POST", "GET", "DELETE"]) {
  test(`drain bounds a stalled ${stalled} child and independently attempts cleanup`, async () => {
    const calls = [];
    const started = Date.now();
    await assert.rejects(runDrain({
      timeoutMs: 150, operationTimeoutMs: 150, cancelTimeoutMs: 100, pollIntervalMs: 10,
      request: async (method, budget) => {
        calls.push({ method, budget });
        if (method === stalled) {
          await runBounded(process.execPath, ["-e", "setInterval(() => {}, 1000)"], budget);
        }
        return { draining: true, activeRooms: 1 };
      },
    }), (error) => {
      assert.equal(error.recoveryRequired === true, stalled !== "GET");
      return true;
    });
    assert.ok(Date.now() - started < 3_000, "stalled child must be killed, not only abandoned");
    assert.equal(calls.at(-1).method, "DELETE");
    assert.equal(calls.at(-1).budget, 100, "cleanup receives its independent budget");
    assert.ok(calls.filter(({ method }) => method !== "DELETE").every(({ budget }) => budget <= 150));
  });
}

test("drain uses one deadline including POST and never accepts a late success", async () => {
  let clock = 0;
  const calls = [];
  await assert.rejects(runDrain({
    timeoutMs: 100, operationTimeoutMs: 80, cancelTimeoutMs: 50, now: () => clock,
    delay: async (ms) => { clock += ms; },
    request: async (method, budget) => {
      calls.push([method, budget]);
      clock += method === "POST" ? 70 : 30;
      return { draining: true, activeRooms: 0 };
    },
  }), /timed out/);
  assert.deepEqual(calls, [["POST", 80], ["GET", 30], ["DELETE", 50]]);
});

test("drain HTTP and child deadlines cover all methods and successful drain stays armed", async () => {
  const methods = [];
  await runDrain({ request: async (method) => {
    methods.push(method);
    return { draining: true, activeRooms: 0 };
  } });
  assert.deepEqual(methods, ["POST", "GET"]);
  for (const method of ["POST", "GET", "DELETE"]) {
    await drainRequest(method, 123, async (command, args, budget) => {
      assert.equal(command, "docker");
      assert.equal(budget, 123);
      assert.match(args.at(-1), /AbortSignal.timeout\(123\)/);
      assert.ok(args.at(-1).includes(`method: ${JSON.stringify(method)}`));
      assert.ok(args.at(-1).includes("http://127.0.0.1:2567/operations/"));
      return '{"draining":true,"activeRooms":0}';
    });
  }
});

test("readiness deadline interrupts a stalled process and refuses to launch expired work", { skip: !isPosix }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-readiness-deadline-"));
  try {
    const started = Date.now();
    const result = runProbe(directory, `
deadline=$(( $(date +%s) + 1 ))
run_before_deadline "$deadline" 10 sleep 60 && exit 98
run_before_deadline "$deadline" 10 touch "$PROBE_SENTINEL" && exit 99
exit 0
`, { PROBE_SENTINEL: path.join(directory, "expired").replaceAll("\\", "/") });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(path.join(directory, "expired")), false);
    assert.ok(Date.now() - started < 5_000);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("bounded failed cancellation keeps the operations lock and maintenance evidence", { skip: !isPosix }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-cancel-deadline-"));
  try {
    writeFileSync(path.join(directory, "pnpm"), "#!/bin/sh\nexec sleep 60\n", { mode: 0o755 });
    const result = runProbe(directory, `
release_dir="$FIXTURE_DIR"
acquire_operations_lock deploy "$OPERATIONS_LOCK_DIR"
drain_cleanup_timeout=1
cancel_drain_bounded && exit 98
release_operations_lock
`, {
      FIXTURE_DIR: directory.replaceAll("\\", "/"),
      PATH: directory.replaceAll("\\", "/") + ":" + process.env.PATH,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(path.join(directory, "operations.lock", "owner")), true);
    assert.match(readFileSync(path.join(directory, "maintenance-required.txt"), "utf8"), /cancellation unconfirmed/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("an ambiguous drain start stays pending even when a later cancellation succeeds", { skip: !isPosix }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-drain-ambiguous-"));
  try {
    writeFileSync(path.join(directory, "node"), '#!/bin/sh\nexit 74\n', { mode: 0o755 });
    writeFileSync(path.join(directory, "pnpm"), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const result = runProbe(directory, `
release_dir="$FIXTURE_DIR"
script_dir="$FIXTURE_DIR"
initialize_drain_timeouts
run_deploy_drain && exit 98
test "$drain_start_pending" = 1
cancel_drain_bounded
test "$drain_start_pending" = 1
`, { FIXTURE_DIR: directory.replaceAll("\\", "/"), PATH: directory.replaceAll("\\", "/") + ":" + process.env.PATH });
    assert.equal(result.status, 0, result.stderr);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

function runProbe(directory, body, extraEnv = {}) {
  const probe = path.join(directory, "probe.sh");
  writeFileSync(probe, "#!/bin/sh\nset -eu\n. \"$OPERATIONS_LIBRARY\"\n" + body + "\n", { mode: 0o755 });
  return spawnSync(posixShell, [probe.replaceAll("\\", "/")], {
    encoding: "utf8",
    timeout: 30_000,
    env: {
      ...process.env,
      OPERATIONS_LIBRARY: library,
      OPERATIONS_LOCK_DIR: path.join(directory, "operations.lock").replaceAll("\\", "/"),
      ...extraEnv,
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

test("release checkouts load the same explicit project while an exported CI identity wins", { skip: !isPosix }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-identity-"));
  try {
    for (const name of ["release-a", "release-b"]) {
      const checkout = path.join(directory, name);
      mkdirSync(checkout);
      writeFileSync(path.join(checkout, ".env"), 'COMPOSE_PROJECT_NAME="existing_stack"\n');
      for (const override of ["", "werewolf_ci"]) {
        const result = runProbe(directory, 'cd "$CHECKOUT"\ninitialize_compose_project\nprintf "%s" "$COMPOSE_PROJECT_NAME"', {
          CHECKOUT: checkout, COMPOSE_PROJECT_NAME: override,
        });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, override || "existing_stack");
      }
    }
    for (const identity of ["", "Uppercase", "-prefix", "bad.name", "bad space", "bad;command"]) {
      const result = runProbe(directory, 'validate_compose_project "$IDENTITY"', { IDENTITY: identity });
      assert.notEqual(result.status, 0, identity);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Compose resolves identical persistent resources across checkouts and isolates CI", (t) => {
  const version = spawnSync("docker", ["compose", "version"], { encoding: "utf8", timeout: 30_000 });
  if (version.error?.code === "ENOENT") return t.skip("Docker Compose CLI is not installed");
  assert.equal(version.status, 0, version.stderr);
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-compose-identity-"));
  try {
    const compose = readFileSync("docker-compose.yml", "utf8");
    const env = { ...process.env };
    for (const [, key] of compose.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)) delete env[key];
    for (const key of ["COMPOSE_FILE", "COMPOSE_ENV_FILES", "COMPOSE_PROJECT_NAME"]) delete env[key];
    const required = [...new Set([...compose.matchAll(/\$\{([A-Z][A-Z0-9_]*):\?/g)].map((match) => match[1]))];
    const fixtureEnv = required.filter((key) => key !== "COMPOSE_PROJECT_NAME")
      .map((key) => `${key}=synthetic-fixture`).join("\n");
    const projectConfigs = [];
    for (const checkoutName of ["release-a", "release-b"]) {
      const checkout = path.join(directory, checkoutName);
      mkdirSync(checkout);
      writeFileSync(path.join(checkout, "compose.yml"), compose);
      writeFileSync(path.join(checkout, ".env"), `${fixtureEnv}\nCOMPOSE_PROJECT_NAME=existing_stack\n`);
      for (const ci of [false, true]) {
        const result = spawnSync("docker", ["compose", "--env-file", ".env", "-f", "compose.yml", "config", "--format", "json"], {
          cwd: checkout, encoding: "utf8", timeout: 30_000,
          env: ci ? { ...env, COMPOSE_PROJECT_NAME: "werewolf_ci" } : env,
        });
        assert.equal(result.status, 0, result.stderr);
        const config = JSON.parse(result.stdout);
        const identity = {
          name: config.name,
          volumes: Object.fromEntries(Object.entries(config.volumes).map(([key, value]) => [key, value.name])),
          networks: Object.fromEntries(Object.entries(config.networks).map(([key, value]) => [key, value.name])),
        };
        assert.equal(identity.name, ci ? "werewolf_ci" : "existing_stack");
        assert.equal(identity.volumes.postgres_data, `${identity.name}_postgres_data`);
        assert.equal(identity.volumes.redis_data, `${identity.name}_redis_data`);
        if (!ci) projectConfigs.push(identity);
        else assert.notEqual(identity.volumes.postgres_data, projectConfigs.at(-1).volumes.postgres_data);
      }
      writeFileSync(path.join(checkout, ".env"), fixtureEnv);
      const missing = spawnSync("docker", ["compose", "--env-file", ".env", "-f", "compose.yml", "config", "--quiet"], {
        cwd: checkout, encoding: "utf8", timeout: 30_000, env,
      });
      assert.notEqual(missing.status, 0);
      assert.match(missing.stderr, /COMPOSE_PROJECT_NAME/);
    }
    assert.deepEqual(projectConfigs[0], projectConfigs[1]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("release state grants read-only group access only to signed provenance", { skip: !isPosix }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-state-modes-"));
  try {
    const state = path.join(directory, "state");
    const result = runProbe(directory, [
      'prepare_release_state "$STATE"',
      'printf signed > "$STATE/current.json"',
      'printf signature > "$STATE/current.json.sig"',
      'printf private > "$STATE/candidate.env"',
      'allow_release_state_readers "$STATE/current.json" "$STATE/current.json.sig"',
    ].join("\n"), { STATE: state, RELEASE_STATE_GROUP: String(process.getgid?.() ?? 0) });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(statSync(state).mode & 0o7777, 0o2750);
    assert.equal(statSync(path.join(state, "current.json")).mode & 0o777, 0o640);
    assert.equal(statSync(path.join(state, "candidate.env")).mode & 0o777, 0o600);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("root publication preserves a different deploy UID for current, previous and schema state", {
  skip: process.platform !== "linux" || process.getuid?.() !== 0,
}, () => {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-state-owner-"));
  const writerUid = 1001;
  const readerGid = 1002;
  try {
    chmodSync(directory, 0o755);
    const state = path.join(directory, "state");
    mkdirSync(state);
    chownSync(state, writerUid, readerGid);
    const names = ["current.json", "previous.json", "schema-current.json", "migration-pending.json"]
      .flatMap((name) => [name, `${name}.sig`]);
    const result = runProbe(directory, [
      'prepare_release_state "$STATE"',
      ...names.map((name) => [
        `printf signed > "$STATE/${name}.$$"`,
        `test "$(stat -c %u "$STATE/${name}.$$")" = 0`,
        `allow_release_state_readers "$STATE/${name}.$$"`,
        `mv "$STATE/${name}.$$" "$STATE/${name}"`,
      ].join("\n")),
    ].join("\n"), { STATE: state, RELEASE_STATE_GROUP: String(readerGid) });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(statSync(state).uid, writerUid);
    for (const name of names) {
      const metadata = statSync(path.join(state, name));
      assert.equal(metadata.uid, writerUid, name);
      assert.equal(metadata.gid, readerGid, name);
      assert.equal(metadata.mode & 0o777, 0o640, name);
    }
    const nextWriter = spawnSync(posixShell, ["-c", [
      'set -eu; . "$OPERATIONS_LIBRARY"',
      'test "$(id -u)" = 1001',
      ...names.map((name) => [
        `printf updated > "$STATE/${name}"`,
        `allow_release_state_readers "$STATE/${name}"`,
      ].join("\n")),
    ].join("\n")], {
      uid: writerUid, gid: readerGid, encoding: "utf8", timeout: 30_000,
      env: { ...process.env, OPERATIONS_LIBRARY: library, STATE: state, RELEASE_STATE_GROUP: String(readerGid) },
    });
    assert.equal(nextWriter.status, 0, nextWriter.stderr);
    for (const name of names) assert.equal(readFileSync(path.join(state, name), "utf8"), "updated");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const scenario of [
  { name: "inspect failure with confirmed removal", inspect: "error", remove: "success", list: "error", released: true },
  { name: "inspect timeout with confirmed removal", inspect: "timeout", remove: "success", list: "error", released: true },
  { name: "missing container with confirmed absence", inspect: "error", remove: "error", list: "absent", released: true },
  { name: "removal timeout followed by confirmed absence", inspect: "success", remove: "timeout", list: "absent", released: true },
  { name: "failed removal with a surviving container", inspect: "success", remove: "error", list: "present", released: false },
  { name: "unavailable daemon for inspect, removal and list", inspect: "error", remove: "error", list: "error", released: false },
  { name: "removal timeout and unavailable daemon", inspect: "success", remove: "timeout", list: "error", released: false },
  { name: "absence query timeout after failed removal", inspect: "error", remove: "error", list: "timeout", released: false },
]) {
  test(`migrator cleanup handles ${scenario.name}`, { skip: !isPosix }, () => {
    const directory = mkdtempSync(path.join(tmpdir(), "werewolf-cleanup-lock-"));
    try {
      const commandLog = path.join(directory, "calls");
      writeFileSync(path.join(directory, "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> "$COMMAND_LOG"
case "$1" in
  inspect) outcome="$INSPECT_OUTCOME" ;;
  rm) outcome="$REMOVE_OUTCOME" ;;
  ps) outcome="$LIST_OUTCOME" ;;
  *) exit 99 ;;
esac
case "$outcome" in
  success|absent) exit 0 ;;
  present) printf 'aaaaaaaaaaaa\\n' ;;
  error) printf 'synthetic-daemon-secret\\n' >&2; exit 1 ;;
  timeout) exec sleep 60 ;;
  *) exit 99 ;;
esac
`, { mode: 0o755 });
      writeFileSync(path.join(directory, "bounded-timeout"), `#!/bin/sh
[ "$1" = --signal=TERM ] && [ "$2" = --kill-after=30s ] && [ "$3" = 10s ] || exit 99
printf '%s\\n' "$*" >> "$TIMEOUT_LOG"
shift 3
exec timeout --signal=TERM --kill-after=1s 0.1s "$@"
`, { mode: 0o755 });
      const result = runProbe(directory, [
        'acquire_operations_lock deploy "$OPERATIONS_LOCK_DIR"',
        'trap release_operations_lock EXIT',
        'cleanup_status=0',
        'preserve_and_stop_container docker fixture-migrator "$STATE" deploy-migrator || cleanup_status=$?',
        'exit "$cleanup_status"',
      ].join("\n"), {
        PATH: `${directory}:${process.env.PATH}`, STATE: directory, COMMAND_LOG: commandLog,
        TIMEOUT_LOG: path.join(directory, "timeouts"), OPERATIONS_TIMEOUT_COMMAND: path.join(directory, "bounded-timeout"),
        INSPECT_OUTCOME: scenario.inspect, REMOVE_OUTCOME: scenario.remove, LIST_OUTCOME: scenario.list,
      });
      assert.equal(result.status, scenario.released ? 0 : 1, result.stderr);
      assert.equal(existsSync(path.join(directory, "operations.lock", "owner")), !scenario.released);
      assert.doesNotMatch(result.stdout + result.stderr, /synthetic-daemon-secret/);
      const calls = readFileSync(commandLog, "utf8").trim().split("\n");
      const timeouts = readFileSync(path.join(directory, "timeouts"), "utf8").trim().split("\n");
      assert.equal(timeouts.length, calls.length, "every cleanup Docker call must be bounded");
      assert.ok(calls.includes("rm -f fixture-migrator"));
      if (scenario.remove !== "success") {
        assert.ok(calls.includes("ps --all --filter name=^/fixture-migrator$ --format {{.ID}}"));
      }
      if (!scenario.released) assert.match(result.stderr, /preserving the host lock/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test("failure forensics allowlist bounded state, never environment, health output or raw logs", { skip: !isPosix }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), "werewolf-forensics-"));
  const commandLog = path.join(directory, "calls");
  const secret = "synthetic-database-password-do-not-log";
  try {
    writeFileSync(path.join(directory, "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> "$COMMAND_LOG"
case "$*" in
  *'ps --all --quiet') printf '%s\\n' aaaaaaaaaaaa ;;
  'inspect --format {{.Id}} '*) printf '%s\\n' aaaaaaaaaaaa ;;
  'inspect --format id='*)
    printf 'id=aaaaaaaaaaaa status=exited running=false oom_killed=false exit_code=137 started_at=2026-01-01T00:00:00Z finished_at=2026-01-01T00:00:01Z restart_count=0 health=none\\n'
    ;;
  'rm -f '*) exit 0 ;;
  *) printf '%s\\n' '${secret} private-chat synthetic-token'; exit 99 ;;
esac
`, { mode: 0o755 });
    const result = runProbe(directory, [
      'preserve_and_stop_container docker fixture-migrator "$STATE" deploy-migrator',
      'preserve_compose_forensics deploy-failed fixture-release "$STATE" fixture.env',
    ].join("\n"), {
      PATH: `${directory}:${process.env.PATH}`, STATE: directory, COMMAND_LOG: commandLog,
    });
    assert.equal(result.status, 0, result.stderr);
    const files = readdirSync(path.join(directory, "forensics"));
    assert.equal(files.length, 2);
    for (const file of files) {
      const forensic = path.join(directory, "forensics", file);
      const content = readFileSync(forensic, "utf8");
      assert.match(content, /exit_code=137/);
      assert.ok(Buffer.byteLength(content) < 8192);
      assert.equal(statSync(forensic).mode & 0o777, 0o600);
      assert.doesNotMatch(content, /synthetic-database-password|private-chat|synthetic-token/);
    }
    const calls = readFileSync(commandLog, "utf8");
    assert.doesNotMatch(calls, /Config|\.Env|\.State\.Error|\.State\.Health\.Log|\blogs\b/);
    assert.ok(calls.split("\n").filter((call) => call.startsWith("inspect ")).every((call) => call.startsWith("inspect --format ")));
    assert.match(calls, /rm -f fixture-migrator/);
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
