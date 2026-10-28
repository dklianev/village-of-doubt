import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { migrationDatabaseUrl } from "../packages/database/drizzle.config.ts";
import { runMigrations } from "../packages/database/migrator.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../packages/database/package.json", import.meta.url));
const postgres = require("postgres");
const postgresBin = process.env.OPERATIONS_POSTGRES_BIN;
const shell = process.env.POSIX_SHELL ?? (process.platform === "win32" ? null : "sh");
const shellPath = (value) => value.replaceAll("\\", "/");
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/^(PG|DATABASE_URL$|TEST_DATABASE_URL$|MIGRATION_DATABASE_URL$)/.test(key)
));

function artifact(directory, statements) {
  const folder = path.join(directory, "drizzle");
  mkdirSync(path.join(folder, "meta"), { recursive: true });
  const entries = statements.map((statement, index) => {
    const entry = { idx: index, version: "7", when: 1000 + index, tag: `000${index}_fixture`, breakpoints: true };
    writeFileSync(path.join(folder, `${entry.tag}.sql`), statement);
    return entry;
  });
  writeFileSync(path.join(folder, "meta/_journal.json"), JSON.stringify({ version: "7", dialect: "postgresql", entries }));
  return { folder, head: entries.at(-1).tag };
}

test("real Postgres.js migration and restore boundaries on a disposable cluster", {
  skip: !postgresBin || !shell ? "Set OPERATIONS_POSTGRES_BIN and POSIX_SHELL for the disposable PostgreSQL probe" : false,
  timeout: 120_000,
}, async (t) => {
  const fixture = mkdtempSync(path.join(root, ".restore-driver-test-"));
  const data = path.join(fixture, "data");
  const executable = (name) => path.join(postgresBin, `${name}${process.platform === "win32" ? ".exe" : ""}`);
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  const command = (name, args) => {
    const log = path.join(fixture, `${name}.log`);
    const output = openSync(log, "a");
    try {
      const result = spawnSync(executable(name), args, {
        env: cleanEnv, stdio: ["ignore", output, output], timeout: 60_000, windowsHide: true,
      });
      assert.equal(result.error, undefined, `${name}: ${result.error?.message}`);
      assert.equal(result.status, 0, `${name}: ${readFileSync(log, "utf8")}`);
    } finally {
      closeSync(output);
    }
  };
  const connections = [];
  let started = false;
  let admin;
  let databaseCount = 0;
  const connect = (url) => {
    const sql = postgres(url, { max: 1, connect_timeout: 5, onnotice() {} });
    connections.push(sql);
    return sql;
  };
  const newDatabase = async () => {
    const name = `operations_fixture_${databaseCount++}`;
    await admin`CREATE DATABASE ${admin(name)}`;
    const url = `postgres://operations_fixture@127.0.0.1:${port}/${name}`;
    return { name, url, sql: connect(url) };
  };
  try {
    command("initdb", ["-D", data, "-U", "operations_fixture", "-A", "trust", "--no-locale", "--encoding=UTF8"]);
    started = true;
    command("pg_ctl", ["-D", data, "-l", path.join(fixture, "server.log"), "-o", `-h 127.0.0.1 -p ${port} -c shared_buffers=16MB`, "-w", "start"]);
    admin = connect(`postgres://operations_fixture@127.0.0.1:${port}/postgres`);
    const [directory] = await admin`SHOW data_directory`;
    assert.equal(path.resolve(directory.data_directory).toLowerCase(), path.resolve(data).toLowerCase());
    const [version] = await admin`SHOW server_version`;
    t.diagnostic(`Disposable PostgreSQL ${version.server_version}; no application database URLs used.`);

    await t.test("the actual Drizzle Kit config delivers all three SQL startup settings", async () => {
      const { url, sql } = await newDatabase();
      const configFixture = path.join(fixture, "kit");
      artifact(configFixture, [
        "CREATE TABLE timeout_probe AS SELECT current_setting('lock_timeout') AS lock_timeout, current_setting('statement_timeout') AS statement_timeout, current_setting('idle_in_transaction_session_timeout') AS idle_timeout;",
      ]);
      const result = spawnSync(process.execPath, [
        path.join(root, "packages/database/node_modules/drizzle-kit/bin.cjs"),
        "migrate", "--config", path.join(root, "packages/database/drizzle.config.ts"),
      ], {
        cwd: configFixture, encoding: "utf8", timeout: 30_000, windowsHide: true,
        env: { ...cleanEnv, DATABASE_URL: url, PGOPTIONS: "-c lock_timeout=100 -c statement_timeout=1000 -c idle_in_transaction_session_timeout=2000" },
      });
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      const [settings] = await sql`SELECT * FROM timeout_probe`;
      assert.deepEqual({ ...settings }, { lock_timeout: "100ms", statement_timeout: "1s", idle_timeout: "2s" });
    });

    await t.test("the configured driver cancels a slow statement and a blocked lock", async () => {
      const { url, sql } = await newDatabase();
      const timed = connect(migrationDatabaseUrl(`${url}?statement_timeout=0&options=-c%20lock_timeout=0`,
        "-c lock_timeout=75 -c statement_timeout=200 -c idle_in_transaction_session_timeout=1000"));
      await assert.rejects(timed`SELECT pg_sleep(2)`, { code: "57014" });
      await sql`CREATE TABLE lock_probe(id integer)`;
      await sql`BEGIN`;
      try {
        await sql`LOCK TABLE lock_probe IN ACCESS EXCLUSIVE MODE`;
        await assert.rejects(timed`SELECT * FROM lock_probe`, { code: "55P03" });
      } finally {
        await sql`ROLLBACK`;
      }
    });

    const baseSql = "CREATE TABLE migration_fixture(id integer);";
    const a = artifact(path.join(fixture, "a"), [baseSql]);
    const b = artifact(path.join(fixture, "b"), [baseSql, "ALTER TABLE migration_fixture ADD COLUMN extra text;"]);
    const migrateFixture = (url, source, backupHead, expectedHead = source.head) => runMigrations({
      databaseUrl: migrationDatabaseUrl(url), migrationsFolder: source.folder, expectedHead, backupHead,
    });
    await t.test("signed backup A upgrades to artifact B and verifies its exact final history", async () => {
      const { url, sql } = await newDatabase();
      await migrateFixture(url, a);
      await migrateFixture(url, b, a.head);
      const history = await sql`SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at`;
      assert.equal(history.length, 2);
      assert.equal(Number(history.at(-1).created_at), 1001);
    });
    await t.test("schema B with healthy application A cannot be restored or published as A", async () => {
      const { url, sql } = await newDatabase();
      await migrateFixture(url, b);
      await assert.rejects(migrateFixture(url, a, b.head), /backup schema.*not supported/);
      await assert.rejects(migrateFixture(url, a, a.head), /history.*does not match/);
      await assert.rejects(migrateFixture(url, b, a.head), /head.*does not match/);
      await assert.rejects(migrateFixture(url, b, b.head, a.head), /release migration head/);
      assert.equal((await sql`SELECT * FROM drizzle.__drizzle_migrations`).length, 2);
    });
    await t.test("missing or edited backup history is rejected before migration", async () => {
      const { url, sql } = await newDatabase();
      await assert.rejects(migrateFixture(url, b, a.head), /head.*does not match/);
      assert.equal((await sql`SELECT to_regclass('public.migration_fixture') AS name`)[0].name, null);
      await migrateFixture(url, a);
      await sql`UPDATE drizzle.__drizzle_migrations SET hash = 'altered'`;
      await assert.rejects(migrateFixture(url, b, a.head), /history.*does not match/);
    });
    await t.test("disabled connection timeouts fail closed before any migration", async () => {
      const { url } = await newDatabase();
      await assert.rejects(runMigrations({
        databaseUrl: url, migrationsFolder: a.folder, expectedHead: a.head,
      }), /timeouts must be enabled/);
    });
    await t.test("successful SQL cannot publish a schema if the final history was changed", async () => {
      const { url, sql } = await newDatabase();
      await migrateFixture(url, a);
      const tampered = artifact(path.join(fixture, "tampered-final"), [
        baseSql, "UPDATE drizzle.__drizzle_migrations SET hash = 'changed-by-migration';",
      ]);
      await assert.rejects(migrateFixture(url, tampered, a.head), /history.*does not match/);
      assert.equal((await sql`SELECT * FROM drizzle.__drizzle_migrations`).length, 2);
    });

    await t.test("restore semantics require every privilege and runtime writes really succeed", async () => {
      const { name, sql } = await newDatabase();
      const psqlEnv = {
        ...cleanEnv, PGPORT: String(port), PGDATABASE: name, POSTGRES_USER: "operations_fixture",
        OPERATIONS_PSQL: shellPath(executable("psql")), OPERATIONS_CHECKS: shellPath(path.join(root, "scripts/restore-database-checks.sh")),
      };
      const bootstrap = spawnSync(shell, ["-c", `
        set -eu
        compose() { shift 4; "$OPERATIONS_PSQL" -X -h 127.0.0.1 -p "$PGPORT" "$@"; }
        . "$OPERATIONS_CHECKS"
        restore_bootstrap_import_roles
        restore_bootstrap_import_roles
      `], { encoding: "utf8", timeout: 10_000, windowsHide: true, env: psqlEnv });
      assert.equal(bootstrap.status, 0, bootstrap.stderr);
      const roles = await admin`SELECT rolcanlogin, rolsuper FROM pg_roles WHERE rolname IN ('werewolf_web', 'werewolf_game', 'werewolf_migrator')`;
      assert.equal(roles.length, 3);
      assert.ok(roles.every((role) => !role.rolcanlogin && !role.rolsuper));
      assert.equal((await sql`SELECT to_regnamespace('werewolf_observability') AS name`)[0].name, null);
      await sql.unsafe(`
        CREATE TABLE import_owner_probe(id integer);
        ALTER TABLE import_owner_probe OWNER TO werewolf_migrator;
        GRANT SELECT ON import_owner_probe TO werewolf_web;
      `);
      await sql.unsafe(`
        CREATE TABLE public."user"(id text);
        CREATE TABLE public.session(user_id text);
        CREATE TABLE public.account(user_id text);
        CREATE TABLE public.verification(id text);
        CREATE TABLE public.games(id text, host_id text);
        CREATE TABLE public.game_players(game_id text, user_id text, lover_user_id text);
        CREATE TABLE public.game_events(game_id text, actor_id text, payload jsonb);
        CREATE TABLE public.user_achievements(user_id text);
        CREATE TABLE public.game_session_revocations(id text);
        CREATE TABLE public.deleted_user_identities(original_user_id text);
        CREATE SCHEMA drizzle;
        CREATE TABLE drizzle.__drizzle_migrations(id integer);
        INSERT INTO drizzle.__drizzle_migrations VALUES (1);
        CREATE FUNCTION public.werewolf_delete_account(text, text) RETURNS void LANGUAGE sql AS 'SELECT';
        GRANT USAGE ON SCHEMA public TO werewolf_web, werewolf_game;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO werewolf_web, werewolf_game;
      `);
      const check = () => spawnSync(shell, ["-c", `
        set -eu
        compose() { shift 4; "$OPERATIONS_PSQL" -X -h 127.0.0.1 -p "$PGPORT" "$@"; }
        . "$OPERATIONS_CHECKS"
        restore_validate_database_semantics "$PGDATABASE"
      `], {
        cwd: root, encoding: "utf8", timeout: 10_000, windowsHide: true,
        env: psqlEnv,
      });
      assert.equal(check().status, 0);
      const required = [
        ["werewolf_web", "user", "SELECT INSERT UPDATE DELETE"],
        ["werewolf_web", "session", "SELECT INSERT UPDATE DELETE"],
        ["werewolf_web", "account", "SELECT INSERT UPDATE DELETE"],
        ["werewolf_web", "verification", "SELECT INSERT UPDATE DELETE"],
        ["werewolf_web", "games", "SELECT UPDATE"],
        ["werewolf_web", "game_players", "SELECT"],
        ["werewolf_web", "game_events", "SELECT DELETE"],
        ["werewolf_web", "user_achievements", "SELECT"],
        ["werewolf_game", "user", "SELECT INSERT"],
        ["werewolf_game", "games", "SELECT INSERT UPDATE"],
        ["werewolf_game", "game_players", "SELECT INSERT UPDATE"],
        ["werewolf_game", "game_events", "SELECT INSERT"],
        ["werewolf_game", "user_achievements", "SELECT INSERT"],
      ];
      for (const [role, table, privileges] of required) {
        for (const privilege of privileges.split(" ")) {
          await sql.unsafe(`REVOKE ${privilege} ON public."${table}" FROM ${role}`);
          const result = check();
          assert.equal(result.status, 1, `${role}.${table}.${privilege}: ${result.stderr}`);
          await sql.unsafe(`GRANT ${privilege} ON public."${table}" TO ${role}`);
        }
      }
      const rolledBack = new Error("synthetic rollback");
      for (const role of ["werewolf_web", "werewolf_game"]) {
        await assert.rejects(sql.begin(async (tx) => {
          await tx`SET LOCAL ROLE ${tx(role)}`;
          await tx`INSERT INTO public."user" VALUES ('synthetic-user')`;
          if (role === "werewolf_web") await tx`INSERT INTO public.session VALUES ('synthetic-user')`;
          else await tx`INSERT INTO public.games VALUES ('synthetic-game', 'synthetic-user')`;
          throw rolledBack;
        }), (error) => error === rolledBack);
      }
      assert.equal(check().status, 0);
      await sql`REVOKE INSERT ON public.session FROM werewolf_web`;
      await assert.rejects(sql.begin(async (tx) => {
        await tx`SET LOCAL ROLE werewolf_web`;
        await tx`INSERT INTO public.session VALUES ('synthetic-user')`;
      }), { code: "42501" });
      assert.equal(check().status, 1);

      // Acceptance reaches real semantic SQL, but every destructive command is a stub.
      const state = path.join(fixture, "release-state");
      mkdirSync(state);
      for (const file of ["schema-current.json", "schema-current.json.sig", "release.pub"]) {
        writeFileSync(path.join(state, file), "synthetic verification fixture");
      }
      const dockerStub = path.join(fixture, "accept-docker.sh");
      const nodeStub = path.join(fixture, "accept-node.sh");
      const log = path.join(fixture, "accept.log");
      writeFileSync(nodeStub, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
      writeFileSync(dockerStub, `#!/bin/sh
        printf '%s\\n' "$*" >> "$ACCEPT_LOG"
        case "$*" in
          *"-v database_name="*) cat >/dev/null; printf '1\\n'; exit 0 ;;
          *"dropdb"*) exit 99 ;;
          *"psql"*) shift 5; exec "$OPERATIONS_PSQL" -X -h 127.0.0.1 -p "$PGPORT" "$@" ;;
        esac
        exit 0
      `, { mode: 0o755 });
      const rollbackName = `${name}_restore_rollback_fixture`;
      const acceptance = spawnSync(shell, ["scripts/restore-accept.sh", rollbackName], {
        cwd: root, encoding: "utf8", timeout: 15_000, windowsHide: true,
        env: {
          ...psqlEnv, COMPOSE_PROJECT_NAME: "operations_fixture", RELEASE_STATE_GROUP: String(process.getgid?.() ?? 0),
          POSTGRES_DB: name, RESTORE_ACCEPT_DATABASE: name, RESTORE_ACCEPT_ROLLBACK_DATABASE: rollbackName,
          RESTORE_DOCKER_COMMAND: shellPath(dockerStub), RESTORE_NODE_COMMAND: shellPath(nodeStub),
          RELEASE_STATE_DIR: shellPath(state), RELEASE_MANIFEST_PUBLIC_KEY: shellPath(path.join(state, "release.pub")),
          RELEASE_ALLOWED_IMAGE_PREFIX: "ghcr.io/synthetic/fixture", ACCEPT_LOG: shellPath(log),
        },
      });
      assert.equal(acceptance.status, 1, acceptance.stderr);
      const calls = readFileSync(log, "utf8");
      assert.match(calls, /restore_semantic_check/);
      assert.doesNotMatch(calls, /dropdb|wget/);
    });
  } finally {
    for (const sql of connections) await sql.end({ timeout: 1 });
    if (started) command("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
    assert.ok(path.resolve(fixture).startsWith(path.resolve(root) + path.sep));
    rmSync(fixture, { recursive: true, force: true });
  }
});
