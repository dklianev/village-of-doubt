import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const webPort = process.env.E2E_AUTH_WEB_PORT ?? "3412";
let baseUrl = process.env.E2E_AUTH_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? `http://127.0.0.1:${webPort}`;
const hasDatabase = Boolean(process.env.DATABASE_URL);
const testSecret = "auth-e2e-secret-that-is-long-enough";
const processes = [];
const standaloneServer = "apps/web/.next/standalone/apps/web/server.js";

if (!process.env.E2E_AUTH_BASE_URL && !(await isHealthy(`${baseUrl}/api/health`))) {
  ensureStandaloneAssets();
  const web = start("auth-web", process.execPath, [standaloneServer], {
    PORT: webPort,
    BETTER_AUTH_URL: baseUrl,
    NEXT_PUBLIC_APP_URL: baseUrl,
    NEXT_PUBLIC_GAME_SERVER_URL: "ws://127.0.0.1:2567",
    BETTER_AUTH_SECRET: testSecret,
    GAME_TOKEN_SECRET: testSecret,
    ALLOW_DEV_AUTH: "true",
  });
  processes.push(web);
  await waitForHealth(`${baseUrl}/api/health`, "auth web");
}

const browser = await chromium.launch({ headless: true });
let failures = 0;

const scenarios = [
  ["auth gate redirect", authGateRedirect],
  ["sign-in surface", signInSurface],
  ["email registration", hasDatabase ? emailRegistration : skipped("DATABASE_URL липсва")],
  ["authenticated create redirect return", hasDatabase ? authenticatedCreateReturn : skipped("DATABASE_URL липсва")],
  ["account deletion", hasDatabase ? accountDeletion : skipped("DATABASE_URL липсва")],
];

for (const [name, run] of scenarios) {
  const context = await browser.newContext();
  await context.addInitScript(() => window.localStorage.setItem("cookie-consent", "1"));
  const page = await context.newPage();
  try {
    console.log(`▶ ${name}`);
    await run(page);
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await context.close();
  }
}

await browser.close();
await Promise.all(processes.map(stop));
if (failures > 0) {
  process.exit(1);
}

async function authGateRedirect(page) {
  await page.goto(`${baseUrl}/werewolf/create`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/sign-in\?redirect=/);
  const url = new URL(page.url());
  if (url.searchParams.get("redirect") !== "/werewolf/create") {
    throw new Error(`Очаквах redirect=/werewolf/create, получих ${url.searchParams.get("redirect")}`);
  }
}

async function signInSurface(page) {
  await page.goto(`${baseUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Покажи се на масата" }).waitFor();
  await page.getByRole("button", { name: "Продължи с Google" }).waitFor();
  await page.getByRole("button", { name: "Продължи с Discord" }).waitFor();
}

async function emailRegistration(page) {
  const email = `launch-${Date.now()}@local.invalid`;
  await page.goto(`${baseUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Нов профил" }).click();
  await page.getByLabel("Име на масата").fill("Тест Играч");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill("Test1234!");
  await page.getByRole("button", { name: "Създай профил" }).click();
  await page.waitForURL(`${baseUrl}/`, { timeout: 10_000 });
  await page.locator(".auth-chip-avatar").waitFor({ timeout: 10_000 });
}

async function authenticatedCreateReturn(page) {
  const email = `return-${Date.now()}@local.invalid`;
  await page.goto(`${baseUrl}/werewolf/create`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/sign-in\?redirect=/);
  await page.getByRole("tab", { name: "Нов профил" }).click();
  await page.getByLabel("Име на масата").fill("Връщане");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill("Test1234!");
  await page.getByRole("button", { name: "Създай профил" }).click();
  await page.waitForURL(`${baseUrl}/werewolf/create`, { timeout: 10_000 });
  await page.getByText("Създай частна стая").waitFor();
}

async function accountDeletion(page) {
  const email = `delete-${Date.now()}@local.invalid`;
  await page.goto(`${baseUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Нов профил" }).click();
  await page.getByLabel("Име на масата").fill("За Изтриване");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill("Test1234!");
  await page.getByRole("button", { name: "Създай профил" }).click();
  await page.waitForURL(`${baseUrl}/`, { timeout: 10_000 });
  await page.goto(`${baseUrl}/account`, { waitUntil: "domcontentloaded" });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Изтрий профила/ }).click();
  await page.waitForURL(`${baseUrl}/`, { timeout: 10_000 });
}

function skipped(reason) {
  return async () => {
    console.log(`  пропуснато: ${reason}`);
  };
}

async function isHealthy(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(url, label) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw lastError ?? new Error(`${label} не стартира навреме.`);
}

function ensureStandaloneAssets() {
  if (!existsSync(standaloneServer)) {
    throw new Error(`Липсва standalone server ${standaloneServer}. Пусни pnpm build преди pnpm e2e:auth.`);
  }

  const standaloneAppDir = dirname(standaloneServer);
  mkdirSync(`${standaloneAppDir}/.next`, { recursive: true });
  cpSync("apps/web/.next/static", `${standaloneAppDir}/.next/static`, { recursive: true, force: true });
  cpSync("apps/web/public", `${standaloneAppDir}/public`, { recursive: true, force: true });
}

function start(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  return child;
}

async function stop(child) {
  if (!child.pid || child.killed) {
    return;
  }
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
      killer.on("exit", resolve);
      killer.on("error", resolve);
    });
    return;
  }
  child.kill("SIGTERM");
}

process.on("exit", () => {
  for (const child of processes) {
    if (child.pid && !child.killed) {
      child.kill();
    }
  }
});
