import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { skipWelcomeTutorial } from "./e2e-auth-navigation.mjs";

const read = (path) => readFileSync(path, "utf8");
const readOptional = (path) => existsSync(path) ? read(path) : "";

test("Turbo forwards the test worker limit without relaxing test assertions", () => {
  const turbo = JSON.parse(read("turbo.json"));
  assert.ok(turbo.tasks.test.passThroughEnv.includes("VITEST_MAX_WORKERS"));
});

test("developer, CI, production, and asset runtimes pin Node 24.20.0", () => {
  const packageJson = JSON.parse(read("package.json"));
  const workflow = read(".github/workflows/ci.yml");
  const browserWorkflow = read(".github/workflows/browser-quality.yml");
  const webDockerfile = read("apps/web/Dockerfile");
  const gameDockerfile = read("apps/game-server/Dockerfile");
  const assetRunner = read("scripts/run-asset-generators.mjs");

  assert.equal(readOptional(".nvmrc").trim(), "24.20.0");
  assert.equal(readOptional(".node-version").trim(), "24.20.0");
  assert.equal(packageJson.engines?.node, ">=24.20.0 <25");
  assert.equal((workflow.match(/node-version: 24\.20\.0/g) ?? []).length, 3);
  assert.equal((browserWorkflow.match(/node-version: 24\.20\.0/g) ?? []).length, 1);
  assert.match(webDockerfile, /^FROM node:24\.20\.0-alpine@sha256:[a-f0-9]{64} AS base$/m);
  assert.match(gameDockerfile, /^FROM node:24\.20\.0-alpine@sha256:[a-f0-9]{64} AS base$/m);
  assert.match(assetRunner, /node:24\.20\.0-bookworm@sha256:[a-f0-9]{64}/);
  assert.match(packageJson.scripts.visual, /--forbid-only/);
  assert.match(packageJson.scripts.visual, /grep-invert @play-matrix/);
  assert.match(packageJson.scripts["visual:matrix"], /grep @play-matrix/);
  assert.match(read("playwright.config.ts"), /reuseExistingServer: process\.env\.VISUAL_REUSE_SERVER === "1"/);
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
  assert.match(entrypoint, /werewolf_colyseus[^\n]*&wm:health:colyseus:\*/);
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
    "DATABASE_STALE_ACTIVE_HOURS",
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

test("production detailed-event retention defaults to one year", () => {
  const compose = read("docker-compose.yml");
  const example = read(".env.example");
  const runbook = read("docs/operations/database-operations.md");

  assert.match(compose, /DATABASE_EVENT_RETENTION_DAYS:\s*\$\{DATABASE_EVENT_RETENTION_DAYS:-365\}/);
  assert.match(example, /^DATABASE_EVENT_RETENTION_DAYS=365$/m);
  assert.match(runbook, /Detailed event retention defaults to 365 days\./);
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
  assert.match(visualBlock, /- suite: app-1/);
  assert.match(visualBlock, /- suite: app-4/);
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

test("CI partitions app visuals into four native shards while preserving play and UI jobs", () => {
  const ci = read(".github/workflows/ci.yml");
  const visualStart = ci.indexOf("  visual:");
  const visualBlock = ci.slice(visualStart, ci.indexOf("  containers:", visualStart));
  const suites = [...visualBlock.matchAll(/^\s+- suite: (\S+)$/gm)].map((match) => match[1]);

  assert.deepEqual(suites, ["app-1", "app-2", "app-3", "app-4", "play-0", "play-1", "play-2", "play-3", "ui"]);
  for (let shard = 1; shard <= 4; shard += 1) {
    assert.match(visualBlock, new RegExp(`- suite: app-${shard}\\r?\\n +shard: ${shard}/4(?:\\r?\\n|$)`));
  }
  for (let shard = 0; shard < 4; shard += 1) {
    assert.match(visualBlock, new RegExp(`- suite: play-${shard}\\r?\\n +shardIndex: ${shard}(?:\\r?\\n|$)`));
  }
  assert.match(visualBlock, /if: startsWith\(matrix\.suite, 'app-'\)\r?\n +run: pnpm visual --shard=\$\{\{ matrix\.shard \}\}(?:\r?\n|$)/);
  assert.match(visualBlock, /if: startsWith\(matrix\.suite, 'play-'\)\r?\n +run: pnpm visual:matrix\r?\n +env:\r?\n +M35_SHARD_INDEX: \$\{\{ matrix\.shardIndex \}\}\r?\n +M35_SHARD_TOTAL: 4/);
  assert.match(visualBlock, /if: matrix\.suite == 'ui'\r?\n +run: pnpm visual:ui(?:\r?\n|$)/);
  assert.match(visualBlock, /if: matrix\.suite != 'ui'/);
  assert.match(visualBlock, /fail-fast: false/);
  assert.match(visualBlock, /timeout-minutes: 50/);
  assert.match(visualBlock, /name: visual-regression-results-\$\{\{ matrix\.suite \}\}/);

  const packageJson = JSON.parse(read("package.json"));
  assert.equal(packageJson.scripts.visual, "playwright test --config=playwright.config.ts --forbid-only --grep-invert @play-matrix");
  const config = read("playwright.config.ts");
  assert.match(config, /workers: 1,/);
  assert.match(config, /retries: 1,/);
  assert.match(config, /timeout: 45_000,/);
  assert.match(config, /maxDiffPixelRatio: 0\.01,/);
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

function authWelcomeFixture(redirectTo, overrides = {}) {
  const baseUrl = "http://127.0.0.1:3412";
  let currentUrl = overrides.welcomeUrl ?? `${baseUrl}/tutorial?${new URLSearchParams({ welcome: "1", redirect: redirectTo, step: "1" })}`;
  const events = [];
  const page = {
    waitForURL: async (expected, options) => {
      assert.equal(options.timeout, 10_000);
      if (typeof expected === "function") {
        assert.equal(expected(new URL(currentUrl)), true, "unexpected welcome URL");
        events.push("welcome");
      } else {
        assert.equal(currentUrl, expected, "unexpected final redirect");
        events.push("destination");
      }
    },
    getByRole: (role, options) => {
      assert.equal(role, "region");
      assert.equal(options.name, "Наръчник за първа игра");
      assert.equal(options.exact, true);
      return { getByRole: (role, options) => {
        assert.equal(role, "link");
        assert.equal(options.name, "Прескочи");
        assert.equal(options.exact, true);
        return {
          getAttribute: async (attribute) => {
            assert.equal(attribute, "href");
            events.push("href");
            return overrides.href ?? redirectTo;
          },
          click: async () => {
            events.push("skip");
            currentUrl = new URL(overrides.destination ?? redirectTo, baseUrl).href;
          },
        };
      } };
    },
  };
  return { events, run: () => skipWelcomeTutorial(page, baseUrl, redirectTo) };
}

test("auth E2E skips welcome through its UI and asserts the exact final redirect", async () => {
  for (const redirectTo of ["/", "/werewolf/create", "/werewolf/create?mode=werewolves_classic"]) {
    const fixture = authWelcomeFixture(redirectTo);
    await fixture.run();
    assert.deepEqual(fixture.events, ["welcome", "href", "skip", "destination"]);
  }
});

test("auth E2E rejects missing welcome, wrong origin/step/redirect and broken skip navigation", async () => {
  for (const welcomeUrl of [
    "http://127.0.0.1:3412/",
    "http://127.0.0.1:3412/verify-email?error=INVALID_TOKEN",
    "http://127.0.0.1:3412/tutorial?redirect=%2F&step=1",
    "http://127.0.0.1:3412/tutorial?welcome=1&redirect=%2Faccount&step=1",
    "http://127.0.0.1:3412/tutorial?welcome=1&redirect=%2F&step=2",
    "https://other.invalid/tutorial?welcome=1&redirect=%2F&step=1",
  ]) {
    const fixture = authWelcomeFixture("/", { welcomeUrl });
    await assert.rejects(fixture.run(), /unexpected welcome URL/);
    assert.deepEqual(fixture.events, []);
  }
  const wrongLink = authWelcomeFixture("/", { href: "/account" });
  await assert.rejects(wrongLink.run(), /did not preserve the intended redirect/);
  assert.deepEqual(wrongLink.events, ["welcome", "href"]);
  const wrongDestination = authWelcomeFixture("/werewolf/create", { destination: "/" });
  await assert.rejects(wrongDestination.run(), /unexpected final redirect/);
});

test("auth E2E visits the outbox token before welcome and preserves create return without a manual goto", () => {
  const source = read("scripts/e2e-auth.mjs");
  assert.match(source, /import \{ skipWelcomeTutorial \} from "\.\/e2e-auth-navigation\.mjs"/);
  assert.match(source, /const message = await waitForEmail\(email\);\s*const verifyUrl = extractVerificationUrl\(message\.html\);\s*await page\.goto\(verifyUrl, \{ waitUntil: "domcontentloaded" \}\);\s*await skipWelcomeTutorial\(page, baseUrl, redirectTo\)/);
  assert.ok(source.includes("Verification email did not include a verify-email link."));
  assert.ok(source.includes('return match[1].replaceAll("&amp;", "&")'));
  assert.match(source, /await verifyEmailFromOutbox\(page, email, "\/werewolf\/create"\);\s*await page\.locator\("#create-quick-title"\)\.waitFor\(\)/);
});

test("auth E2E retains database, registration, reset token and old/new password session coverage", () => {
  const source = read("scripts/e2e-auth.mjs");
  for (const scenario of ["emailRegistration", "passwordReset", "authenticatedCreateReturn", "accountDeletion"]) {
    assert.match(source, new RegExp(`hasDatabase \\? ${scenario} : skipped`));
  }
  assert.match(source, /await registerAndVerify\(page,/);
  assert.match(source, /waitForEmail\(email, "Нова парола"\)/);
  assert.match(source, /page\.goto\(extractResetPasswordUrl\(message\.html\)/);
  assert.match(source, /const resetSignInUrl = new URL\("\/sign-in", baseUrl\);\s*resetSignInUrl\.searchParams\.set\("redirect", "\/"\);\s*await page\.waitForURL\(resetSignInUrl\.href, \{ timeout: 10_000 \}\)/);
  assert.match(source, /signInWithPassword\(page, email, oldPassword\);\s*await page\.getByRole\("alert"\)\.waitFor\(\)/);
  assert.match(source, /page\.url\(\) !== `\$\{baseUrl\}\/sign-in`/);
  assert.match(source, /signInWithPassword\(page, email, newPassword\);\s*await skipWelcomeTutorial\(page, baseUrl, "\/"\)/);
  assert.match(source, /page\.request\.get\(`\$\{baseUrl\}\/api\/auth\/get-session`\)/);
  assert.match(source, /!sessionResponse\.ok\(\) \|\| session\?\.user\?\.email !== email/);
  assert.doesNotMatch(source, /setItem\(["']tutorial-completed|addCookies\(|route\.fulfill\(|visualAuth|dev-user-id/);
});

test("auth E2E recovery selectors match the current accessible form states", () => {
  const source = read("scripts/e2e-auth.mjs");
  const forgot = read("apps/web/components/auth/ForgotPasswordClient.tsx");
  const reset = read("apps/web/components/auth/ResetPasswordClient.tsx");
  for (const [component, text] of [
    [forgot, "Ако има досие с този имейл, ще получиш линк за нова парола."],
    [reset, "Паролата е сменена."],
    [reset, "Запази паролата"],
  ]) {
    assert.ok(component.includes(text), `Recovery UI changed: ${text}`);
    assert.ok(source.includes(text), `Recovery E2E misses the UI state: ${text}`);
  }
  assert.ok(forgot.includes('role="status"') && reset.includes('role="status"'));
  assert.doesNotMatch(source, /Готово\. Провери имейла си\.|Затвори ключа|Готово\. Сега те водим/);
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
  const migrate = 'run_with_process_timeout "$migration_process_timeout_seconds"';
  const grants = 'run --rm --no-deps postgres-grants';

  assert.match(deploy, new RegExp(environmentPreflight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(deploy.indexOf(environmentPreflight) < deploy.indexOf(preflight));
  assert.match(deploy, new RegExp(preflight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(deploy.indexOf(preflight) < deploy.indexOf(drain));
  assert.ok(deploy.indexOf(roles) < deploy.indexOf(migrate));
  assert.ok(deploy.indexOf(migrate) < deploy.indexOf(grants));
  assert.ok(deploy.indexOf(grants) < deploy.indexOf("up -d --force-recreate --no-build --no-deps web game caddy"));
});

test("container liveness stays shallow while deploy and rollback require deep web readiness", () => {
  const compose = read("docker-compose.yml");
  const caddyfile = read("Caddyfile");
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
  for (const script of [deploy, rollback]) {
    assert.match(script, /ps --format json caddy/);
    assert.match(script, /scripts\/deploy-public-health\.mjs/);
    assert.match(script, /--wait-timeout "\$compose_wait_timeout_seconds" postgres redis/);
  }
  assert.match(caddyfile, /X-Werewolf-Ingress "web"/);
  assert.match(caddyfile, /X-Werewolf-Ingress "game"/);
  assert.match(
    compose,
    /PGOPTIONS:[\s\S]*lock_timeout=[\s\S]*statement_timeout=[\s\S]*idle_in_transaction_session_timeout=/,
  );
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

test("failed deploy and rollback paths can release drain mode without exposing an operator endpoint", () => {
  const appConfig = read("apps/game-server/src/app.config.ts");
  const deployDrain = read("scripts/deploy-drain.mjs");
  const cancelDrain = read("scripts/deploy-cancel-drain.mjs");
  const deploy = read("scripts/deploy-release.sh");
  const rollback = read("scripts/rollback-release.sh");
  const packageJson = JSON.parse(read("package.json"));

  assert.match(appConfig, /app\.delete\("\/operations\/drain", createLocalDrainCancelHandler\(\)\)/);
  assert.match(cancelDrain, /127\.0\.0\.1:2567\/operations\/drain/);
  assert.match(cancelDrain, /method: 'DELETE'/);
  assert.equal(packageJson.scripts["deploy:cancel-drain"], "node scripts/deploy-cancel-drain.mjs");
  assert.match(deployDrain, /requestDrain\("DELETE"\)/);
  for (const script of [deploy, rollback]) {
    assert.match(script, /trap cancel_drain_on_exit EXIT/);
    assert.match(script, /pnpm deploy:cancel-drain/);
    assert.match(script, /SKIP_DEPLOY_DRAIN/);
    assert.match(script, /docker compose ps -q game/);
    assert.match(script, /wget -qO- http:\/\/127\.0\.0\.1:2567\/health/);
  }
});

test("production ingress exposes HTTP3 and disables Next telemetry in image builds", () => {
  const compose = read("docker-compose.yml");
  const webDockerfile = read("apps/web/Dockerfile");

  assert.match(compose, /"443:443\/udp"/);
  assert.match(webDockerfile, /^ENV NEXT_TELEMETRY_DISABLED=1$/m);
});

test("production Redis reserves half of its container budget for AOF and allocator peaks", () => {
  const compose = read("docker-compose.yml");
  const envExample = read(".env.example");

  assert.match(compose, /\$\{REDIS_MAXMEMORY:-128mb\}/);
  assert.match(compose, /\$\{REDIS_CONTAINER_MEMORY:-256m\}/);
  assert.match(envExample, /^REDIS_MAXMEMORY=128mb$/m);
  assert.match(envExample, /^REDIS_CONTAINER_MEMORY=256m$/m);
});

test("game shutdown and release health budgets cover their documented worst cases", () => {
  const compose = read("docker-compose.yml");
  const envExample = read(".env.example");
  const deploy = read("scripts/deploy-release.sh");
  const rollback = read("scripts/rollback-release.sh");

  assert.match(compose, /GAME_DRAIN_TIMEOUT_MS: \$\{GAME_DRAIN_TIMEOUT_MS:-120000\}/);
  assert.match(compose, /GAME_DEPLOY_DRAIN_MAX_AGE_MS: \$\{GAME_DEPLOY_DRAIN_MAX_AGE_MS:-3600000\}/);
  assert.match(compose, /GAME_REDIS_CLOSE_TIMEOUT_MS: \$\{GAME_REDIS_CLOSE_TIMEOUT_MS:-5000\}/);
  assert.match(compose, /stop_grace_period: 260s/);
  assert.match(compose, /NODE_OPTIONS: --max-old-space-size=\$\{WEB_NODE_MAX_OLD_SPACE_MB:-560\}/);
  assert.match(compose, /NODE_OPTIONS: --max-old-space-size=\$\{GAME_NODE_MAX_OLD_SPACE_MB:-800\}/);
  assert.match(envExample, /^RELEASE_HEALTH_TIMEOUT_SECONDS=240$/m);
  assert.match(envExample, /^RELEASE_HEALTH_POLL_INTERVAL_SECONDS=2$/m);
  for (const script of [deploy, rollback]) {
    assert.match(script, /RELEASE_HEALTH_TIMEOUT_SECONDS:-240/);
    assert.match(script, /health_attempts=/);
    assert.doesNotMatch(script, /while \[ "\$attempt" -le 45 \]/);
  }
});

test("Caddy keeps transport health shallow while the game server rejects new matchmaking during drain", () => {
  const caddyfile = read("Caddyfile");
  const gameBlock = caddyfile.slice(caddyfile.indexOf("{$PUBLIC_WS_DOMAIN}"));

  assert.match(gameBlock, /health_uri \/health\s/);
  assert.doesNotMatch(gameBlock, /health_uri \/health\/ready/);
});

test("load testing drives runtime commands, checks p99 spikes, and includes full rooms", () => {
  const loadtest = read("scripts/loadtest.mjs");
  const metrics = read("scripts/loadtest-metrics.mjs");
  const capacity = read("scripts/loadtest-capacity.mjs");
  const packageJson = JSON.parse(read("package.json"));

  assert.match(loadtest, /runActiveHold/);
  assert.match(loadtest, /LOAD_MAX_EVENT_LOOP_P99_UTILIZATION/);
  assert.match(metrics, /eventLoopP99Utilization/);
  assert.match(metrics, /peakEventLoopUtilization/);
  assert.match(capacity, /LOAD_ROOM_SIZE \?\?= "30"/);
  assert.equal(packageJson.scripts["loadtest:capacity"], "node scripts/loadtest-capacity.mjs");
  assert.match(packageJson.scripts["verify:heavy"], /pnpm loadtest:capacity/);
});

test("rollback validates and pulls before drain without replaying old migrations", () => {
  const rollback = read("scripts/rollback-release.sh");
  const preflight = 'docker compose --env-file .env --env-file "$rollback_env" config --quiet';
  const pull = 'docker compose --env-file .env --env-file "$rollback_env" pull web game caddy';
  const drain = "pnpm deploy:drain";

  assert.ok(rollback.indexOf(preflight) >= 0);
  assert.ok(rollback.indexOf(preflight) < rollback.indexOf(pull));
  assert.ok(rollback.indexOf(pull) < rollback.indexOf(drain));
  assert.match(rollback, /up -d --force-recreate --no-build --no-deps web game caddy/);
  assert.doesNotMatch(rollback, /\bpull migrate\b|\brun .*\bmigrate\b/);
});

test("PostgreSQL query observability is enabled without weakening readiness", () => {
  const compose = read("docker-compose.yml");
  const envExample = read(".env.example");
  const roleReconciler = readOptional("scripts/postgres-init/apply-roles.sh");

  assert.match(compose, /shared_preload_libraries=pg_stat_statements/);
  assert.match(compose, /log_min_duration_statement=\$\{POSTGRES_SLOW_QUERY_MS:-500\}/);
  assert.match(compose, /log_parameter_max_length=0/);
  assert.match(compose, /log_parameter_max_length_on_error=0/);
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
  assert.match(restore, /RESTORE_RELEASE_MANIFEST/);
  assert.match(restore, /--signature "\$active_release_signature"/);
  assert.match(restore, /compose pull migrate web game caddy/);
  assert.match(
    restore,
    /up -d --force-recreate --no-build --no-deps --wait/,
  );
  assert.match(backup, /\.sql\.gz\.age/);
  assert.match(backup, /"\$docker_command" ps/);
  assert.match(backup, /"\$docker_command" exec/);
  assert.match(backup, /gzip -t/);
  assert.match(backup, /sha256sum/);
  assert.match(backup, /RCLONE_REMOTE/);
  assert.match(backup, /RCLONE_DELETION_LEDGER_REMOTE/);
  assert.match(backup, /RCLONE_BACKUP_RETENTION_DAYS:-30/);
  assert.match(backup, /--min-age "\$\{rclone_retention_days\}d"/);
  assert.match(backup, /--include 'werewolf_\*\.sql\.gz\*'/);
  assert.match(backup, /werewolf-deletion-ledger-v1/);
  assert.match(restore, /RESTORE_DELETION_LEDGER_FILE/);
  assert.match(restore, /merge_deletion_tombstones/);
  assert.match(runbook, /six-hour ledger RPO/);
  assert.match(runbook, /Hetzner Object Storage/);
  assert.match(freshness, /BACKUP_MAX_AGE_HOURS/);
  assert.match(freshness, /BACKUP_CLOCK_SKEW_SECONDS/);
  assert.match(freshness, /gzip -t/);
  assert.match(freshness, /sha256sum -c/);
  assert.match(deploy, /node --env-file-if-exists=\.env scripts\/release-manifest\.mjs/);
  assert.match(deploy, /--signature "\$manifest_signature"/);
  assert.match(deploy, /rev-parse --verify 'HEAD\^\{commit\}'/);
  assert.match(deploy, /source checkout.*sourceCommit/i);
  assert.match(rollback, /node --env-file-if-exists=\.env scripts\/release-manifest\.mjs/);
  assert.match(rollback, /--signature "\$manifest_signature"/);
  assert.match(rollback, /rev-parse --verify 'HEAD\^\{commit\}'/);
  assert.match(rollback, /source checkout.*sourceCommit/i);
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
  assert.match(runbook, /one replica[\s\S]*shared Next\.js `cacheHandler`[\s\S]*cacheMaxMemorySize: 0/i);
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
