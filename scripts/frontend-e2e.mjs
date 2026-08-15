import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, firefox, webkit } from "playwright";

const isWindows = process.platform === "win32";
const processes = [];
const webStandaloneServer = "apps/web/.next/standalone/apps/web/server.js";
const browserName = process.env.FRONTEND_E2E_BROWSER ?? "chromium";
const browserTypes = { chromium, firefox, webkit };
const browserType = browserTypes[browserName];
const artifactDir = join("output", "playwright", browserName);
const webPort = process.env.FRONTEND_E2E_WEB_PORT ?? "3401";
const gamePort = process.env.FRONTEND_E2E_GAME_PORT ?? "3568";
const baseUrl = `http://127.0.0.1:${webPort}`;
const gameUrl = `http://127.0.0.1:${gamePort}`;
const wsUrl = `ws://127.0.0.1:${gamePort}`;
const testSecret = "frontend-e2e-secret-that-is-long-enough";
const databaseUrl = process.env.FRONTEND_E2E_DATABASE_URL ?? process.env.DATABASE_URL;
const redisUrl = process.env.FRONTEND_E2E_REDIS_URL ?? process.env.REDIS_URL;
const fixturePassword = "Frontend-e2e-password-2026!";

const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};

let failureCount = 0;
let activeBrowser = null;
let authFixture = null;

async function main() {
  if (!browserType) {
    throw new Error(
      `FRONTEND_E2E_BROWSER must be one of ${Object.keys(browserTypes).join(", ")}; received ${browserName}.`,
    );
  }

  assertLocalTestDatabase(databaseUrl);
  assertLocalTestRedis(redisUrl);
  mkdirSync(artifactDir, { recursive: true });
  await buildForE2e();
  authFixture = await seedAuthFixture(databaseUrl);

  const game = start("game-server", process.execPath, ["apps/game-server/dist/index.js"], {
    NODE_ENV: "test",
    GAME_SERVER_PORT: gamePort,
    PORT: gamePort,
    ALLOW_DEV_AUTH: "false",
    GAME_TOKEN_SECRET: testSecret,
    BETTER_AUTH_URL: baseUrl,
    CORS_ORIGIN: baseUrl,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
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
    ALLOW_DEV_AUTH: "false",
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
  });

  await waitForJson(`${baseUrl}/api/health`, "web");

  activeBrowser = await browserType.launch({
    headless: true,
    ...(browserName === "chromium" && process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : {}),
  });

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
  await runCheck("six browser players join one WebSocket game and start it", testSixClientGameStart);

  await activeBrowser.close();
  activeBrowser = null;
  await stop(web);
  await stop(game);
  await cleanupAuthFixture();

  if (failureCount > 0) {
    throw new Error(`Frontend Playwright QA failed with ${failureCount} failing check(s).`);
  }

  console.log(`Frontend Playwright QA passed in ${browserName}.`);
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
    await expectText(page, "Стани");
    await watcher.assertClean();
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
    await watcher.assertClean();
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
    await expectText(page, "Лампата свети, чакаме теб.");
    await assertNoHorizontalOverflow(page, "offline screen");
    await watcher.assertClean();
  } finally {
    await close();
  }
}

async function testLobbyModeFiltering() {
  const { page, watcher, close } = await newPage("lobby-filtering", viewports.desktop);
  try {
    await goto(page, "/werewolf/create", "werewolves lobby");
    await page.waitForURL("**/sign-in?redirect=%2Fwerewolf%2Fcreate");
    await expectText(page, "Стани");

    await goto(page, "/mafia/create", "mafia lobby");
    await page.waitForURL("**/sign-in?redirect=%2Fmafia%2Fcreate");
    await expectText(page, "Стани");
    await assertNoHorizontalOverflow(page, "mafia auth gate");
    await watcher.assertClean();
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
    await watcher.assertClean();
  } finally {
    await close();
  }
}

async function testRolesCodex() {
  const desktop = await newPage("roles-codex", viewports.desktop);
  try {
    const { page, watcher } = desktop;
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
    await watcher.assertClean();
  } finally {
    await desktop.close();
  }

  // WebKit can report an aborted old-document auth request as a page error when
  // viewport changes are followed by reload. A fresh context also matches a
  // real mobile navigation more closely and keeps genuine page errors visible.
  const mobile = await newPage("roles-codex-mobile", viewports.mobile);
  try {
    await goto(mobile.page, "/mafia/roles", "mafia roles codex mobile");
    await expectText(mobile.page, "Роли в Мафия");
    await scrollThroughPage(mobile.page);
    await assertHtmlImagesLoaded(mobile.page, "mafia roles codex mobile");
    await assertCssBackgroundImagesLoaded(mobile.page, "mafia roles codex mobile");
    await assertNoHorizontalOverflow(mobile.page, "roles codex mobile");
    await mobile.watcher.assertClean();
  } finally {
    await mobile.close();
  }
}

