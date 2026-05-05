import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const isWindows = process.platform === "win32";
const processes = [];
const webStandaloneServer = "apps/web/.next/standalone/apps/web/server.js";
const artifactDir = "output/playwright";
const webPort = process.env.FRONTEND_E2E_WEB_PORT ?? "3401";
const gamePort = process.env.FRONTEND_E2E_GAME_PORT ?? "3568";
const baseUrl = `http://127.0.0.1:${webPort}`;
const gameUrl = `http://127.0.0.1:${gamePort}`;
const wsUrl = `ws://127.0.0.1:${gamePort}`;
const testSecret = "frontend-e2e-secret-that-is-long-enough";

const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};

let failureCount = 0;
let activeBrowser = null;

async function main() {
  mkdirSync(artifactDir, { recursive: true });
  await buildForE2e();

  const game = start("game-server", process.execPath, ["apps/game-server/dist/index.js"], {
    GAME_SERVER_PORT: gamePort,
    PORT: gamePort,
    ALLOW_DEV_AUTH: "true",
    GAME_TOKEN_SECRET: testSecret,
    BETTER_AUTH_URL: baseUrl,
    CORS_ORIGIN: baseUrl,
  });

  await waitForJson(`${gameUrl}/health`, "game-server");
  ensureWebStandaloneAssets();

  const web = start("web", process.execPath, [webStandaloneServer], {
    PORT: webPort,
    BETTER_AUTH_URL: baseUrl,
    NEXT_PUBLIC_APP_URL: baseUrl,
    NEXT_PUBLIC_GAME_SERVER_URL: wsUrl,
    BETTER_AUTH_SECRET: testSecret,
    GAME_TOKEN_SECRET: testSecret,
    ALLOW_DEV_AUTH: "true",
  });

  await waitForJson(`${baseUrl}/api/health`, "web");

  activeBrowser = await chromium.launch({ headless: true });

  await runCheck("landing desktop layout and theme picker", testLandingDesktop);
  await runCheck("landing mobile layout", testLandingMobile);
  await runCheck("tutorial and offline shell", testTutorialAndOfflineShell);
  await runCheck("lobby mode filtering and manual roles", testLobbyModeFiltering);
  await runCheck("invite lobby family-specific copy and art shell", testInviteLobbyCopy);
  await runCheck("roles codex assets and responsiveness", testRolesCodex);
  await runCheck("anonymous entry basics", testAnonymousEntry);
  await runCheck("history screen basics", testHistoryScreen);
  await runCheck("single-player live play screen", testSinglePlayScreen);
  await runCheck("six-client lobby starts a real game", testSixClientGameStart);

  await activeBrowser.close();
  activeBrowser = null;
  await stop(web);
  await stop(game);

  if (failureCount > 0) {
    throw new Error(`Frontend Playwright QA failed with ${failureCount} failing check(s).`);
  }

  console.log("Frontend Playwright QA passed.");
}

async function testLandingDesktop() {
  const { page, watcher, close } = await newPage("landing-desktop", viewports.desktop);
  try {
    await goto(page, "/", "landing desktop");
    await expectText(page, "Върколак или Мафия");
    await expectText(page, "фолклорен хорър");
    await expectText(page, "градска мистерия");
    await assertNoHorizontalOverflow(page, "landing desktop");
    await assertNoOverlap(page, ".game-choice-werewolf", ".game-choice-mafia", "game picker cards");
    await assertCssBackgroundImagesLoaded(page, "landing desktop");

    await page.locator(".game-choice-mafia").getByRole("link", { name: "Играй" }).click();
    await page.waitForURL("**/mafia/create");
    await expectText(page, "Създай частна стая");
    await assertLocatorAttribute(page.locator("[data-family]").first(), "data-family", "mafia", "mafia lobby theme");
    watcher.assertClean();
  } finally {
    await close();
  }
}

async function testLandingMobile() {
  const { page, watcher, close } = await newPage("landing-mobile", viewports.mobile);
  try {
    await goto(page, "/", "landing mobile");
    await expectText(page, "Върколак или Мафия");
    await expectText(page, "фолклорен хорър");
    await expectText(page, "градска мистерия");
    await assertNoHorizontalOverflow(page, "landing mobile");
    await assertNoOverlap(page, ".game-choice-werewolf", ".game-choice-mafia", "mobile game picker cards");
    watcher.assertClean();
  } finally {
    await close();
  }
}

