import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function validProductionEnv() {
  return {
    MIGRATION_DATABASE_URL: "postgres://werewolf_migrator:migrator-password-000000000000000000@postgres:5432/werewolf?application_name=werewolf-migrator",
    WEB_DATABASE_URL: "postgres://werewolf_web:web-password-000000000000000000000000@postgres:5432/werewolf?application_name=werewolf-web",
    GAME_DATABASE_URL: "postgres://werewolf_game:game-password-00000000000000000000000@postgres:5432/werewolf?application_name=werewolf-game",
    DB_PASSWORD: "admin-password-00000000000000000000000",
    MIGRATOR_DB_PASSWORD: "migrator-password-000000000000000000",
    WEB_DB_PASSWORD: "web-password-000000000000000000000000",
    GAME_DB_PASSWORD: "game-password-00000000000000000000000",
    WEB_REDIS_URL: "redis://werewolf_web@redis:6379",
    GAME_REDIS_URL: "redis://werewolf_security@redis:6379",
    COLYSEUS_REDIS_URL: "redis://werewolf_colyseus@redis:6379",
    WEB_REDIS_PASSWORD: "web-redis-password-00000000000000000000",
    GAME_REDIS_PASSWORD: "game-redis-password-0000000000000000000",
    COLYSEUS_REDIS_PASSWORD: "colyseus-redis-password-000000000000000",
    BETTER_AUTH_SECRET: "legacy-auth-secret-00000000000000000000",
    BETTER_AUTH_SECRETS: "2:current-auth-secret-0000000000000000000,1:previous-auth-secret-000000000000000000",
    BETTER_AUTH_LEGACY_TOKENS_RETIRED: "false",
    GAME_TOKEN_SECRET: "game-token-secret-000000000000000000000",
    BETTER_AUTH_URL: "https://web.example.test",
    NEXT_PUBLIC_APP_URL: "https://web.example.test",
    NEXT_PUBLIC_GAME_SERVER_URL: "wss://ws.example.test",
    PUBLIC_WEB_DOMAIN: "web.example.test",
    PUBLIC_WS_DOMAIN: "ws.example.test",
    CORS_ORIGIN: "https://web.example.test",
    ALLOW_DEV_AUTH: "false",
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
    DISCORD_CLIENT_ID: "discord-client",
    DISCORD_CLIENT_SECRET: "discord-secret",
    RESEND_API_KEY: "resend-key",
    RESEND_FROM: "Werewolf <noreply@example.test>",
    REPORTS_NOTIFY_EMAIL: "reports@example.test",
    SENTRY_DSN: "https://public@sentry.example.test/1",
    NEXT_PUBLIC_SENTRY_DSN: "https://public@sentry.example.test/2",
    RELEASE_VERSION: "release-2026-08-27.1",
    RELEASE_ALLOWED_IMAGE_PREFIX: "ghcr.io/example/project",
    RELEASE_MANIFEST_PUBLIC_KEY: process.execPath,
    BACKUP_AGE_RECIPIENT: "age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
    RCLONE_REMOTE: "encrypted-backups:werewolf/backups",
    RCLONE_DELETION_LEDGER_REMOTE: "encrypted-ledger:werewolf/deletion-ledger",
    RCLONE_BACKUP_RETENTION_DAYS: "30",
    DATABASE_STALE_ACTIVE_HOURS: "24",
    DATABASE_EVENT_RETENTION_DAYS: "365",
    MIGRATION_LOCK_TIMEOUT_MS: "5000",
    MIGRATION_STATEMENT_TIMEOUT_MS: "300000",
    MIGRATION_PROCESS_TIMEOUT_SECONDS: "600",
    COMPOSE_WAIT_TIMEOUT_SECONDS: "120",
    RELEASE_HEALTH_TIMEOUT_SECONDS: "240",
    GAME_DRAIN_TIMEOUT_MS: "120000",
    GAME_DRAIN_POLL_INTERVAL_MS: "1000",
    GAME_REDIS_CLOSE_TIMEOUT_MS: "5000",
    GAME_DEPLOY_DRAIN_MAX_AGE_MS: "3600000",
    WEB_NODE_MAX_OLD_SPACE_MB: "560",
    GAME_NODE_MAX_OLD_SPACE_MB: "800",
  };
}

function runChecker(overrides = {}) {
  return spawnSync(process.execPath, ["scripts/check-production-env.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      ComSpec: process.env.ComSpec,
      ...validProductionEnv(),
      ...overrides,
    },
  });
}

test("accepts a complete production notification and OAuth configuration", () => {
  const result = runChecker();
  assert.equal(result.status, 0, result.stderr);
});

test("requires isolated off-site backup and deletion-ledger destinations", () => {
  for (const overrides of [
    { RCLONE_DELETION_LEDGER_REMOTE: "" },
    { RCLONE_BACKUP_RETENTION_DAYS: "31" },
    {
      RCLONE_REMOTE: "shared:werewolf/backups",
      RCLONE_DELETION_LEDGER_REMOTE: "shared:werewolf/deletion-ledger",
    },
  ]) {
    const result = runChecker(overrides);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /RCLONE_/);
  }
});

test("fails closed when the report notification recipient is absent or malformed", () => {
  for (const value of ["", "not-an-email"]) {
    const result = runChecker({ REPORTS_NOTIFY_EMAIL: value });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /REPORTS_NOTIFY_EMAIL/);
  }
});

test("requires both OAuth providers because both controls are rendered", () => {
  for (const key of ["GOOGLE_CLIENT_SECRET", "DISCORD_CLIENT_SECRET"]) {
    const result = runChecker({ [key]: "" });
    assert.notEqual(result.status, 0, key);
    assert.match(result.stderr, new RegExp(key.replace("_CLIENT_SECRET", ""), "i"));
  }
});

test("rejects timeout budgets that cannot bound the migrator", () => {
  const result = runChecker({
    MIGRATION_STATEMENT_TIMEOUT_MS: "700000",
    MIGRATION_PROCESS_TIMEOUT_SECONDS: "600",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MIGRATION_STATEMENT_TIMEOUT_MS.*MIGRATION_PROCESS_TIMEOUT_SECONDS/s);
});

test("rejects game shutdown budgets that exceed the Compose grace period", () => {
  const result = runChecker({ GAME_DRAIN_TIMEOUT_MS: "121000" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /GAME_DRAIN_TIMEOUT_MS/);
});

test("rejects Node heap caps that leave insufficient native-memory headroom", () => {
  const result = runChecker({ WEB_NODE_MAX_OLD_SPACE_MB: "700" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /WEB_NODE_MAX_OLD_SPACE_MB/);
});
