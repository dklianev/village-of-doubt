import { existsSync } from "node:fs";

const required = [
  "MIGRATION_DATABASE_URL",
  "WEB_DATABASE_URL",
  "GAME_DATABASE_URL",
  "DB_PASSWORD",
  "MIGRATOR_DB_PASSWORD",
  "WEB_DB_PASSWORD",
  "GAME_DB_PASSWORD",
  "WEB_REDIS_URL",
  "GAME_REDIS_URL",
  "COLYSEUS_REDIS_URL",
  "BETTER_AUTH_SECRETS",
  "GAME_TOKEN_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_GAME_SERVER_URL",
  "PUBLIC_WEB_DOMAIN",
  "PUBLIC_WS_DOMAIN",
  "CORS_ORIGIN",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "RELEASE_VERSION",
  "RELEASE_ALLOWED_IMAGE_PREFIX",
  "RELEASE_MANIFEST_PUBLIC_KEY",
  "BACKUP_AGE_RECIPIENT",
  "RCLONE_REMOTE",
  "DATABASE_EVENT_RETENTION_DAYS",
];

const warnings = [];
const errors = [];

for (const key of required) {
  if (!process.env[key]) {
    errors.push(`${key} липсва.`);
  }
}

if (process.env.BETTER_AUTH_SECRET) {
  checkSecret("BETTER_AUTH_SECRET");
  if (process.env.BETTER_AUTH_LEGACY_TOKENS_RETIRED === "true") {
    warnings.push("BETTER_AUTH_SECRET още е зададен въпреки потвърденото оттегляне на legacy токените.");
  }
} else if (process.env.BETTER_AUTH_LEGACY_TOKENS_RETIRED !== "true") {
  errors.push(
    "BETTER_AUTH_LEGACY_TOKENS_RETIRED=true е задължително преди BETTER_AUTH_SECRET да бъде премахнат.",
  );
}
checkBetterAuthSecrets();
checkSecret("GAME_TOKEN_SECRET");
checkSecret("WEB_REDIS_PASSWORD");
checkSecret("GAME_REDIS_PASSWORD");
checkSecret("COLYSEUS_REDIS_PASSWORD");
checkSecret("DB_PASSWORD");
checkSecret("MIGRATOR_DB_PASSWORD");
checkSecret("WEB_DB_PASSWORD");
checkSecret("GAME_DB_PASSWORD");

if (process.env.BETTER_AUTH_URL && !process.env.BETTER_AUTH_URL.startsWith("https://")) {
  errors.push("BETTER_AUTH_URL трябва да е HTTPS в production.");
}

if (process.env.NEXT_PUBLIC_GAME_SERVER_URL && !process.env.NEXT_PUBLIC_GAME_SERVER_URL.startsWith("wss://")) {
  errors.push("NEXT_PUBLIC_GAME_SERVER_URL трябва да започва с wss:// в production.");
}

if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("https://")) {
  errors.push("NEXT_PUBLIC_APP_URL трябва да е HTTPS в production.");
}

const redisConfigurations = [
  ["WEB_REDIS_URL", "WEB_REDIS_PASSWORD", "werewolf_web"],
  ["GAME_REDIS_URL", "GAME_REDIS_PASSWORD", "werewolf_security"],
  ["COLYSEUS_REDIS_URL", "COLYSEUS_REDIS_PASSWORD", "werewolf_colyseus"],
];
for (const [urlKey, passwordKey, expectedUsername] of redisConfigurations) {
  const value = process.env[urlKey];
  if (!value) {
    continue;
  }
  try {
    const redisUrl = new URL(value);
    if (redisUrl.protocol !== "redis:" && redisUrl.protocol !== "rediss:") {
      errors.push(`${urlKey} трябва да използва redis:// или rediss://.`);
    }
    if (decodeURIComponent(redisUrl.username) !== expectedUsername) {
      errors.push(`${urlKey} трябва да използва Redis ACL user ${expectedUsername}.`);
    }
    if (!redisUrl.password && !process.env[passwordKey]) {
      errors.push(`${passwordKey} е задължителен за production Redis.`);
    }
  } catch {
    errors.push(`${urlKey} не е валиден URL.`);
  }
}

const redisPasswords = [
  process.env.WEB_REDIS_PASSWORD,
  process.env.GAME_REDIS_PASSWORD,
  process.env.COLYSEUS_REDIS_PASSWORD,
].filter(Boolean);
if (new Set(redisPasswords).size !== redisPasswords.length) {
  errors.push("Production Redis ролите трябва да използват различни пароли.");
}

if (process.env.ALLOW_DEV_AUTH === "true") {
  errors.push("ALLOW_DEV_AUTH не трябва да е true в production.");
}

