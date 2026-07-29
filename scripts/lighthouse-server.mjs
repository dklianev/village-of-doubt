import { cpSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const serverPath = resolve("apps/web/.next/standalone/apps/web/server.js");
if (!existsSync(serverPath)) {
  throw new Error(`Missing production web build at ${serverPath}. Run pnpm build first.`);
}

const standaloneAppDir = dirname(serverPath);
cpSync("apps/web/.next/static", resolve(standaloneAppDir, ".next/static"), {
  recursive: true,
  force: true,
});
cpSync("apps/web/public", resolve(standaloneAppDir, "public"), {
  recursive: true,
  force: true,
});

const port = process.env.LHCI_PORT ?? "3410";
const baseUrl = `http://127.0.0.1:${port}`;
process.env.NODE_ENV = "production";
process.env.PORT = port;
process.env.HOSTNAME = "127.0.0.1";
process.env.BETTER_AUTH_URL ??= baseUrl;
process.env.NEXT_PUBLIC_APP_URL ??= baseUrl;
process.env.NEXT_PUBLIC_GAME_SERVER_URL ??= "ws://127.0.0.1:9";
process.env.BETTER_AUTH_SECRET ??= "lighthouse-better-auth-secret-that-is-long-enough";
process.env.GAME_TOKEN_SECRET ??= "lighthouse-game-token-secret-that-is-long-enough";
process.env.ALLOW_DEV_AUTH = "false";

await import(pathToFileURL(serverPath).href);
