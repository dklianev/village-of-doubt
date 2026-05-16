import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const isWindows = process.platform === "win32";
const processes = [];
const webStandaloneServer = "apps/web/.next/standalone/apps/web/server.js";

async function main() {
  const game = start("game-server", process.execPath, ["apps/game-server/dist/index.js"], {
    GAME_SERVER_PORT: "3567",
    PORT: "3567",
    ALLOW_DEV_AUTH: "true",
    GAME_TOKEN_SECRET: "smoke-test-secret-that-is-long-enough",
    BETTER_AUTH_URL: "http://127.0.0.1:3300",
    CORS_ORIGIN: "http://127.0.0.1:3300",
  });

  await waitForJson("http://127.0.0.1:3567/health", "game-server");

  ensureWebStandaloneAssets();

  const web = start("web", process.execPath, [webStandaloneServer], {
    PORT: "3300",
    BETTER_AUTH_URL: "http://127.0.0.1:3300",
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3300",
    NEXT_PUBLIC_GAME_SERVER_URL: "ws://127.0.0.1:3567",
    BETTER_AUTH_SECRET: "smoke-test-secret-that-is-long-enough",
    GAME_TOKEN_SECRET: "smoke-test-secret-that-is-long-enough",
    ALLOW_DEV_AUTH: "true",
  });

  await waitForJson("http://127.0.0.1:3300/api/health", "web");
  await waitForText("http://127.0.0.1:3300/", "Върколак или Мафия", "landing page");
  await waitForStaticAsset("http://127.0.0.1:3300/", "landing static CSS");
  await waitForText("http://127.0.0.1:3300/sign-in", "Покажи се на масата", "sign-in page");
  await waitForText("http://127.0.0.1:3300/werewolf/create", "Покажи се на масата", "werewolf create auth gate");
  await waitForText("http://127.0.0.1:3300/mafia/create", "Покажи се на масата", "mafia create auth gate");
  await waitForText(
    "http://127.0.0.1:3300/play/SMOKE1?mode=werewolves_classic&players=6&communication=built_in_chat&narrator=automatic&tempo=fast_online",
    "Покажи се на масата",
    "play auth gate",
  );
  await waitForText(
    "http://127.0.0.1:3300/play/SMOKEL?mode=werewolves_classic&players=6&communication=no_chat&narrator=honest_human&tempo=live",
    "Покажи се на масата",
    "live-safe play page",
  );
  await waitForText("http://127.0.0.1:3300/werewolf/roles", "Роли във Върколак", "werewolf roles page");
  await waitForText("http://127.0.0.1:3300/mafia/roles", "Роли в Мафия", "mafia roles page");
  await waitForText("http://127.0.0.1:3300/history", "Архив на масата", "history page");
  await waitForAsset("http://127.0.0.1:3300/game-art/og-preview.png", "OpenGraph game art");
  await waitForAsset("http://127.0.0.1:3300/game-art/og-preview.webp", "optimized OpenGraph game art");
  await waitForAsset("http://127.0.0.1:3300/game-art/transition-night-falls.png", "phase transition game art");
  await waitForAsset("http://127.0.0.1:3300/game-art/transition-night-falls.webp", "optimized phase transition game art");
  await waitForAsset("http://127.0.0.1:3300/game-art/faction-village.png", "faction game art");
  await waitForAsset("http://127.0.0.1:3300/game-art/player-avatar-sheet.png", "avatar sprite sheet");
  await waitForGameToken("http://127.0.0.1:3300/api/game-token");

  console.log("Smoke test passed.");
  await stop(web);
  await stop(game);
}

function ensureWebStandaloneAssets() {
  if (!existsSync(webStandaloneServer)) {
    throw new Error(`Missing Next.js standalone server at ${webStandaloneServer}. Run pnpm build first.`);
  }

  const standaloneAppDir = dirname(webStandaloneServer);
  const standaloneStaticDir = `${standaloneAppDir}/.next/static`;
  const standalonePublicDir = `${standaloneAppDir}/public`;

  mkdirSync(`${standaloneAppDir}/.next`, { recursive: true });
  cpSync("apps/web/.next/static", standaloneStaticDir, { recursive: true, force: true });
  cpSync("apps/web/public", standalonePublicDir, { recursive: true, force: true });
}

function start(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on("exit", (code) => {
    if (!child.isStopping && code !== 0 && code !== null) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });

  processes.push(child);
  return child;
}

async function waitForJson(url, label) {
  const body = await waitFor(url, label);
  const json = JSON.parse(body);
  if (!json.ok) {
    throw new Error(`${label} health endpoint returned ok=false`);
  }
}

async function waitForText(url, expected, label) {
  const body = await waitFor(url, label);
  if (!body.includes(expected)) {
    throw new Error(`${label} did not contain expected text: ${expected}`);
  }
}

async function waitForStaticAsset(pageUrl, label) {
  const body = await waitFor(pageUrl, label);
  const cssPath = body.match(/href="([^"]*\/_next\/static\/[^"]+\.css)"/)?.[1];

  if (!cssPath) {
    throw new Error(`${label} did not include a Next.js CSS asset`);
  }

  const assetUrl = new URL(cssPath, pageUrl).toString();
  const response = await fetch(assetUrl);
  const css = await response.text();
  if (!response.ok || css.length < 100) {
    throw new Error(`${label} failed: ${assetUrl} returned HTTP ${response.status}`);
  }
  if (!css.includes("image-set") || !css.includes(".webp")) {
    throw new Error(`${label} did not include optimized image-set WebP references`);
  }
}

async function waitForAsset(url, label) {
  const response = await fetch(url);
  const bytes = await response.arrayBuffer();
  if (!response.ok || bytes.byteLength < 10_000) {
    throw new Error(`${label} failed: ${url} returned HTTP ${response.status} with ${bytes.byteLength} bytes`);
  }
}

async function waitForGameToken(url) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      code: "SMOKE1",
      devUserId: "smoke-user-0001",
      devDisplayName: "Смоук Играч",
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.roomCode !== "SMOKE1" || typeof body.token !== "string") {
    throw new Error(`game-token smoke failed: HTTP ${response.status}`);
  }
}

async function waitFor(url, label) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.text();
      }
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw lastError ?? new Error(`${label} did not become ready`);
}

async function stop(child) {
  if (!child.pid || child.killed) {
    return;
  }

  child.isStopping = true;

  if (isWindows) {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
      killer.on("exit", resolve);
      killer.on("error", resolve);
    });
    return;
  }

  child.kill("SIGTERM");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("exit", () => {
  for (const child of processes) {
    if (child.pid && !child.killed) {
      child.kill();
    }
  }
});

main().catch(async (error) => {
  console.error(error);
  await Promise.all(processes.map(stop));
  process.exitCode = 1;
});