const corsOrigins = (process.env.CORS_ORIGIN ?? process.env.BETTER_AUTH_URL ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (corsOrigins.length === 0) {
  errors.push("CORS_ORIGIN или BETTER_AUTH_URL трябва да е настроен за game-server CORS.");
}
if (corsOrigins.length > 1) {
  errors.push("CORS_ORIGIN трябва да съдържа точно един HTTPS origin, съвместим с Caddy.");
}
if (corsOrigins.some((origin) => origin === "*" || !origin.startsWith("https://"))) {
  errors.push("CORS_ORIGIN трябва да съдържа само конкретни HTTPS origins, не wildcard.");
}

const hasDiscord = Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
const hasGoogle = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
if (!hasDiscord && !hasGoogle) {
  errors.push("Производственото пускане очаква поне един OAuth провайдер (Discord или Google).");
}
if (!hasGoogle) {
  warnings.push("Google OAuth не е конфигуриран; интерфейсът ще покаже само Discord и имейл.");
}
if (!hasDiscord) {
  warnings.push("Discord OAuth не е конфигуриран; интерфейсът ще покаже само Google и имейл.");
}

checkUrlAlignment();
checkDatabaseRoles();
checkSentryDsn("SENTRY_DSN");
checkSentryDsn("NEXT_PUBLIC_SENTRY_DSN");
checkReleaseVersion();
checkReleaseTrust();
checkEventRetention();

for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exit(1);
}

console.log("Production env изглежда готов за deploy.");

function checkSecret(key) {
  const value = process.env[key];
  if (!value) {
    return;
  }
  if (value.length < 32) {
    errors.push(`${key} трябва да е поне 32 символа.`);
  }
  if (/dev-only|replace|change-me|placeholder/i.test(value)) {
    errors.push(`${key} изглежда като placeholder.`);
  }
}

function checkBetterAuthSecrets() {
  const value = process.env.BETTER_AUTH_SECRETS?.trim();
  if (!value) {
    return;
  }

  const versions = [];
  const seen = new Set();
  for (const rawEntry of value.split(",")) {
    const entry = rawEntry.trim();
    const colonIndex = entry.indexOf(":");
    if (colonIndex === -1) {
      errors.push('BETTER_AUTH_SECRETS трябва да използва формат "<version>:<secret>".');
      continue;
    }

    const rawVersion = entry.slice(0, colonIndex).trim();
    const secret = entry.slice(colonIndex + 1).trim();
    if (!/^(?:0|[1-9]\d*)$/.test(rawVersion)) {
      errors.push(`BETTER_AUTH_SECRETS съдържа невалидна версия "${rawVersion}".`);
      continue;
    }

    const version = Number.parseInt(rawVersion, 10);
    if (seen.has(version)) {
      errors.push(`BETTER_AUTH_SECRETS съдържа повторена версия ${version}.`);
    }
    seen.add(version);
    versions.push(version);
    if (secret.length < 32 || /dev-only|replace|change-me|placeholder/i.test(secret)) {
      errors.push(`BETTER_AUTH_SECRETS версия ${version} трябва да е силна тайна с поне 32 символа.`);
    }
  }

  if (
    versions.length > 0
    && versions.some((version, index) => index > 0 && version >= versions[index - 1])
  ) {
    errors.push("BETTER_AUTH_SECRETS трябва да е подреден строго от най-новата към най-старата версия.");
  }
}

function checkUrlAlignment() {
  try {
    const authUrl = new URL(process.env.BETTER_AUTH_URL ?? "");
    const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
    const gameUrl = new URL(process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "");
    if (authUrl.host !== process.env.PUBLIC_WEB_DOMAIN || appUrl.host !== process.env.PUBLIC_WEB_DOMAIN) {
      errors.push("PUBLIC_WEB_DOMAIN трябва да съвпада с BETTER_AUTH_URL и NEXT_PUBLIC_APP_URL.");
    }
    if (gameUrl.host !== process.env.PUBLIC_WS_DOMAIN) {
      errors.push("PUBLIC_WS_DOMAIN трябва да съвпада с NEXT_PUBLIC_GAME_SERVER_URL.");
    }
    if (corsOrigins[0] && corsOrigins[0] !== authUrl.origin) {
      errors.push("CORS_ORIGIN трябва да съвпада с origin-а на BETTER_AUTH_URL.");
    }
  } catch {
    errors.push("Production URL стойностите трябва да са валидни абсолютни URL адреси.");
  }
}

