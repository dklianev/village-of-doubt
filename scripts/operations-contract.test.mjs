import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const readOptional = (path) => existsSync(path) ? read(path) : "";

test("developer, CI, production, and asset runtimes pin Node 24.19.0", () => {
  const packageJson = JSON.parse(read("package.json"));
  const workflow = read(".github/workflows/ci.yml");
  const browserWorkflow = read(".github/workflows/browser-quality.yml");
  const webDockerfile = read("apps/web/Dockerfile");
  const gameDockerfile = read("apps/game-server/Dockerfile");
  const assetRunner = read("scripts/run-asset-generators.mjs");

  assert.equal(readOptional(".nvmrc").trim(), "24.19.0");
  assert.equal(readOptional(".node-version").trim(), "24.19.0");
  assert.equal(packageJson.engines?.node, ">=24.19.0 <25");
  assert.equal((workflow.match(/node-version: 24\.19\.0/g) ?? []).length, 3);
  assert.equal((browserWorkflow.match(/node-version: 24\.19\.0/g) ?? []).length, 1);
  assert.match(webDockerfile, /^FROM node:24\.19\.0-alpine@sha256:[a-f0-9]{64} AS base$/m);
  assert.match(gameDockerfile, /^FROM node:24\.19\.0-alpine@sha256:[a-f0-9]{64} AS base$/m);
  assert.match(assetRunner, /node:24\.19\.0-bookworm@sha256:[a-f0-9]{64}/);
  assert.match(packageJson.scripts.visual, /grep-invert @play-matrix/);
  assert.match(packageJson.scripts["visual:matrix"], /grep @play-matrix/);
  assert.match(workflow, /M35_SHARD_INDEX/);
  assert.match(workflow, /M35_SHARD_TOTAL/);
  assert.match(workflow, /pnpm visual:matrix/);
});