async function testAnonymousEntry() {
  const { page, watcher, close } = await newPage("anonymous-entry", viewports.desktop);
  try {
    await goto(page, "/mafia/join/ABCD12", "authenticated join");
    await page.waitForURL("**/sign-in?redirect=%2Fmafia%2Fjoin%2FABCD12");
    await expectText(page, "Влез с кода");
    await expectNoText(page, "без регистрация");
    await assertNoHorizontalOverflow(page, "authenticated join");
    await watcher.assertClean();
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
    await watcher.assertClean();
  } finally {
    await close();
  }
}

async function testUtilityPages() {
  const achievements = await newPage("achievements-screen", viewports.desktop);
  try {
    await goto(achievements.page, "/achievements", "achievements screen");
    await achievements.page.waitForURL("**/sign-in?redirect=%2Fachievements");
    await expectText(achievements.page, "Запази");
    await achievements.watcher.assertClean();
  } finally {
    await achievements.close();
  }

  const leaderboard = await newPage("leaderboard-screen", viewports.desktop);
  try {
    await goto(leaderboard.page, "/leaderboard", "leaderboard screen");
    await expectText(leaderboard.page, "Вечерен Брой на Масата");
    await assertNoHorizontalOverflow(leaderboard.page, "leaderboard screen");
    await leaderboard.watcher.assertClean();
  } finally {
    await leaderboard.close();
  }

  const friends = await newPage("friends-screen", viewports.desktop);
  try {
    await goto(friends.page, "/friends", "friends screen");
    await friends.page.waitForURL("**/sign-in?redirect=%2Ffriends");
    await expectText(friends.page, "Събери");
    await assertNoHorizontalOverflow(friends.page, "utility auth gates");
    await friends.watcher.assertClean();
  } finally {
    await friends.close();
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
    await expectText(page, "Върни се");
    await assertNoHorizontalOverflow(page, "single play auth gate");
    await watcher.assertClean();
  } finally {
    await close();
  }
}

async function testSixClientGameStart() {
  const code = createRoomCode(authFixture.roomCodeAlphabet, authFixture.roomCodeLength);
  const path = `/play/${code}?mode=werewolves_classic&players=6&communication=built_in_chat&narrator=automatic&tempo=fast_online`;
  const contexts = [];
  const watchers = [];

  try {
    for (let index = 0; index < 6; index += 1) {
      const context = await activeBrowser.newContext({ viewport: viewports.desktop });
      await context.addInitScript(() => {
        window.localStorage.setItem("cookie-consent", "1");
        window.localStorage.setItem("welcome-modal-shown", "1");
      });
      const identity = authFixture.users[index];
      await signInBrowserContext(context, identity);
      contexts.push(context);
      const page = await context.newPage();
      watchers.push(watchPage(page, `six-client-${index + 1}`));
      await goto(page, path, `six-client ${index + 1}`);
      await waitForVisibleText(page.getByTestId("ready-toggle"), "Готов");
      try {
        await page.waitForFunction(
          () => {
            const button = document.querySelector('[data-testid="ready-toggle"]');
            return button instanceof HTMLButtonElement && !button.disabled;
          },
          undefined,
          { timeout: 30_000 },
        );
      } catch (error) {
        await screenshot(page, `six-client-${index + 1}-connection-failure.png`).catch(() => {});
        const state = await page.evaluate(() => ({
          url: window.location.href,
          readyButton: document.querySelector('[data-testid="ready-toggle"]')?.outerHTML ?? null,
          connection: document.querySelector("[data-connection-status]")?.textContent?.trim() ?? null,
          pageText: document.body.innerText.replace(/\s+/g, " ").slice(0, 600),
        }));
        await watchers[index].assertClean();
        throw new Error(
          `six-client ${index + 1} did not establish a room connection:\n${JSON.stringify(state, null, 2)}`,
          { cause: error },
        );
      }
      await assertNoHorizontalOverflow(page, `play auth client ${index + 1}`);
    }

    const pages = contexts.map((context) => context.pages()[0]);
    await Promise.all(pages.map((page) => page.getByTestId("ready-toggle").click()));
    await waitForVisibleText(pages[0].getByRole("button", { name: "Започни игра" }), "Започни игра");
    await pages[0].getByRole("button", { name: "Започни игра" }).click();
    await Promise.all(pages.map((page) => page
      .locator("main.play-shell[data-phase='role_reveal'], main.play-shell[data-phase='first_night']")
      .waitFor({ state: "visible", timeout: 15_000 })));
    for (const watcher of watchers) {
      await watcher.assertClean();
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
    ALLOW_DEV_AUTH: "false",
    DATABASE_URL: databaseUrl,
  });
}