function checkDatabaseRoles() {
  const configurations = [
    {
      urlKey: "MIGRATION_DATABASE_URL",
      passwordKey: "MIGRATOR_DB_PASSWORD",
      username: "werewolf_migrator",
      applicationName: "werewolf-migrator",
    },
    {
      urlKey: "WEB_DATABASE_URL",
      passwordKey: "WEB_DB_PASSWORD",
      username: "werewolf_web",
      applicationName: "werewolf-web",
    },
    {
      urlKey: "GAME_DATABASE_URL",
      passwordKey: "GAME_DB_PASSWORD",
      username: "werewolf_game",
      applicationName: "werewolf-game",
    },
  ];
  const parsedUrls = [];

  for (const configuration of configurations) {
    const value = process.env[configuration.urlKey];
    if (!value) {
      continue;
    }

    try {
      const databaseUrl = new URL(value);
      const username = decodeURIComponent(databaseUrl.username);
      const password = decodeURIComponent(databaseUrl.password);
      const expectedPassword = process.env[configuration.passwordKey];

      if (databaseUrl.protocol !== "postgres:" && databaseUrl.protocol !== "postgresql:") {
        errors.push(`${configuration.urlKey} трябва да използва postgres:// или postgresql://.`);
      }
      if (databaseUrl.hostname !== "postgres" || databaseUrl.pathname !== "/werewolf") {
        errors.push(`${configuration.urlKey} трябва да сочи към postgres/werewolf в production Compose.`);
      }
      if (username !== configuration.username) {
        errors.push(`${configuration.urlKey} трябва да използва ролята ${configuration.username}.`);
      }
      if (!password || (expectedPassword && password !== expectedPassword)) {
        errors.push(`${configuration.passwordKey} не съвпада с паролата в ${configuration.urlKey}.`);
      }
      if (databaseUrl.searchParams.get("application_name") !== configuration.applicationName) {
        errors.push(
          `${configuration.urlKey} трябва да задава application_name=${configuration.applicationName}.`,
        );
      }

      parsedUrls.push({ key: configuration.urlKey, username, password });
    } catch {
      errors.push(`${configuration.urlKey} не е валиден URL.`);
    }
  }

  if (new Set(parsedUrls.map((item) => item.username)).size !== parsedUrls.length) {
    errors.push("MIGRATION_DATABASE_URL, WEB_DATABASE_URL и GAME_DATABASE_URL трябва да използват различни роли.");
  }

  const configuredPasswords = [
    process.env.DB_PASSWORD,
    process.env.MIGRATOR_DB_PASSWORD,
    process.env.WEB_DB_PASSWORD,
    process.env.GAME_DB_PASSWORD,
  ].filter(Boolean);
  if (new Set(configuredPasswords).size !== configuredPasswords.length) {
    errors.push("Production database ролите трябва да използват различни пароли.");
  }
}

function checkSentryDsn(key) {
  const value = process.env[key];
  if (value && !value.startsWith("https://")) {
    errors.push(`${key} трябва да е HTTPS DSN.`);
  }
}

function checkReleaseVersion() {
  const value = process.env.RELEASE_VERSION?.trim();
  if (!value) {
    return;
  }
  if (value.length < 7 || /^(?:unknown|latest|dev|development|local|main)$/i.test(value) || /replace|change-me|placeholder/i.test(value)) {
    errors.push("RELEASE_VERSION трябва да е immutable non-placeholder release identifier.");
  }
}

function checkReleaseTrust() {
  const prefix = process.env.RELEASE_ALLOWED_IMAGE_PREFIX?.trim();
  if (prefix && !/^ghcr\.io\/[a-z0-9][a-z0-9._/-]*$/i.test(prefix.replace(/\/$/, ""))) {
    errors.push("RELEASE_ALLOWED_IMAGE_PREFIX трябва да е конкретен ghcr.io repository path.");
  }

  const publicKeyPath = process.env.RELEASE_MANIFEST_PUBLIC_KEY?.trim();
  if (publicKeyPath && !existsSync(publicKeyPath)) {
    errors.push("RELEASE_MANIFEST_PUBLIC_KEY трябва да сочи към съществуващ Ed25519 public key файл.");
  }

  const recipient = process.env.BACKUP_AGE_RECIPIENT?.trim();
  if (recipient && !/^age1[0-9a-z]+$/i.test(recipient)) {
    errors.push("BACKUP_AGE_RECIPIENT трябва да е валиден age recipient.");
  }
}

function checkEventRetention() {
  const value = process.env.DATABASE_EVENT_RETENTION_DAYS;
  if (!value) {
    return;
  }
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 3_650) {
    errors.push("DATABASE_EVENT_RETENTION_DAYS трябва да е цяло число между 1 и 3650.");
  }
}
