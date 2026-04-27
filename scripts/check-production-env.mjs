const required = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "GAME_TOKEN_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_GAME_SERVER_URL",
  "PUBLIC_WEB_DOMAIN",
  "PUBLIC_WS_DOMAIN",
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

if (process.env.BETTER_AUTH_URL && !process.env.BETTER_AUTH_URL.startsWith("https://")) {
  errors.push("BETTER_AUTH_URL трябва да е HTTPS в production.");
}

if (process.env.NEXT_PUBLIC_GAME_SERVER_URL && !process.env.NEXT_PUBLIC_GAME_SERVER_URL.startsWith("wss://")) {
  errors.push("NEXT_PUBLIC_GAME_SERVER_URL трябва да започва с wss:// в production.");
}

if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith("https://")) {
  errors.push("NEXT_PUBLIC_APP_URL трябва да е HTTPS в production.");
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
if (corsOrigins.some((origin) => origin === "*" || !origin.startsWith("https://"))) {
  errors.push("CORS_ORIGIN трябва да съдържа само конкретни HTTPS origins, не wildcard.");
}

if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
  warnings.push("Discord OAuth не е настроен. Email/password може да работи, но Discord входът няма.");
}

if (!process.env.RCLONE_REMOTE) {
  warnings.push("RCLONE_REMOTE не е настроен. Backup-ите ще останат само локално на Droplet-а.");
}

if (!process.env.DB_PASSWORD && process.env.DATABASE_URL?.includes("@postgres:5432")) {
  warnings.push("DB_PASSWORD липсва, но Docker Compose DATABASE_URL изглежда разчита на него.");
}

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
  if (/replace|change-me|placeholder/i.test(value)) {
    errors.push(`${key} изглежда като placeholder.`);
  }
}
