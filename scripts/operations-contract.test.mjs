import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const readOptional = (path) => existsSync(path) ? read(path) : "";

test("developer and CI runtimes pin Node 22 and shard the exhaustive play matrix", () => {
  const packageJson = JSON.parse(read("package.json"));
  const workflow = read(".github/workflows/ci.yml");

  assert.equal(readOptional(".nvmrc").trim(), "22");
  assert.equal(readOptional(".node-version").trim(), "22");
  assert.equal(packageJson.engines?.node, ">=22 <23");
  assert.match(packageJson.scripts.visual, /grep-invert @play-matrix/);
  assert.match(packageJson.scripts["visual:matrix"], /grep @play-matrix/);
  assert.match(workflow, /M35_SHARD_INDEX/);
  assert.match(workflow, /M35_SHARD_TOTAL/);
  assert.match(workflow, /pnpm visual:matrix/);
});

test("production database roles are separated and reconciled on every deployment", () => {
  const compose = read("docker-compose.yml");
  const envExample = read(".env.example");
  const roleReconciler = readOptional("scripts/postgres-init/apply-roles.sh");
  const productionEnvCheck = read("scripts/check-production-env.mjs");
  const restore = read("scripts/restore-postgres.sh");

  assert.match(compose, /^\s{2}postgres-roles:$/m);
  assert.match(compose, /^\s{2}postgres-grants:$/m);
  assert.match(compose, /postgres-roles:[\s\S]*condition: service_healthy/);
  assert.match(compose, /migrate:[\s\S]*DATABASE_URL: \$\{MIGRATION_DATABASE_URL:/);
  assert.match(compose, /migrate:[\s\S]*postgres-roles:[\s\S]*condition: service_completed_successfully/);
  assert.match(compose, /postgres-grants:[\s\S]*migrate:[\s\S]*condition: service_completed_successfully/);
  assert.match(compose, /web:[\s\S]*DATABASE_URL: \$\{WEB_DATABASE_URL:/);
  assert.match(compose, /web:[\s\S]*postgres-grants:[\s\S]*condition: service_completed_successfully/);
  assert.match(compose, /game:[\s\S]*DATABASE_URL: \$\{GAME_DATABASE_URL:/);
  assert.match(compose, /game:[\s\S]*postgres-grants:[\s\S]*condition: service_completed_successfully/);

  for (const key of [
    "MIGRATION_DATABASE_URL",
    "WEB_DATABASE_URL",
    "GAME_DATABASE_URL",
    "MIGRATOR_DB_PASSWORD",
    "WEB_DB_PASSWORD",
    "GAME_DB_PASSWORD",
  ]) {
    assert.match(envExample, new RegExp(`^${key}=`, "m"));
    assert.match(productionEnvCheck, new RegExp(`"${key}"`));
  }

  assert.match(roleReconciler, /FROM pg_roles/);
  assert.match(roleReconciler, /CREATE ROLE werewolf_migrator/);
  assert.match(roleReconciler, /CREATE ROLE werewolf_web/);
  assert.match(roleReconciler, /CREATE ROLE werewolf_game/);
  assert.match(
    roleReconciler,
    /ALTER ROLE werewolf_(?:web|game)[\s\S]*NOSUPERUSER[\s\S]*NOCREATEDB[\s\S]*NOCREATEROLE[\s\S]*NOREPLICATION[\s\S]*NOBYPASSRLS/,
  );
  assert.match(roleReconciler, /TO werewolf_web/);
  assert.match(roleReconciler, /TO werewolf_game/);
  assert.match(roleReconciler, /WHEN 'account'|relation\.relname IN \('user', 'session', 'account', 'verification'\)/);
  assert.doesNotMatch(
    roleReconciler,
    /GRANT [^;]* ON (?:ALL TABLES IN SCHEMA public|TABLE public\.(?:account|session|verification)) TO werewolf_game/,
  );
  assert.match(roleReconciler, /GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public/);
  assert.match(roleReconciler, /ALTER DEFAULT PRIVILEGES FOR ROLE werewolf_migrator IN SCHEMA public/);
  assert.doesNotMatch(roleReconciler, /GRANT ALL[^;]*TO werewolf_(?:web|game)/);
  assert.match(roleReconciler, /SET log_min_duration_statement = -1/);
  assert.match(roleReconciler, /SET log_min_error_statement = PANIC/);
  assert.match(roleReconciler, /\\getenv migrator_password MIGRATOR_DB_PASSWORD/);
  assert.match(roleReconciler, /\\getenv web_password WEB_DB_PASSWORD/);
  assert.match(roleReconciler, /\\getenv game_password GAME_DB_PASSWORD/);
  assert.doesNotMatch(roleReconciler, /-v (?:migrator|web|game)_password=/);
  assert.match(roleReconciler, /\nBEGIN;\n/);
  assert.match(roleReconciler, /\nCOMMIT;\n/);
  assert.match(restore, /MIGRATION_DATABASE_URL/);
  assert.equal(
    (restore.match(/compose run --rm --no-deps -T postgres-roles/g) ?? []).length,
    2,
  );
});

test("CI and immutable releases use the production database identities and Better Auth key ring", () => {
  const ci = read(".github/workflows/ci.yml");
  const release = read(".github/workflows/release.yml");

  for (const key of [
    "MIGRATION_DATABASE_URL",
    "WEB_DATABASE_URL",
    "GAME_DATABASE_URL",
    "MIGRATOR_DB_PASSWORD",
    "WEB_DB_PASSWORD",
    "GAME_DB_PASSWORD",
    "BETTER_AUTH_SECRETS",
  ]) {
    assert.match(ci, new RegExp(`^\\s{6}${key}:`, "m"));
  }

  assert.match(ci, /postgres_roles_id=.*postgres-roles/);
  assert.match(ci, /postgres_roles_exit=.*postgres_roles_id/);
  assert.match(ci, /postgres_grants_id=.*postgres-grants/);
  assert.match(ci, /postgres_grants_exit=.*postgres_grants_id/);
  assert.match(release, /better_auth_secrets=1:release-build-only-better-auth-secret-/);
  assert.doesNotMatch(release, /better_auth_secret=/);
});

test("CI isolates visual baselines from the serial core verification path", () => {
  const ci = read(".github/workflows/ci.yml");
  const verifyStart = ci.indexOf("  verify:");
  const visualStart = ci.indexOf("  visual:");

  assert.ok(verifyStart >= 0 && visualStart > verifyStart, "CI must define a dedicated visual job after verify.");
  assert.doesNotMatch(
    ci.slice(verifyStart, visualStart),
    /pnpm visual(?::ui)?/,
    "The serial verify job must not consume its timeout on visual baselines.",
  );
  const visualBlock = ci.slice(visualStart, ci.indexOf("  containers:", visualStart));
  assert.match(visualBlock, /runs-on: windows-2025/);
  assert.match(visualBlock, /- suite: app/);
  assert.match(visualBlock, /- suite: play-0/);
  assert.match(visualBlock, /- suite: play-3/);
  assert.match(visualBlock, /- suite: ui/);
  assert.match(visualBlock, /pnpm --filter @werewolf\/database build/);
  assert.match(visualBlock, /pnpm --filter @werewolf\/shared build/);
  assert.match(visualBlock, /pnpm --filter @werewolf\/ui build/);
  assert.match(visualBlock, /pnpm visual:ui/);
  assert.match(visualBlock, /pnpm visual(?:\s|$)/m);
  assert.doesNotMatch(visualBlock, /apt-get|Install visual fonts/);
});

test("auth E2E falls back to its standalone port when the configured local app is offline", () => {
  const authE2e = read("scripts/e2e-auth.mjs");

  assert.match(authE2e, /const standaloneBaseUrl = `http:\/\/127\.0\.0\.1:\$\{webPort\}`/);
  assert.match(
    authE2e,
    /if \(!process\.env\.E2E_AUTH_BASE_URL && !\(await isHealthy\(`\$\{baseUrl\}\/api\/health`\)\)\) \{\s*baseUrl = standaloneBaseUrl;/,
  );
});

test("deploy validates Compose before disruption and applies database privileges in order", () => {
  const deploy = read("scripts/deploy-release.sh");
  const environmentPreflight = 'node --env-file=.env scripts/check-production-env.mjs';
  const preflight = 'docker compose --env-file .env --env-file "$generated_env" config --quiet';
  const drain = 'pnpm deploy:drain';
  const roles = 'run --rm --no-deps postgres-roles';
  const migrate = 'run --rm --no-deps migrate';
  const grants = 'run --rm --no-deps postgres-grants';

  assert.match(deploy, new RegExp(environmentPreflight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(deploy.indexOf(environmentPreflight) < deploy.indexOf(preflight));
  assert.match(deploy, new RegExp(preflight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(deploy.indexOf(preflight) < deploy.indexOf(drain));
  assert.ok(deploy.indexOf(roles) < deploy.indexOf(migrate));
  assert.ok(deploy.indexOf(migrate) < deploy.indexOf(grants));
  assert.ok(deploy.indexOf(grants) < deploy.indexOf("up -d --no-build --no-deps web game caddy"));
});

test("rollback validates and pulls before drain without replaying old migrations", () => {
  const rollback = read("scripts/rollback-release.sh");
  const preflight = 'docker compose --env-file .env --env-file "$rollback_env" config --quiet';
  const pull = 'docker compose --env-file .env --env-file "$rollback_env" pull web game';
  const drain = "pnpm deploy:drain";

  assert.ok(rollback.indexOf(preflight) >= 0);
  assert.ok(rollback.indexOf(preflight) < rollback.indexOf(pull));
  assert.ok(rollback.indexOf(pull) < rollback.indexOf(drain));
  assert.match(rollback, /up -d --no-build --no-deps web game caddy/);
  assert.doesNotMatch(rollback, /\bpull migrate\b|\brun .*\bmigrate\b/);
});

test("PostgreSQL query observability is enabled without weakening readiness", () => {
  const compose = read("docker-compose.yml");
  const envExample = read(".env.example");
  const roleReconciler = readOptional("scripts/postgres-init/apply-roles.sh");

  assert.match(compose, /shared_preload_libraries=pg_stat_statements/);
  assert.match(compose, /log_min_duration_statement=\$\{POSTGRES_SLOW_QUERY_MS:-500\}/);
  assert.match(compose, /log_line_prefix=.*%a/);
  assert.match(compose, /healthcheck:[\s\S]*pg_isready -U werewolf -d werewolf/);
  assert.match(roleReconciler, /CREATE SCHEMA IF NOT EXISTS werewolf_observability/);
  assert.match(
    roleReconciler,
    /CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA werewolf_observability/,
  );
  assert.match(
    roleReconciler,
    /REVOKE ALL PRIVILEGES ON SCHEMA werewolf_observability FROM PUBLIC, werewolf_web, werewolf_game/,
  );
  assert.match(envExample, /^POSTGRES_SLOW_QUERY_MS=500$/m);
  assert.match(envExample, /^MIGRATION_DATABASE_URL=.*application_name=werewolf-migrator$/m);
  assert.match(envExample, /^WEB_DATABASE_URL=.*application_name=werewolf-web$/m);
  assert.match(envExample, /^GAME_DATABASE_URL=.*application_name=werewolf-game$/m);
});

test("database backups are scheduled, verified, retained, and copied off-site", () => {
  const service = read("ops/systemd/werewolf-backup.service");
  const timer = read("ops/systemd/werewolf-backup.timer");
  const backup = read("scripts/backup-postgres.sh");
  const freshness = read("scripts/check-backup-freshness.sh");
  const deploy = read("scripts/deploy-release.sh");
  const rollback = read("scripts/rollback-release.sh");
  const runbook = read("docs/operations/production-runbook.md");

  assert.equal((timer.match(/^OnCalendar=/gm) ?? []).length, 4);
  assert.match(timer, /^Persistent=true$/m);
  assert.match(timer, /^RandomizedDelaySec=5min$/m);
  assert.doesNotMatch(service, /^User=werewolf$/m);
  assert.doesNotMatch(service, /^Group=werewolf$/m);
  assert.doesNotMatch(service, /^SupplementaryGroups=.*docker.*$/m);
  assert.match(service, /^User=root$/m);
  assert.match(service, /^Group=root$/m);
  assert.match(service, /^EnvironmentFile=\/etc\/werewolf\/backup\.env$/m);
  assert.match(service, /^Environment=BACKUP_REQUIRE_FIXED_CONTAINER=1$/m);
  assert.match(service, /^Environment=BACKUP_REQUIRE_ENCRYPTION=1$/m);
  assert.match(service, /^ExecStart=\/usr\/local\/libexec\/werewolf\/backup-postgres\.sh$/m);
  assert.match(service, /^ExecStartPost=\/usr\/local\/libexec\/werewolf\/check-backup-freshness\.sh$/m);
  assert.match(service, /^ReadWritePaths=\/var\/backups\/werewolf$/m);
  assert.match(service, /^UMask=0077$/m);
  assert.match(backup, /BACKUP_COMPOSE_PROJECT/);
  assert.match(backup, /BACKUP_REQUIRE_FIXED_CONTAINER/);
  assert.match(backup, /BACKUP_AGE_RECIPIENT/);
  assert.match(backup, /\.sql\.gz\.age/);
  assert.match(backup, /"\$docker_command" ps/);
  assert.match(backup, /"\$docker_command" exec/);
  assert.match(backup, /gzip -t/);
  assert.match(backup, /sha256sum/);
  assert.match(backup, /RCLONE_REMOTE/);
  assert.match(freshness, /BACKUP_MAX_AGE_HOURS/);
  assert.match(freshness, /BACKUP_CLOCK_SKEW_SECONDS/);
  assert.match(freshness, /gzip -t/);
  assert.match(freshness, /sha256sum -c/);
  assert.match(deploy, /node --env-file-if-exists=\.env scripts\/release-manifest\.mjs/);
  assert.match(deploy, /--signature "\$manifest_signature"/);
  assert.match(rollback, /node --env-file-if-exists=\.env scripts\/release-manifest\.mjs/);
  assert.match(rollback, /--signature "\$manifest_signature"/);
  assert.doesNotMatch(deploy, /^\s*scripts\/backup-postgres\.sh$/m);
  assert.match(deploy, /systemctl start "\$backup_service"/);
  assert.match(deploy, /RELEASE_STATE_DIR:-\/var\/lib\/werewolf\/release-state/);
  assert.match(rollback, /RELEASE_STATE_DIR:-\/var\/lib\/werewolf\/release-state/);
  assert.match(runbook, /must not belong to the\s+Docker group/i);
  assert.match(runbook, /\/usr\/local\/libexec\/werewolf\/backup-postgres\.sh/);
  assert.match(runbook, /\/etc\/werewolf\/backup\.env/);
  assert.match(runbook, /root:root and mode `0600`/i);
  assert.match(runbook, /loginctl terminate-user werewolf/);
  assert.match(runbook, /reboot/);
  assert.match(runbook, /docker info[\s\S]*must fail/i);
  assert.match(runbook, /\/srv\/werewolf-releases\/\$expected_source/);
  assert.match(runbook, /GIT_CONFIG_NOSYSTEM=1/);
  assert.match(runbook, /GIT_CONFIG_GLOBAL=\/dev\/null/);
  assert.match(runbook, /```sh\s+set -eu/);
  assert.match(runbook, /if sudo test -e "\$release_source"; then[\s\S]*exit 1[\s\S]*fi/);
  assert.match(runbook, /if \[ "\$actual_source" != "\$expected_source" \]; then[\s\S]*exit 1[\s\S]*fi/);
  assert.match(runbook, /if ! sudo test -e \/etc\/werewolf\/backup\.env/);
  assert.match(runbook, /RELEASE_STATE_DIR=\/var\/lib\/werewolf\/release-state/);
  assert.match(runbook, /\/var\/lib\/werewolf\/releases\/candidate\.json/);
});

test("runbook documents immutable rollback, restore drills, and recovery objectives", () => {
  const runbook = read("docs/operations/production-runbook.md");

  assert.match(runbook, /immutable images/i);
  assert.match(runbook, /expand\/contract/i);
  assert.match(runbook, /restore drill at least monthly/i);
  assert.match(runbook, /RPO 6 hours and RTO 60 minutes/i);
  assert.match(runbook, /200 concurrent clients/i);
  assert.match(runbook, /Active rooms are not migrated/i);
});

test("Lighthouse uses Playwright headless shell on Windows when available", () => {
  const lighthouse = read("scripts/lighthouse.mjs");

  assert.match(lighthouse, /process\.env\.CHROME_PATH \?\? findPlaywrightHeadlessShell\(\)/);
  assert.match(lighthouse, /process\.platform !== "win32"/);
  assert.match(lighthouse, /chromium_headless_shell-/);
  assert.match(lighthouse, /chrome-headless-shell\.exe/);
});