async function testTutorialAndOfflineShell() {
  const { page, watcher, close } = await newPage("tutorial-offline", viewports.desktop);
  try {
    await goto(page, "/tutorial", "tutorial screen");
    await expectText(page, "Научи масата преди първата нощ.");
    await expectText(page, "Телефонът е карта, не микрофон.");
    await assertNoHorizontalOverflow(page, "tutorial screen");

    await goto(page, "/offline", "offline screen");
    await expectText(page, "Играта чака интернет.");
    await assertNoHorizontalOverflow(page, "offline screen");
    watcher.assertClean();
  } finally {
    await close();
  }
}

async function testLobbyModeFiltering() {
  const { page, watcher, close } = await newPage("lobby-filtering", viewports.desktop);
  try {
    await goto(page, "/werewolf/create", "werewolves lobby");
    await expectText(page, "Създай частна стая");
    await expectSelectValue(page.locator("label", { hasText: "Режим" }).locator("select"), "werewolves_classic");
    let manualRoles = page.getByTestId("manual-roles-panel");
    await manualRoles.locator('input[type="checkbox"]').check();
    await expectTextIn(manualRoles, "Върколак");
    await expectTextIn(manualRoles, "Гадателка");
    await expectNoTextIn(manualRoles, "Дон");

    await goto(page, "/mafia/create", "mafia lobby");
    await expectSelectValue(page.locator("label", { hasText: "Режим" }).locator("select"), "mafia_free");
    await expectInputValue(page.locator("label", { hasText: "Брой играчи" }).locator("input"), "10");
    manualRoles = page.getByTestId("manual-roles-panel");
    await manualRoles.locator('input[type="checkbox"]').check();
    await expectTextIn(manualRoles, "Кръстник");
    await expectTextIn(manualRoles, "Мафиот");
    await expectNoTextIn(manualRoles, "Върколак");
    await assertNoHorizontalOverflow(page, "mafia lobby");
    watcher.assertClean();
  } finally {
    await close();
  }
}

async function testInviteLobbyCopy() {
  const { page, watcher, close } = await newPage("invite-copy", viewports.desktop);
  try {
    await goto(
      page,
      "/lobby/PWMAF1?mode=mafia_sport&players=10&communication=built_in_chat&narrator=automatic&tempo=sport_mafia",
      "mafia invite lobby",
    );
    await expectText(page, "Покана за масата");
    await expectText(page, "досие към задната стая");
    await expectNoText(page, "маршрут до площада");
    await assertLocatorAttribute(page.locator("main").first(), "data-family", "mafia", "mafia invite theme");

    await goto(
      page,
      "/lobby/PWWLF1?mode=werewolves_classic&players=6&communication=built_in_chat&narrator=automatic&tempo=fast_online",
      "werewolves invite lobby",
    );
    await expectText(page, "маршрут до площада");
    await expectNoText(page, "досие към задната стая");
    await assertLocatorAttribute(page.locator("main").first(), "data-family", "werewolves", "werewolves invite theme");
    await assertCssBackgroundImagesLoaded(page, "invite lobbies");
    watcher.assertClean();
  } finally {
    await close();
  }
}

async function testRolesCodex() {
  const { page, watcher, close } = await newPage("roles-codex", viewports.desktop);
  try {
    await goto(page, "/werewolf/roles", "werewolf roles codex");
    await expectText(page, "Роли във Върколак");
    await expectText(page, "Кмет");
    await expectText(page, "Вампир");
    await expectNoText(page, "Кръстник");
    await scrollThroughPage(page);
    await assertHtmlImagesLoaded(page, "roles codex");
    await assertCssBackgroundImagesLoaded(page, "roles codex");
    await assertNoHorizontalOverflow(page, "roles codex desktop");

    await goto(page, "/mafia/roles", "mafia roles codex");
    await expectText(page, "Роли в Мафия");
    await expectText(page, "Кръстник");
    await expectText(page, "Доктор");
    await expectNoTextIn(page.locator("main"), "Върколак");
    await scrollThroughPage(page);
    await assertHtmlImagesLoaded(page, "mafia roles codex");
    await assertCssBackgroundImagesLoaded(page, "mafia roles codex");

    await page.setViewportSize(viewports.mobile);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForSettled(page);
    await assertNoHorizontalOverflow(page, "roles codex mobile");
    watcher.assertClean();
  } finally {
    await close();
  }
}