test("game-server avoids the unused Colyseus auth and playground dependency surface", () => {
  const packageJson = JSON.parse(read("apps/game-server/package.json"));
  const workspaceConfig = read("pnpm-workspace.yaml");
  const sourceFiles = [
    "apps/game-server/src/rooms/GameRoom.ts",
    "apps/game-server/src/rooms/game-room-runtime.ts",
    "apps/game-server/src/rooms/player-presence-manager.ts",
    "apps/game-server/src/rooms/private-event-dispatcher.ts",
    "apps/game-server/src/rooms/room-chat-router.ts",
  ];

  assert.equal(packageJson.dependencies?.colyseus, undefined);
  assert.doesNotMatch(workspaceConfig, /CVE-2025-14505/);
  for (const sourceFile of sourceFiles) {
    assert.doesNotMatch(read(sourceFile), /from ["']colyseus["']/);
  }
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
  assert.match(roleReconciler, /ALTER FUNCTION %I\.%I\(%s\) OWNER TO werewolf_migrator/);
  assert.match(roleReconciler, /REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, werewolf_web, werewolf_game/);
  assert.match(roleReconciler, /ALTER DEFAULT PRIVILEGES FOR ROLE werewolf_migrator IN SCHEMA public/);
  assert.match(roleReconciler, /REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/);
  assert.doesNotMatch(roleReconciler, /GRANT ALL[^;]*TO werewolf_(?:web|game)/);
  assert.match(roleReconciler, /'GRANT EXECUTE ON FUNCTION %s TO werewolf_web'/);
  assert.match(roleReconciler, /public\.werewolf_prepare_account_deletion\(text, text\)/);
  assert.equal(
    (roleReconciler.match(/public\.werewolf_scrub_account_event_value\(jsonb, text, text, text\[\], boolean, boolean, text\[\], boolean\)/g) ?? []).length,
    1,
    "The recursive payload scrub helper must be revoked but never granted to the web role.",
  );
  assert.equal(
    (roleReconciler.match(/public\.werewolf_scrub_account_events\(text\)/g) ?? []).length,
    1,
    "The account scrub implementation must be revoked but never granted to the web role.",
  );
  assert.doesNotMatch(roleReconciler, /werewolf_scrub_account_events\(text, jsonb\)/);
  assert.equal(
    (roleReconciler.match(/public\.werewolf_delete_account\(text, text\)/g) ?? []).length,
    2,
    "Only the atomic account deletion boundary should be revoked and then granted to the web role.",
  );
  assert.match(roleReconciler, /WHERE to_regprocedure\(function_name\) IS NOT NULL/);
  assert.match(roleReconciler, /WHEN 'games' THEN 'SELECT, UPDATE'/);
  assert.match(roleReconciler, /WHEN 'game_events' THEN 'SELECT, DELETE'/);
  assert.doesNotMatch(roleReconciler, /WHEN 'games' THEN 'SELECT, INSERT, UPDATE, DELETE'/);
  assert.doesNotMatch(roleReconciler, /WHEN 'game_events' THEN 'SELECT, UPDATE, DELETE'/);
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

test("production Redis uses isolated least-privilege service identities", () => {
  const compose = read("docker-compose.yml");
  const entrypoint = read("scripts/redis-entrypoint.sh");
  const envExample = read(".env.example");

  for (const identity of ["werewolf_web", "werewolf_security", "werewolf_colyseus"]) {
    assert.match(entrypoint, new RegExp(`user ${identity} on`));
    assert.match(compose, new RegExp(`redis://${identity}@redis:6379`));
  }
  assert.match(entrypoint, /user default off/);
  assert.match(entrypoint, /werewolf_web[\s\S]*~wm:rate:\*/);
  assert.match(entrypoint, /werewolf_security[\s\S]*~wm:security:\*/);
  assert.match(entrypoint, /werewolf_security[^\n]*~wm:health:security:\*/);
  assert.doesNotMatch(entrypoint, /werewolf_web[^\n]*~\*/);
  assert.doesNotMatch(entrypoint, /werewolf_security[^\n]*~\*/);
  assert.doesNotMatch(entrypoint, /werewolf_colyseus[^\n]*~\*/);
  assert.doesNotMatch(entrypoint, /werewolf_colyseus[^\n]*\+@all/);
  assert.match(entrypoint, /werewolf_colyseus[^\n]*~roomcaches/);
  assert.match(entrypoint, /werewolf_colyseus[^\n]*~ch:\*/);
  assert.match(entrypoint, /werewolf_colyseus[^\n]*&ipc:\*/);
  for (const secret of [
    "WEB_REDIS_PASSWORD",
    "GAME_REDIS_PASSWORD",
    "COLYSEUS_REDIS_PASSWORD",
  ]) {
    assert.match(envExample, new RegExp(`^${secret}=`, "m"));
    assert.match(compose, new RegExp(`${secret}`));
  }
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

test("production-container CI supplies every operational production guard", () => {
  const ci = read(".github/workflows/ci.yml");
  const containersStart = ci.indexOf("  containers:");
  const containersEnd = ci.indexOf("\n  loadtest:", containersStart);
  const containers = ci.slice(containersStart, containersEnd >= 0 ? containersEnd : undefined);

  assert.ok(containersStart >= 0, "CI must define the production containers job.");
  for (const key of [
    "RELEASE_ALLOWED_IMAGE_PREFIX",
    "RELEASE_MANIFEST_PUBLIC_KEY",
    "BACKUP_AGE_RECIPIENT",
    "DATABASE_EVENT_RETENTION_DAYS",
  ]) {
    assert.match(containers, new RegExp(`^\\s{6}${key}:`, "m"));
  }
  assert.match(containers, /openssl genpkey -algorithm Ed25519/);
  assert.match(containers, /openssl pkey[\s\S]*-pubout/);
  assert.ok(
    containers.indexOf("Prepare production trust fixture") < containers.indexOf("Validate production environment"),
    "The release trust key must exist before production env validation.",
  );
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

test("release images wait for the cross-browser quality workflow", () => {
  const browserQuality = read(".github/workflows/browser-quality.yml");
  const release = read(".github/workflows/release.yml");

  assert.match(browserQuality, /^  workflow_call:$/m);
  assert.match(
    release,
    /^  browser-quality:\r?\n    name: Cross-browser release verification\r?\n    uses: \.\/\.github\/workflows\/browser-quality\.yml$/m,
  );
  assert.match(release, /^    needs: \[verify, browser-quality\]$/m);
});

test("roles browser QA opens a fresh mobile document instead of reloading WebKit", () => {
  const frontendE2e = read("scripts/frontend-e2e.mjs");
  const start = frontendE2e.indexOf("async function testRolesCodex()");
  const end = frontendE2e.indexOf("\nasync function testAnonymousEntry()", start);
  const rolesCheck = frontendE2e.slice(start, end);

  assert.ok(start >= 0 && end > start, "The roles QA scenario must remain discoverable.");
  assert.doesNotMatch(rolesCheck, /\.reload\(/);
  assert.match(rolesCheck, /newPage\("roles-codex-mobile", viewports\.mobile\)/);
});

test("auth E2E falls back to its standalone port when the configured local app is offline", () => {
  const authE2e = read("scripts/e2e-auth.mjs");

  assert.match(authE2e, /const standaloneBaseUrl = `http:\/\/127\.0\.0\.1:\$\{webPort\}`/);
  assert.match(
    authE2e,
    /if \(!process\.env\.E2E_AUTH_BASE_URL && !\(await isHealthy\(`\$\{baseUrl\}\/api\/health`\)\)\) \{\s*baseUrl = standaloneBaseUrl;/,
  );
});

test("frontend E2E seeds Better Auth 1.7 credential identities with an issuer", () => {
  const frontendE2e = read("scripts/frontend-e2e.mjs");

  assert.match(
    frontendE2e,
    /issuer:\s*"local:credential",\s*\r?\n\s*accountId:\s*identity\.id,\s*\r?\n\s*providerId:\s*"credential"/,
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

test("container liveness stays shallow while deploy and rollback require deep web readiness", () => {
  const compose = read("docker-compose.yml");
  const deploy = read("scripts/deploy-release.sh");
  const rollback = read("scripts/rollback-release.sh");
  const webStart = compose.indexOf("\n  web:");
  const gameStart = compose.indexOf("\n  game:", webStart);
  const webService = compose.slice(webStart, gameStart);

  assert.ok(webStart >= 0 && gameStart > webStart, "Compose must define web before game.");
  assert.match(webService, /http:\/\/127\.0\.0\.1:3000\/api\/health\s/);
  assert.doesNotMatch(webService, /\/api\/health\/ready/);
  assert.match(deploy, /http:\/\/127\.0\.0\.1:3000\/api\/health\/ready/);
  assert.match(rollback, /http:\/\/127\.0\.0\.1:3000\/api\/health\/ready/);
});

test("production CSP blocks executable attributes and active object content", () => {
  const caddyfile = read("Caddyfile");

  assert.match(caddyfile, /script-src-attr 'none'/);
  assert.match(caddyfile, /object-src 'none'/);
  assert.match(caddyfile, /upgrade-insecure-requests/);
  assert.doesNotMatch(caddyfile, /script-src[^;]*'unsafe-eval'/);
  assert.doesNotMatch(caddyfile, /connect-src[^;]*(?:http:|ws:)/);
});

test("deploy drain reads operational stats only through the game container loopback", () => {
  const drain = read("scripts/deploy-drain.mjs");
  const appConfig = read("apps/game-server/src/app.config.ts");

  assert.match(drain, /docker[\s\S]*compose[\s\S]*exec[\s\S]*game/);
  assert.match(drain, /http:\/\/127\.0\.0\.1:2567\/operations\/stats/);
  assert.doesNotMatch(drain, /DEPLOY_STATS_URL|https:\/\/\$\{domain\}\/stats/);
  assert.doesNotMatch(appConfig, /app\.get\("\/stats"/);
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
  const backupManifest = read("scripts/backup-manifest.mjs");
  const restore = read("scripts/restore-postgres.sh");
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
  assert.match(service, /^Environment=BACKUP_REQUIRE_SIGNATURE=1$/m);
  assert.match(service, /^Environment=BACKUP_REQUIRE_ACTIVE_RELEASE=1$/m);
  assert.match(service, /^Environment=BACKUP_RELEASE_MANIFEST=\/var\/lib\/werewolf\/release-state\/current\.json$/m);
  assert.match(service, /^Environment=BACKUP_RELEASE_MANIFEST_COMMAND=\/usr\/local\/libexec\/werewolf\/release-manifest\.mjs$/m);
  assert.match(service, /^ExecStart=\/usr\/local\/libexec\/werewolf\/backup-postgres\.sh$/m);
  assert.match(service, /^ExecStartPost=\/usr\/local\/libexec\/werewolf\/check-backup-freshness\.sh$/m);
  assert.match(service, /^ReadWritePaths=\/var\/backups\/werewolf$/m);
  assert.match(service, /^UMask=0077$/m);
  assert.match(backup, /BACKUP_COMPOSE_PROJECT/);
  assert.match(backup, /BACKUP_REQUIRE_FIXED_CONTAINER/);
  assert.match(backup, /BACKUP_AGE_RECIPIENT/);
  assert.match(backup, /BACKUP_SIGNING_PRIVATE_KEY_FILE/);
  assert.match(backup, /BACKUP_RELEASE_MANIFEST_PUBLIC_KEY_FILE/);
  assert.match(backup, /--signature "\$release_manifest_signature"/);
  assert.match(backup, /release_version="\$RELEASE_VERSION"/);
  assert.match(backup, /migration_head="\$MIGRATION_HEAD"/);
  assert.match(backup, /backup_file\.manifest\.json/);
  assert.match(freshness, /BACKUP_SIGNING_PUBLIC_KEY_FILE/);
  assert.match(backupManifest, /ed25519/);
  assert.match(restore, /BACKUP_SIGNING_PUBLIC_KEY_FILE/);
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
  assert.match(runbook, /\/usr\/local\/libexec\/werewolf\/release-manifest\.mjs/);
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
