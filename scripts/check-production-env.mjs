const required = [
  "DATABASE_URL",
  "REDIS_URL",
  "BETTER_AUTH_SECRET",
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
  "RCLONE_REMOTE",
];

const warnings = [];
const errors = [];

for (const key of required) {
  if (!process.env[key]) {
    errors.push(`${key} липсва.`);
  }
}

checkSecret("BETTER_AUTH_SECRET");
checkSecret("GAME_TOKEN_SECRET");
checkSecret("REDIS_PASSWORD");

if (process.env.BETTER_AUTH_URL && !process.env.BETTER_AUTH_URL.startsWith("https://")) {
  errors.push("BETTER_AUTH_URL трябва да е HTTPS в production.");
}

if (process.env.NEXT_PUBLIC_GAME_SERVER_URL && !process.env.NEXT_PUBLIC_GAME_SERVER_URL.startsWith("wss://")) {
  errors.push("NEXT_PUBLIC_GAME_SERVER_URL трябва да започва с wss:// в production.");
}

if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("https://")) {
  errors.push("NEXT_PUBLIC_APP_URL трябва да е HTTPS в production.");
}

if (process.env.REDIS_URL) {
  try {
    const redisUrl = new URL(process.env.REDIS_URL);
    if (redisUrl.protocol !== "redis:" && redisUrl.protocol !== "rediss:") {
      errors.push("REDIS_URL трябва да използва redis:// или rediss://.");
    }
    if (!redisUrl.password && !process.env.REDIS_PASSWORD && !process.env.REDIS_PASSWORD_FILE) {
      errors.push("REDIS_PASSWORD или REDIS_PASSWORD_FILE е задължителен за production Redis.");
    }
  } catch {
    errors.push("REDIS_URL не е валиден URL.");
  }
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
checkDatabaseCredentials();
checkSentryDsn("SENTRY_DSN");
checkSentryDsn("NEXT_PUBLIC_SENTRY_DSN");
checkReleaseVersion();

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

function checkDatabaseCredentials() {
  if (!process.env.DATABASE_URL) {
    return;
  }
  try {
    const databaseUrl = new URL(process.env.DATABASE_URL);
    if (databaseUrl.hostname === "postgres") {
      if (!process.env.DB_PASSWORD) {
        errors.push("DB_PASSWORD липсва за Docker production DATABASE_URL.");
      } else if (decodeURIComponent(databaseUrl.password) !== process.env.DB_PASSWORD) {
        errors.push("DB_PASSWORD не съвпада с паролата в DATABASE_URL.");
      }
    }
  } catch {
    errors.push("DATABASE_URL не е валиден URL.");
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