async function testAnonymousEntry() {
  const { page, watcher, close } = await newPage("anonymous-entry", viewports.desktop);
  try {
    await goto(page, "/mafia/join/ABCD12", "anonymous join");
    await expectText(page, "Влез с име");
    await expectNoText(page, "Регистрация");
    await page.getByRole("textbox", { name: "Потребителско име" }).fill("Плейрайт Играч");
    await expectInputValue(page.getByRole("textbox", { name: "Код на стая" }), "ABCD12");
    await page.getByRole("button", { name: "Влез в стая" }).click();
    await page.waitForURL("**/play/ABCD12?**");
    await assertNoHorizontalOverflow(page, "anonymous join");
    watcher.assertClean();
  } finally {
    await close();
  }
}

async function testHistoryScreen() {
  const { page, watcher, close } = await newPage("history-screen", viewports.desktop);
  try {
    await goto(page, "/history", "history screen");
    await expectText(page, "Завършени игри");
    await assertNoHorizontalOverflow(page, "history screen");
    await assertCssBackgroundImagesLoaded(page, "history screen");
    watcher.assertClean();
  } finally {
    await close();
  }
}

async function testSinglePlayScreen() {
  const { page, watcher, close } = await newPage("single-play", viewports.desktop, {
    userId: "frontend-e2e-solo",
    displayName: "Соло Играч",
  });
  try {
    await goto(
      page,
      "/play/PWSOLO?mode=werewolves_classic&players=6&communication=no_chat&narrator=automatic&tempo=live",
      "single play screen",
    );
    await expectText(page, "Играчите на площада");
    await expectText(page, "Лични сигнали за фазите");
    await expectText(page, "Игра на живо: звукът и вибрацията са изключени по подразбиране");
    await page.waitForSelector(".player-token", { timeout: 10_000 });
    const readyButton = page.getByTestId("ready-toggle");
    await readyButton.waitFor({ state: "visible", timeout: 10_000 });
    await readyButton.click();
    await page.waitForFunction(() => document.querySelector(".player-token.is-ready"), { timeout: 5_000 });
    await assertNoHorizontalOverflow(page, "single play screen");
    watcher.assertClean();
  } finally {
    await close();
  }
}