async function seedAuthFixture(url) {
  const webRequire = createRequire(resolve("apps/web/package.json"));
  const databaseRequire = createRequire(resolve("packages/database/package.json"));
  const databaseModule = await import(pathToFileURL(webRequire.resolve("@werewolf/database")).href);
  const drizzleModule = await import(pathToFileURL(databaseRequire.resolve("drizzle-orm")).href);
  const cryptoModule = await import(pathToFileURL(webRequire.resolve("better-auth/crypto")).href);
  const sharedModule = await import(pathToFileURL(webRequire.resolve("@werewolf/shared")).href);
  const db = databaseModule.createDatabase(url);
  const runId = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const passwordHash = await cryptoModule.hashPassword(fixturePassword);
  const users = Array.from({ length: 6 }, (_, index) => ({
    id: `frontend-e2e-${runId}-${index + 1}`,
    name: `Играч ${index + 1}`,
    email: `frontend-e2e-${runId}-${index + 1}@example.test`,
  }));

  try {
    await db.transaction(async (transaction) => {
      await transaction.insert(databaseModule.user).values(users.map((identity) => ({
        ...identity,
        emailVerified: true,
        avatarId: "portrait-f01",
      })));
      await transaction.insert(databaseModule.account).values(users.map((identity) => ({
        id: randomUUID(),
        accountId: identity.id,
        providerId: "credential",
        userId: identity.id,
        password: passwordHash,
      })));
    });
  } catch (error) {
    await databaseModule.closeDatabase(url).catch(() => {});
    throw new Error(`Failed to seed Better Auth frontend E2E users in the local test database: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    users,
    roomCodeAlphabet: sharedModule.ROOM_CODE_ALPHABET,
    roomCodeLength: sharedModule.ROOM_CODE_LENGTH,
    async cleanup() {
      try {
        const userIds = users.map((identity) => identity.id);
        await db.transaction(async (transaction) => {
          await transaction
            .delete(databaseModule.games)
            .where(drizzleModule.inArray(databaseModule.games.hostId, userIds));
          await transaction
            .delete(databaseModule.user)
            .where(drizzleModule.inArray(databaseModule.user.id, userIds));
        });
      } finally {
        await databaseModule.closeDatabase(url);
      }
    },
  };
}

async function cleanupAuthFixture() {
  const fixture = authFixture;
  authFixture = null;
  await fixture?.cleanup();
}

async function signInBrowserContext(context, identity) {
  const response = await context.request.post(`${baseUrl}/api/auth/sign-in/email`, {
    data: {
      email: identity.email,
      password: fixturePassword,
      rememberMe: false,
    },
  });
  if (!response.ok()) {
    throw new Error(`Better Auth sign-in failed for ${identity.email}: HTTP ${response.status()} ${await response.text()}`);
  }

  const cookies = await context.cookies(baseUrl);
  if (!cookies.some((cookie) => cookie.name.endsWith("session_token") && cookie.value)) {
    throw new Error(`Better Auth did not issue a session cookie for ${identity.email}.`);
  }

  const sessionResponse = await context.request.get(`${baseUrl}/api/auth/get-session`);
  const session = await sessionResponse.json().catch(() => undefined);
  if (!sessionResponse.ok() || session?.user?.id !== identity.id) {
    throw new Error(`Better Auth session validation failed for ${identity.email}.`);
  }
}

function createRoomCode(alphabet, length) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function assertLocalTestDatabase(value) {
  if (!value) {
    throw new Error("FRONTEND_E2E_DATABASE_URL or DATABASE_URL must point to a local test database.");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Frontend E2E database URL is invalid.");
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!localHosts.has(parsed.hostname) || !/(?:test|e2e)/i.test(databaseName)) {
    throw new Error("Frontend E2E refuses non-local or non-test databases.");
  }
}

function assertLocalTestRedis(value) {
  if (!value) {
    throw new Error("FRONTEND_E2E_REDIS_URL or REDIS_URL must point to a local test Redis instance.");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Frontend E2E Redis URL is invalid.");
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!["redis:", "rediss:"].includes(parsed.protocol) || !localHosts.has(parsed.hostname)) {
    throw new Error("Frontend E2E refuses non-local Redis instances.");
  }
  if (!parsed.password) {
    throw new Error("Frontend E2E requires an authenticated local Redis instance.");
  }
}

async function newPage(label, viewport, identity) {
  const context = await activeBrowser.newContext({ viewport });
  await context.addInitScript(() => {
    window.localStorage.setItem("cookie-consent", "1");
    const reportConsoleError = console.error.bind(console);
    console.error = (...values) => {
      reportConsoleError(...values.map((value) => {
        if (value instanceof Error) {
          return JSON.stringify({
            name: value.name,
            message: value.message,
            stack: value.stack,
            digest: value.digest,
            cause: value.cause instanceof Error
              ? `${value.cause.name}: ${value.cause.message}\n${value.cause.stack ?? ""}`
              : value.cause,
          });
        }
        return value;
      }));
    };
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
  const pendingDetails = [];
  const ignoreConsolePatterns = [/Download the React DevTools/i];

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    const text = message.text();
    if (ignoreConsolePatterns.some((pattern) => pattern.test(text))) {
      return;
    }
    const location = message.location();
    const issueIndex = issues.push(
      `console error: ${text}${location.url ? ` (${location.url})` : ""}`,
    ) - 1;
    pendingDetails.push(
      Promise.all(message.args().map(describeConsoleArgument))
        .then((details) => {
          const detail = details.filter(Boolean).join("\n");
          if (detail && detail !== text) {
            issues[issueIndex] += `\n${detail}`;
          }
        })
        .catch(() => {}),
    );
  });

  page.on("pageerror", (error) => {
    issues.push(`page error: ${error.message}`);
  });

  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "unknown";
    if (/ABORTED|request cancelled/i.test(errorText)) {
      return;
    }
    if (
      request.url().startsWith(baseUrl)
      && ["document", "script", "stylesheet", "image"].includes(request.resourceType())
    ) {
      issues.push(
        `${request.resourceType()} request failed: ${request.url()} (${errorText})`,
      );
    }
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
    async assertClean() {
      await Promise.allSettled(pendingDetails);
      if (issues.length > 0) {
        throw new Error(`${label} produced browser issues:\n${issues.join("\n")}`);
      }
    },
  };
}

async function describeConsoleArgument(argument) {
  return argument.evaluate((value) => {
    if (value instanceof Error) {
      const cause = value.cause instanceof Error
        ? `${value.cause.name}: ${value.cause.message}\n${value.cause.stack ?? ""}`
        : value.cause;
      return JSON.stringify({
        name: value.name,
        message: value.message,
        stack: value.stack,
        digest: value.digest,
        cause,
      });
    }
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  });
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
  const images = page.locator("img");
  const imageCount = await images.count();

  for (let index = 0; index < imageCount; index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((element) => {
      if (element.complete) {
        return;
      }

      return new Promise((resolve) => {
        const timeout = window.setTimeout(resolve, 15_000);
        const finish = () => {
          window.clearTimeout(timeout);
          resolve();
        };

        element.addEventListener("load", finish, { once: true });
        element.addEventListener("error", finish, { once: true });
      });
    });
  }

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
      NODE_ENV: "production",
      ...env,
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
      shell: shouldRunThroughShell(command),
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
    const npmExecPath = process.env.npm_execpath;
    if (isNodeScript(npmExecPath)) {
      return { command: process.execPath, args: [npmExecPath] };
    }
    return { command: npmExecPath, args: [] };
  }
  return { command: isWindows ? "pnpm.cmd" : "pnpm", args: [] };
}

function isNodeScript(filePath) {
  return /\.(?:c|m)?js$/i.test(filePath);
}

function shouldRunThroughShell(command) {
  return isWindows && /\.(?:cmd|bat|ps1)$/i.test(command);
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
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  child.isStopping = true;
  const exited = new Promise((resolve) => child.once("exit", resolve));

  if (isWindows) {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
      killer.on("exit", resolve);
      killer.on("error", resolve);
    });
  } else {
    child.kill("SIGTERM");
  }

  await Promise.race([exited, delay(10_000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([exited, delay(2_000)]);
  }
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
  await cleanupAuthFixture().catch((cleanupError) => console.error("Frontend E2E fixture cleanup failed:", cleanupError));
  process.exitCode = 1;
});
