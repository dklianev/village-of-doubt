import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const webPort = process.env.E2E_AUTH_WEB_PORT ?? "3412";
let baseUrl = process.env.E2E_AUTH_BASE_URL ?? localAppUrl(process.env.NEXT_PUBLIC_APP_URL) ?? `http://127.0.0.1:${webPort}`;
const hasDatabase = Boolean(process.env.DATABASE_URL);
const isLocalOnly = process.env.E2E_LOCAL_ONLY === "true";
const testSecret = "auth-e2e-secret-that-is-long-enough";
const processes = [];
const standaloneServer = "apps/web/.next/standalone/apps/web/server.js";
const emailOutbox = join(process.cwd(), "output", "e2e-auth-emails.jsonl");

if (!hasDatabase && !isLocalOnly) {
  console.error(
    "✗ e2e:auth изисква DATABASE_URL извън локален режим. Стартирай с E2E_LOCAL_ONLY=true за skip или подай DATABASE_URL.",
  );
  process.exit(1);
}

if (!process.env.E2E_AUTH_BASE_URL && !(await isHealthy(`${baseUrl}/api/health`))) {
  ensureStandaloneAssets();
  prepareEmailOutbox();
  const web = start("auth-web", process.execPath, [standaloneServer], {
    PORT: webPort,
    BETTER_AUTH_URL: baseUrl,
    NEXT_PUBLIC_APP_URL: baseUrl,
    NEXT_PUBLIC_GAME_SERVER_URL: "ws://127.0.0.1:2567",
    BETTER_AUTH_SECRET: testSecret,
    GAME_TOKEN_SECRET: testSecret,
    ALLOW_DEV_AUTH: "true",
    E2E_EMAIL_OUTBOX: emailOutbox,
  });
  processes.push(web);
  await waitForHealth(`${baseUrl}/api/health`, "auth web");
}

const browser = await chromium.launch({ headless: true });
let failures = 0;

const scenarios = [
  ["auth gate redirect", authGateRedirect],
  ["sign-in surface", signInSurface],
  ["email registration", hasDatabase ? emailRegistration : skipped("локален режим: DATABASE_URL липсва")],
  ["authenticated create redirect return", hasDatabase ? authenticatedCreateReturn : skipped("локален режим: DATABASE_URL липсва")],
  ["account deletion", hasDatabase ? accountDeletion : skipped("локален режим: DATABASE_URL липсва")],
];

for (const [name, run] of scenarios) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.localStorage.setItem("cookie-consent", "1");
    window.localStorage.setItem("welcome-modal-shown", "1");
  });
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
  await page.getByRole("textbox", { name: "Имейл" }).fill(email);
  await page.getByLabel("Парола", { exact: true }).fill("Test1234!");
  await page.getByRole("button", { name: "Създай профил" }).click();
  await verifyEmailFromOutbox(page, email);
  await page.waitForURL(`${baseUrl}/`, { timeout: 10_000 });
  await page.locator(".auth-chip-avatar").waitFor({ timeout: 10_000 });
}

async function authenticatedCreateReturn(page) {
  const email = `return-${Date.now()}@local.invalid`;
  await page.goto(`${baseUrl}/werewolf/create`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/sign-in\?redirect=/);
  await page.getByRole("tab", { name: "Нов профил" }).click();
  await page.getByLabel("Име на масата").fill("Връщане");
  await page.getByRole("textbox", { name: "Имейл" }).fill(email);
  await page.getByLabel("Парола", { exact: true }).fill("Test1234!");
  await page.getByRole("button", { name: "Създай профил" }).click();
  await verifyEmailFromOutbox(page, email);
  await page.goto(`${baseUrl}/werewolf/create`, { waitUntil: "domcontentloaded" });
  await page.getByText("Създай частна стая").waitFor();
}

async function accountDeletion(page) {
  const email = `delete-${Date.now()}@local.invalid`;
  await page.goto(`${baseUrl}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Нов профил" }).click();
  await page.getByLabel("Име на масата").fill("За Изтриване");
  await page.getByRole("textbox", { name: "Имейл" }).fill(email);
  await page.getByLabel("Парола", { exact: true }).fill("Test1234!");
  await page.getByRole("button", { name: "Създай профил" }).click();
  await verifyEmailFromOutbox(page, email);
  await page.waitForURL(`${baseUrl}/`, { timeout: 10_000 });
  await page.goto(`${baseUrl}/account`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Изтрий моя профил" }).click();
  await page.getByRole("button", { name: "Да, изтрий" }).click();
  await page.waitForURL(`${baseUrl}/`, { timeout: 10_000 });
}

function skipped(reason) {
  return async () => {
    console.log(`  пропуснато: ${reason}`);
  };
}

function prepareEmailOutbox() {
  mkdirSync(dirname(emailOutbox), { recursive: true });
  rmSync(emailOutbox, { force: true });
}

async function verifyEmailFromOutbox(page, email) {
  const message = await waitForEmail(email);
  const verifyUrl = extractVerificationUrl(message.html);
  await page.goto(verifyUrl, { waitUntil: "domcontentloaded" });
}

async function waitForEmail(email) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    for (const message of readEmailOutbox().reverse()) {
      if (message.to === email) {
        return message;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Не получихме тестов verification имейл за ${email}.`);
}

function readEmailOutbox() {
  if (!existsSync(emailOutbox)) {
    return [];
  }

  return readFileSync(emailOutbox, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function extractVerificationUrl(html) {
  const match = html.match(/href="([^"]*\/api\/auth\/verify-email[^"]+)"/);
  if (!match?.[1]) {
    throw new Error("Verification email did not include a verify-email link.");
  }

  return match[1].replaceAll("&amp;", "&");
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

function localAppUrl(value) {
  if (!value) {
    return undefined;
  }
  try {
    const url = new URL(value);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1") {
      return value;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