async function testSixClientGameStart() {
  const code = `PW${String(Date.now()).slice(-4)}`;
  const path = `/play/${code}?mode=werewolves_classic&players=6&communication=built_in_chat&narrator=automatic&tempo=fast_online`;
  const contexts = [];
  const pages = [];
  const watchers = [];

  try {
    for (let index = 0; index < 6; index += 1) {
      const context = await activeBrowser.newContext({ viewport: viewports.desktop });
      await context.addInitScript(
        ({ userId, displayName }) => {
          window.localStorage.setItem("anonymous-player-id", userId);
          window.localStorage.setItem("anonymous-display-name", displayName);
          window.localStorage.setItem("dev-user-id", userId);
          window.localStorage.setItem("dev-display-name", displayName);
        },
        {
          userId: `frontend-e2e-${code}-${index}`,
          displayName: `Тест ${index + 1}`,
        },
      );
      contexts.push(context);
      const page = await context.newPage();
      watchers.push(watchPage(page, `six-client-${index + 1}`));
      pages.push(page);
      await goto(page, path, `six-client ${index + 1}`);
    }

    const host = pages[0];
    await host.waitForFunction(() => document.querySelectorAll(".player-token").length >= 6, { timeout: 15_000 });
    await expectText(host, "Тест 6");
    await host.getByRole("button", { name: "Започни игра" }).first().click();
    await host.waitForSelector('main[data-phase="role_reveal"]', { timeout: 10_000 });

    for (const [index, page] of pages.entries()) {
      await page.waitForSelector('main[data-phase="role_reveal"]', { timeout: 10_000 });
      await expectText(page, "само за теб");
      await assertNoHorizontalOverflow(page, `role reveal client ${index + 1}`);
      await screenshot(page, `six-client-role-reveal-${index + 1}.png`);
    }
    for (const watcher of watchers) {
      watcher.assertClean();
    }
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
}

async function buildForE2e() {
  if (process.env.FRONTEND_E2E_SKIP_BUILD === "true") {
    return;
  }

  const packageManager = packageManagerInvocation();
  await runCommand("production build for frontend e2e", packageManager.command, [...packageManager.args, "build"], {
    NEXT_PUBLIC_APP_URL: baseUrl,
    NEXT_PUBLIC_GAME_SERVER_URL: wsUrl,
    BETTER_AUTH_URL: baseUrl,
    BETTER_AUTH_SECRET: testSecret,
    GAME_TOKEN_SECRET: testSecret,
    ALLOW_DEV_AUTH: "true",
  });
}

async function newPage(label, viewport, identity) {
  const context = await activeBrowser.newContext({ viewport });
  if (identity) {
    await context.addInitScript(
      ({ userId, displayName }) => {
        window.localStorage.setItem("anonymous-player-id", userId);
        window.localStorage.setItem("anonymous-display-name", displayName);
        window.localStorage.setItem("dev-user-id", userId);
        window.localStorage.setItem("dev-display-name", displayName);
      },
      identity,
    );
  }
  const page = await context.newPage();
  const watcher = watchPage(page, label);
  return {
    page,
    watcher,
    close: async () => {
      if (watcher.failed) {
        await screenshot(page, `${label}-failure.png`).catch(() => {});
      }
      await context.close();
    },
  };
}

function watchPage(page, label) {
  const issues = [];
  const ignoreConsolePatterns = [/Download the React DevTools/i];

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    const text = message.text();
    if (ignoreConsolePatterns.some((pattern) => pattern.test(text))) {
      return;
    }
    issues.push(`console error: ${text}`);
  });

  page.on("pageerror", (error) => {
    issues.push(`page error: ${error.message}`);
  });

  page.on("response", (response) => {
    const status = response.status();
    const url = response.url();
    const resourceType = response.request().resourceType();
    if (
      url.startsWith(baseUrl) &&
      status >= 400 &&
      !url.includes("favicon") &&
      ["document", "script", "stylesheet", "image"].includes(resourceType)
    ) {
      issues.push(`${resourceType} ${status}: ${url}`);
    }
  });

  return {
    get failed() {
      return issues.length > 0;
    },
    assertClean() {
      if (issues.length > 0) {
        throw new Error(`${label} produced browser issues:\n${issues.join("\n")}`);
      }
    },
  };
}

async function runCheck(name, fn) {
  try {
    await fn();
    console.log(`ok: ${name}`);
  } catch (error) {
    failureCount += 1;
    console.error(`FAIL: ${name}`);
    console.error(error);
  }
}

async function goto(page, path, label) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await waitForSettled(page);
  await assertNoRuntimeErrorOverlay(page, label);
}

async function waitForSettled(page) {
  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function expectText(page, text) {
  await waitForVisibleText(page.getByText(text, { exact: false }), text);
}

async function expectTextIn(locator, text) {
  await waitForVisibleText(locator.getByText(text, { exact: false }), text);
}

async function waitForVisibleText(locator, text) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      if (await locator.nth(index).isVisible().catch(() => false)) {
        return;
      }
    }
    await delay(100);
  }
  throw new Error(`Expected visible text not found: ${text}`);
}

async function expectNoText(page, text) {
  const count = await page.getByText(text, { exact: true }).count();
  if (count > 0) {
    throw new Error(`Unexpected text found: ${text}`);
  }
}

async function expectNoTextIn(locator, text) {
  const count = await locator.getByText(text, { exact: true }).count();
  if (count > 0) {
    throw new Error(`Unexpected text found in scoped region: ${text}`);
  }
}

async function expectSelectValue(locator, expected) {
  const actual = await locator.inputValue();
  if (actual !== expected) {
    throw new Error(`Expected select value ${expected}, got ${actual}`);
  }
}

async function expectInputValue(locator, expected) {
  const actual = await locator.inputValue();
  if (actual !== expected) {
    throw new Error(`Expected input value ${expected}, got ${actual}`);
  }
}

async function assertLocatorAttribute(locator, attribute, expected, label) {
  const actual = await locator.getAttribute(attribute);
  if (actual !== expected) {
    throw new Error(`${label}: expected ${attribute}=${expected}, got ${actual}`);
  }
}

async function assertNoRuntimeErrorOverlay(page, label) {
  const overlay = page.locator("nextjs-portal, [data-nextjs-dialog-overlay]");
  if ((await overlay.count()) > 0) {
    throw new Error(`${label} rendered a Next.js runtime error overlay.`);
  }
}

