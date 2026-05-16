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
  await runCheck("auth gates for lobby routes", testLobbyModeFiltering);
  await runCheck("auth gates for invite lobby routes", testInviteLobbyCopy);
  await runCheck("roles codex assets and responsiveness", testRolesCodex);
  await runCheck("authenticated entry redirect basics", testAnonymousEntry);
  await runCheck("history screen basics", testHistoryScreen);
  await runCheck("achievements, leaderboard and friends screens", testUtilityPages);
  await runCheck("single-player play auth gate", testSinglePlayScreen);
  await runCheck("multi-client play auth gates", testSixClientGameStart);

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

    await page.locator(".game-choice-mafia").getByRole("link", { name: "Влез и играй" }).click();
    await page.waitForURL("**/sign-in?redirect=%2Fmafia%2Fcreate");
    await expectText(page, "Покажи се на масата");
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
    await expectText(page, "Масата се събира.");
    await expectText(page, "Сцена 1 от 6");
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
    await page.waitForURL("**/sign-in?redirect=%2Fwerewolf%2Fcreate");
    await expectText(page, "Покажи се на масата");

    await goto(page, "/mafia/create", "mafia lobby");
    await page.waitForURL("**/sign-in?redirect=%2Fmafia%2Fcreate");
    await expectText(page, "Покажи се на масата");
    await assertNoHorizontalOverflow(page, "mafia auth gate");
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
    await page.waitForURL("**/sign-in?redirect=**");
    await expectText(page, "Покажи се на масата");

    await goto(
      page,
      "/lobby/PWWLF1?mode=werewolves_classic&players=6&communication=built_in_chat&narrator=automatic&tempo=fast_online",
      "werewolves invite lobby",
    );
    await page.waitForURL("**/sign-in?redirect=**");
    await expectText(page, "Покажи се на масата");
    await assertCssBackgroundImagesLoaded(page, "invite auth gates");
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
    await goto(page, "/mafia/join/ABCD12", "authenticated join");
    await page.waitForURL("**/sign-in?redirect=%2Fmafia%2Fjoin%2FABCD12");
    await expectText(page, "Покажи се на масата");
    await expectNoText(page, "без регистрация");
    await assertNoHorizontalOverflow(page, "authenticated join");
    watcher.assertClean();
  } finally {
    await close();
  }
}

async function testHistoryScreen() {
  const { page, watcher, close } = await newPage("history-screen", viewports.desktop);
  try {
    await goto(page, "/history", "history screen");
    await expectText(page, "Архив на масата");
    await assertNoHorizontalOverflow(page, "history screen");
    await assertCssBackgroundImagesLoaded(page, "history screen");
    watcher.assertClean();
  } finally {
    await close();
  }
}

async function testUtilityPages() {
  const { page, watcher, close } = await newPage("utility-pages", viewports.desktop);
  try {
    await goto(page, "/achievements", "achievements screen");
    await page.waitForURL("**/sign-in?redirect=%2Fachievements");
    await expectText(page, "Покажи се на масата");

    await goto(page, "/leaderboard", "leaderboard screen");
    await expectText(page, "Вечерен Брой на Масата");
    await assertNoHorizontalOverflow(page, "leaderboard screen");

    await goto(page, "/friends", "friends screen");
    await page.waitForURL("**/sign-in?redirect=%2Ffriends");
    await expectText(page, "Покажи се на масата");
    await assertNoHorizontalOverflow(page, "utility auth gates");
    watcher.assertClean();
  } finally {
    await close();
  }
}

async function testSinglePlayScreen() {
  const { page, watcher, close } = await newPage("single-play", viewports.desktop);
  try {
    await goto(
      page,
      "/play/PWSOLO?mode=werewolves_classic&players=6&communication=no_chat&narrator=automatic&tempo=live",
      "single play screen",
    );
    await page.waitForURL("**/sign-in?redirect=**");
    await expectText(page, "Покажи се на масата");
    await assertNoHorizontalOverflow(page, "single play auth gate");
    watcher.assertClean();
  } finally {
    await close();
  }
}

async function testSixClientGameStart() {
  const code = `PW${String(Date.now()).slice(-4)}`;
  const path = `/play/${code}?mode=werewolves_classic&players=6&communication=built_in_chat&narrator=automatic&tempo=fast_online`;
  const contexts = [];
  const watchers = [];

  try {
    for (let index = 0; index < 3; index += 1) {
      const context = await activeBrowser.newContext({ viewport: viewports.desktop });
      await context.addInitScript(() => {
        window.localStorage.setItem("cookie-consent", "1");
      });
      contexts.push(context);
      const page = await context.newPage();
      watchers.push(watchPage(page, `six-client-${index + 1}`));
      await goto(page, path, `six-client ${index + 1}`);
      await page.waitForURL("**/sign-in?redirect=**");
      await expectText(page, "Покажи се на масата");
      await assertNoHorizontalOverflow(page, `play auth client ${index + 1}`);
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
  await context.addInitScript(() => {
    window.localStorage.setItem("cookie-consent", "1");
  });
  if (identity) {
    await context.addInitScript(
      ({ userId, displayName }) => {
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
  await assertInteractiveTouchTargets(page, label);
  await assertNoInteractiveOverlap(page, label);
}

async function waitForSettled(page) {
  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function expectText(page, text) {
  await waitForVisibleText(page.getByText(text, { exact: false }).or(page.locator(`[aria-label="${cssString(text)}"]`)), text);
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

async function assertInteractiveTouchTargets(page, label) {
  const failures = await page.evaluate(() => {
    const selector = 'button, a, input, select, textarea, summary, [role="button"]';
    return Array.from(document.querySelectorAll(selector))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.textContent ?? element.getAttribute("aria-label") ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((item) => item.width < 28 || item.height < 28)
      .slice(0, 12);
  });

  if (failures.length > 0) {
    throw new Error(`${label} has cramped interactive targets:\n${JSON.stringify(failures, null, 2)}`);
  }
}

async function assertNoInteractiveOverlap(page, label) {
  const overlaps = await page.evaluate(() => {
    const selector = 'button, a, input, select, textarea, summary, [role="button"]';
    const elements = Array.from(document.querySelectorAll(selector)).filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    });
    const issues = [];

    for (let leftIndex = 0; leftIndex < elements.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < elements.length; rightIndex += 1) {
        const left = elements[leftIndex];
        const right = elements[rightIndex];
        if (!left || !right || left.contains(right) || right.contains(left)) {
          continue;
        }
        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        const width = Math.max(0, Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left));
        const height = Math.max(0, Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top));
        const area = width * height;
        if (area > 16) {
          issues.push({
            area: Math.round(area),
            first: describe(left, leftRect),
            second: describe(right, rightRect),
          });
        }
      }
    }

    return issues.slice(0, 8);

    function describe(element, rect) {
      return {
        tag: element.tagName.toLowerCase(),
        text: (element.textContent ?? element.getAttribute("aria-label") ?? "").trim().replace(/\s+/g, " ").slice(0, 64),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }
  });

  if (overlaps.length > 0) {
    throw new Error(`${label} has overlapping interactive elements:\n${JSON.stringify(overlaps, null, 2)}`);
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

function cssString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