async function assertNoHorizontalOverflow(page, label) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - doc.clientWidth;
    const offenders = Array.from(document.body.querySelectorAll("*"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const className = typeof element.className === "string" ? element.className : "";
        return {
          tag: element.tagName.toLowerCase(),
          className,
          text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.width > 0 && (item.right > doc.clientWidth + 2 || item.left < -2))
      .slice(0, 8);
    return {
      overflow,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      offenders,
    };
  });

  if (result.overflow > 2) {
    throw new Error(`${label} has horizontal overflow ${result.overflow}px:\n${JSON.stringify(result.offenders, null, 2)}`);
  }
}

async function assertNoOverlap(page, selectorA, selectorB, label) {
  const result = await page.evaluate(
    ({ selectorA: aSelector, selectorB: bSelector }) => {
      const a = document.querySelector(aSelector)?.getBoundingClientRect();
      const b = document.querySelector(bSelector)?.getBoundingClientRect();
      if (!a || !b) {
        return { missing: true, area: 0 };
      }
      const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return {
        missing: false,
        area: Math.round(width * height),
        first: serializeRect(a),
        second: serializeRect(b),
      };

      function serializeRect(rect) {
        return {
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }
    },
    { selectorA, selectorB },
  );

  if (result.missing) {
    throw new Error(`${label}: expected both ${selectorA} and ${selectorB} to exist.`);
  }
  if (result.area > 1) {
    throw new Error(`${label} overlap detected (${result.area}px):\n${JSON.stringify(result, null, 2)}`);
  }
}

async function assertHtmlImagesLoaded(page, label) {
  const brokenImages = await page.evaluate(() =>
    Array.from(document.images)
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src)
      .filter(Boolean),
  );

  if (brokenImages.length > 0) {
    throw new Error(`${label} has broken <img> assets:\n${brokenImages.join("\n")}`);
  }
}

async function assertCssBackgroundImagesLoaded(page, label) {
  const urls = await page.evaluate(() => {
    const found = new Set();
    const collectUrls = (value) => {
      for (const match of value.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        const raw = match[1];
        if (!raw || raw.startsWith("data:")) {
          continue;
        }
        found.add(new URL(raw, window.location.href).toString());
      }
    };

    const visitRules = (rules) => {
      for (const rule of Array.from(rules)) {
        if ("cssRules" in rule && rule.cssRules) {
          visitRules(rule.cssRules);
          continue;
        }
        if ("style" in rule && rule.style) {
          collectUrls(rule.style.cssText);
        }
      }
    };

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (sheet.cssRules) {
          visitRules(sheet.cssRules);
        }
      } catch {
        // Cross-origin stylesheets are intentionally skipped.
      }
    }

    for (const element of Array.from(document.querySelectorAll("*"))) {
      const style = window.getComputedStyle(element);
      collectUrls(style.backgroundImage);
      collectUrls(style.maskImage);
      collectUrls(style.webkitMaskImage);
    }

    return Array.from(found).filter((url) => url.startsWith(window.location.origin));
  });

  const broken = [];
  for (const url of urls) {
    const response = await page.request.get(url);
    const bytes = await response.body().catch(() => Buffer.alloc(0));
    if (!response.ok() || bytes.byteLength === 0) {
      broken.push(`${response.status()} ${url}`);
    }
  }

  if (broken.length > 0) {
    throw new Error(`${label} has broken CSS image assets:\n${broken.join("\n")}`);
  }
}

async function scrollThroughPage(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 650) {
    await page.evaluate((nextY) => window.scrollTo(0, nextY), y);
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function screenshot(page, fileName) {
  await page.screenshot({ path: join(artifactDir, fileName), fullPage: true });
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

function runCommand(name, command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
      shell: isWindows && command.endsWith(".cmd"),
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
    child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${name} exited with code ${code}`));
    });
  });
}

function packageManagerInvocation() {
  if (process.env.npm_execpath) {
    return { command: process.execPath, args: [process.env.npm_execpath] };
  }
  return { command: isWindows ? "pnpm.cmd" : "pnpm", args: [] };
}

async function waitForJson(url, label) {
  const body = await waitFor(url, label);
  const json = JSON.parse(body);
  if (!json.ok) {
    throw new Error(`${label} health endpoint returned ok=false`);
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
  if (activeBrowser) {
    await activeBrowser.close().catch(() => {});
  }
  await Promise.all(processes.map(stop));
  process.exitCode = 1;
});
