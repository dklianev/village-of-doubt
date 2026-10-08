import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, firefox, webkit } from "playwright";
import { assertFrontendCssNavigation } from "./frontend-css-navigation.mjs";
import { assertInteractiveTouchTargets } from "./frontend-touch-targets.mjs";
import { installNarrationProbe, enableNarrationProbe, assertNarratedPhase, assertNarrationSilent } from "./frontend-narration-probe.mjs";
import { runPlayPerformance } from "./frontend-play-performance.mjs";

const isWindows = process.platform === "win32";
const processes = [];
const webStandaloneServer = "apps/web/.next/standalone/apps/web/server.js";
const browserName = process.env.FRONTEND_E2E_BROWSER ?? "chromium";
const browserTypes = { chromium, firefox, webkit };
const browserType = browserTypes[browserName];
const artifactDir = process.env.FRONTEND_E2E_ARTIFACT_DIR ?? join("output", "playwright", browserName);
const webPort = process.env.FRONTEND_E2E_WEB_PORT ?? "3401";
const gamePort = process.env.FRONTEND_E2E_GAME_PORT ?? "3568";
const baseUrl = `http://127.0.0.1:${webPort}`;
const gameUrl = `http://127.0.0.1:${gamePort}`;
const wsUrl = `ws://127.0.0.1:${gamePort}`;
const testSecret = "frontend-e2e-secret-that-is-long-enough";
const databaseUrl = process.env.FRONTEND_E2E_DATABASE_URL ?? process.env.DATABASE_URL;
const redisUrl = process.env.FRONTEND_E2E_REDIS_URL ?? process.env.REDIS_URL;
const fixturePassword = "Frontend-e2e-password-2026!";
const focus = process.env.FRONTEND_E2E_FOCUS ?? "all";

const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};

let failureCount = 0;
let activeBrowser = null;
let authFixture = null;

async function main() {
  if (!["all", "play", "performance"].includes(focus)) {
    throw new Error("FRONTEND_E2E_FOCUS must be all, play or performance.");
  }
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

  if (focus === "all") {
    await runCheck("landing desktop layout and theme picker", testLandingDesktop);
    await runCheck("landing mobile layout", testLandingMobile);
    for (const [viewportName, viewport] of Object.entries(viewports)) {
      for (const theme of ["light", "dark"]) {
        await runCheck(`route CSS consistency (${viewportName}, ${theme})`, () => testRouteCssNavigation(viewportName, viewport, theme));
      }
    }
    await runCheck("tutorial and offline shell", testTutorialAndOfflineShell);
    await runCheck("auth gates for lobby routes", testLobbyModeFiltering);
    await runCheck("auth gates for invite lobby routes", testInviteLobbyCopy);
    await runCheck("roles codex assets and responsiveness", testRolesCodex);
    await runCheck("anonymous join redirects to sign-in", testAnonymousEntry);
    await runCheck("authenticated join keeps the room invitation", testAuthenticatedEntry);
    await runCheck("profile changes persist after the last avatar and reload", testAccountProfileSave);
    await runCheck("history screen basics", testHistoryScreen);
    await runCheck("achievements, leaderboard and friends screens", testUtilityPages);
    await runCheck("single-player play auth gate", testSinglePlayScreen);
  }
  if (focus === "performance") {
    await runCheck("crowded mobile tables on the production build", () => runPlayPerformance({
      browser: activeBrowser, baseUrl, wsUrl, identities: authFixture.users, signInBrowserContext,
      secret: testSecret, artifactDir, label: process.env.FRONTEND_E2E_PERF_LABEL ?? "current",
    }));
  } else {
    for (const family of ["werewolves", "mafia"]) {
      await runCheck(`six browser players reconnect, finish, replay and repeat (${family})`, () => testSixClientGameStart(family));
    }
    await runCheck("create token failure can be retried", testCreateTokenRetry);
  }

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

async function testRouteCssNavigation(viewportName, viewport, theme) {
  const label = `route-css-${viewportName}-${theme}`;
  const { page, watcher, close } = await newPage(label, viewport);
  try {
    const results = await assertFrontendCssNavigation(page, baseUrl, theme);
    await assertNoHorizontalOverflow(page, label);
    await watcher.assertClean();
    console.log(`CSS navigation: ${JSON.stringify(results)}`);
    await screenshot(page, `${label}.png`);
  } catch (error) {
    await screenshot(page, `${label}-failure.png`).catch(() => {});
    throw error;
  } finally {
    await close();
  }
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

    await page.locator(".game-choice-mafia").getByRole("link", { name: "Създай стая", exact: true }).click();
    await page.waitForURL("**/sign-in?redirect=%2Fmafia%2Fcreate");
    await expectText(page, "Събери компанията");
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
    await expectText(page, "Няма връзка");
    await page.getByRole("button", { name: "Провери връзката", exact: true }).waitFor({ state: "visible" });
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
    await expectText(page, "Събери компанията");

    await goto(page, "/mafia/create", "mafia lobby");
    await page.waitForURL("**/sign-in?redirect=%2Fmafia%2Fcreate");
    await expectText(page, "Събери компанията");
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
    await expectText(page, "Влез в Сенките");

    await goto(
      page,
      "/lobby/PWWLF1?mode=werewolves_classic&players=6&communication=built_in_chat&narrator=automatic&tempo=fast_online",
      "werewolves invite lobby",
    );
    await page.waitForURL("**/sign-in?redirect=**");
    await expectText(page, "Влез в Сенките");
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
    await goto(page, "/mafia/join/ABCD12", "anonymous join");
    await page.waitForURL("**/sign-in?redirect=%2Fmafia%2Fjoin%2FABCD12");
    await expectText(page, "Вход в играта");
    await expectNoText(page, "без регистрация");
    await assertNoHorizontalOverflow(page, "anonymous join");
    await watcher.assertClean();
  } finally {
    await close();
  }
}

async function testAuthenticatedEntry() {
  const entry = await newPage("authenticated-entry", viewports.desktop);
  try {
    await signInBrowserContext(entry.context, authFixture.users[0]);
    await goto(entry.page, "/mafia/join/ABCD23", "authenticated join");
    await entry.page.waitForURL("**/mafia/join/ABCD23");
    const welcome = entry.page.getByRole("dialog", { name: "Мястото ти е готово.", exact: true });
    await assertLocatorAttribute(welcome.getByRole("link", { name: "Отвори наръчника", exact: true }), "href",
      "/tutorial?welcome=1&game=mafia_free&redirect=%2Fmafia%2Fjoin%2FABCD23", "welcome invitation");
    await welcome.getByRole("button", { name: "Към игрите", exact: true }).click();
    await welcome.waitFor({ state: "hidden" });
    await expectText(entry.page, "Влез на масата");
    for (const [index, character] of [..."ABCD23"].entries()) {
      await expectInputValue(entry.page.getByRole("textbox", { name: `Символ ${index + 1} от 6`, exact: true }), character);
    }
    await expectText(entry.page, "Не открихме стая ABCD23. Провери кода или поискай нов.");
    if (!await entry.page.getByRole("button", { name: "Влез в стаята", exact: true }).isDisabled()) {
      throw new Error("A missing room must not accept an entry.");
    }
    await assertNoHorizontalOverflow(entry.page, "authenticated join");
    await entry.watcher.assertClean();
  } finally {
    await entry.close();
  }
}

async function testAccountProfileSave() {
  const identity = authFixture.users[0];
  const { page, watcher, close } = await newPage("account-profile-save", viewports.mobile);
  const savedName = "Проверен образ";
  let testFailure;
  try {
    await signInBrowserContext(page.context(), identity);
    await page.context().addInitScript(() => localStorage.setItem("welcome-modal-shown", "1"));
    await goto(page, "/account", "account profile");
    await page.getByRole("tab", { name: "Образ и достъп", exact: true }).click();
    if (await page.getByRole("button", { name: "Дай ни бележка", exact: true }).count()) {
      throw new Error("The floating feedback launcher must not cover account editing.");
    }
    const name = page.getByRole("textbox", { name: "Име на масата", exact: true });
    await name.fill(savedName);
    const lastAvatar = page.getByRole("radio").last();
    const avatarId = await lastAvatar.getAttribute("data-avatar-id");
    if (!avatarId) throw new Error("Profile avatar is missing its identifier.");
    await lastAvatar.click();
    const save = page.getByRole("button", { name: "Запази досието", exact: true });
    const avatarBounds = await lastAvatar.boundingBox();
    const saveBounds = await save.boundingBox();
    if (!avatarBounds || !saveBounds || saveBounds.y < avatarBounds.y + avatarBounds.height) {
      throw new Error("Profile save must follow the last avatar.");
    }
    const saved = page.waitForResponse((response) => response.url().endsWith("/api/auth/update-user") && response.request().method() === "POST");
    await save.click();
    if (!(await saved).ok()) throw new Error("Profile update was not accepted by the server.");
    await waitForVisibleText(page.locator("#account-profile-feedback").getByText("Запазено", { exact: true }), "Запазено");
    await page.reload();
    await expectInputValue(name, savedName);
    await page.locator(`button[data-avatar-id="${avatarId}"][aria-checked="true"]`).waitFor({ state: "visible" });
    const response = await page.context().request.get(`${baseUrl}/api/auth/get-session`);
    const session = await response.json();
    if (!response.ok() || session?.user?.name !== savedName || session?.user?.avatarId !== avatarId) {
      throw new Error("Reloaded session did not retain the saved profile.");
    }
    await assertNoHorizontalOverflow(page, "account profile saved");
    await watcher.assertClean();
  } catch (error) {
    testFailure = error;
    await screenshot(page, "account-profile-save-failure.png").catch(() => {});
    throw error;
  } finally {
    // Other integration scenarios use the fixture's original public identity.
    try {
      const restored = await page.context().request.post(`${baseUrl}/api/auth/update-user`, {
        headers: { Origin: baseUrl },
        data: { name: identity.name, avatarId: "portrait-f01" },
      });
      if (!restored.ok()) {
        throw new AggregateError([
          ...(testFailure ? [testFailure] : []),
          new Error(`Could not restore the synthetic profile: HTTP ${restored.status()}.`),
        ], "Profile integration or cleanup failed.");
      }
    } finally {
      await close();
    }
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
    await expectText(achievements.page, "Влез в Сенките");
    await expectText(achievements.page, "Върни се към своите игри, истории и постижения.");
    await achievements.watcher.assertClean();
  } finally {
    await achievements.close();
  }

  const leaderboard = await newPage("leaderboard-screen", viewports.desktop);
  try {
    await goto(leaderboard.page, "/leaderboard", "leaderboard screen");
    await expectText(leaderboard.page, "Вечерен брой");
    await assertNoHorizontalOverflow(leaderboard.page, "leaderboard screen");
    await leaderboard.watcher.assertClean();
  } finally {
    await leaderboard.close();
  }

  const friends = await newPage("friends-screen", viewports.desktop);
  try {
    await goto(friends.page, "/friends", "friends screen");
    await friends.page.waitForURL("**/sign-in?redirect=%2Ffriends");
    await expectText(friends.page, "Влез в Сенките");
    await expectText(friends.page, "Приятелите ти и поканите за следващата игра са тук.");
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

async function createWerewolfRoom(page, label) {
  return createSixPlayerRoom(page, label, "werewolves");
}

async function createSixPlayerRoom(page, label, family) {
  const mafia = family === "mafia";
  await goto(page, mafia ? "/mafia/create" : "/werewolf/create", label);
  await expectText(page, mafia ? "Стая за Мафия" : "Стая за Върколак");
  const players = page.getByRole("slider", { name: "Брой играчи" });
  await players.click();
  await players.press("Home");
  if (mafia) {
    await players.press("ArrowRight");
    await players.press("ArrowRight");
  }
  await expectInputValue(players, "6");
  await page.getByRole("button", { name: mafia ? "Отвори масата" : "Създай селото", exact: true }).click();
  await page.waitForURL(/\/play\/[^/?]+(?:\?|$)/);
  const roomUrl = new URL(page.url());
  if (roomUrl.searchParams.get("players") !== "6" || roomUrl.searchParams.get("mode") !== (mafia ? "mafia_free" : "werewolves_classic")) {
    throw new Error(`${label} did not preserve the six-player ${family} configuration.`);
  }
  return roomUrl;
}

async function testSixClientGameStart(family) {
  const contexts = [];
  const watchers = [];
  let roomUrl;

  try {
    for (let index = 0; index < 6; index += 1) {
      const context = await activeBrowser.newContext({ viewport: index === 5 ? viewports.mobile : viewports.desktop });
      contexts.push(context);
      await mockSyntheticSentry(context);
      await context.addInitScript((theme) => {
        window.localStorage.setItem("cookie-consent", "1");
        window.localStorage.setItem("welcome-modal-shown", "1");
        window.localStorage.setItem("werewolf-theme", theme);
      }, index === 5 ? "light" : "dark");
      if (index === 5) await context.addInitScript(installGameSocketProbe, wsUrl);
      if (index === 0 || index === 5) {
        await context.addInitScript(() => localStorage.setItem("werewolf-cue-mode", "audio_vibration"));
        await context.addInitScript(installNarrationProbe);
      }
      const identity = authFixture.users[index];
      await signInBrowserContext(context, identity);
      const page = await context.newPage();
      watchers.push(watchPage(page, `six-client-${family}-${index + 1}`));
      if (index === 0) {
        roomUrl = await createSixPlayerRoom(page, "six-client host create", family);
      } else {
        const code = roomUrl.pathname.split("/").at(-1);
        await goto(page, `/lobby/${code}${roomUrl.search}`, `six-client ${index + 1} invitation`);
        await expectText(page, "Покана за масата.");
        await page.getByLabel(`Код на стаята ${code}`, { exact: true }).waitFor({ state: "visible" });
        await page.getByRole("link", { name: "Към играта", exact: true }).click();
        await page.waitForURL((url) => url.pathname === roomUrl.pathname);
      }
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
        await screenshot(page, `six-client-${family}-${index + 1}-connection-failure.png`).catch(() => {});
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
    const expectedUserIds = authFixture.users.slice(0, 6).map((user) => user.id);
    await assertSixPlayerRoster(pages, expectedUserIds);
    await enableNarrationProbe(pages[0], family);
    await enableNarrationProbe(pages[5], family);
    await Promise.all(pages.map((page) => page.getByTestId("ready-toggle").click()));
    await startReadyGame(pages[0]);
    await holdFirstGamePhase(pages, "role_reveal");
    await assertNarratedPhase(pages, "role_reveal");
    const privateRoles = await Promise.all(pages.map((page) => readPrivateRole(page, family)));
    if (new Set(privateRoles).size < 2) {
      throw new Error("The six-player fixture did not render distinct private assignments.");
    }

    await advanceFirstGamePhase(pages, "role_reveal", "first_night");
    const investigator = await submitFirstInvestigation(pages, privateRoles, family);
    // No attacks: the investigation must resolve privately without eliminating its target.
    await advanceFirstGamePhase(pages, "first_night", "day_announcement");
    await expectTextIn(pages[investigator].getByRole("status", { name: "Личен резултат", exact: true }),
      family === "mafia" ? "е от злата страна." : "Видението потвърди нощна заплаха.");
    for (const [index, page] of pages.entries()) {
      if (index !== investigator && await page.getByRole("status", { name: "Личен резултат", exact: true }).count()) {
        throw new Error("A private investigation appeared for another participant.");
      }
    }
    await advanceFirstGamePhase(pages, "day_announcement", "day_discussion");
    await advanceFirstGamePhase(pages, "day_discussion", "voting");

    const mobilePage = pages[5];
    const target = authFixture.users[0];
    await mobilePage.locator(`button[data-seat-user-id="${target.id}"]`).click();
    await mobilePage.getByRole("button", { name: `Потвърди гласа за ${target.name}`, exact: true }).click();
    await expectTextIn(mobilePage.locator(".play-action-receipt"), `Приет глас: ${target.name}`);
    const nextTarget = authFixture.users[1];
    await mobilePage.locator(`button[data-seat-user-id="${nextTarget.id}"]`).click();
    await mobilePage.locator(`button[data-seat-user-id="${nextTarget.id}"][data-selected="true"]`).waitFor({ state: "visible" });
    await expectTextIn(mobilePage.locator(".play-action-receipt"), `Приет глас: ${target.name}`);
    const voterSelector = `[data-seat-user-id="${expectedUserIds[5]}"][data-voted="true"]`;
    await Promise.all(pages.map((page) => page.locator(voterSelector).waitFor({ state: "visible" })));
    const narrationStarts = await mobilePage.evaluate(() => window.__frontendNarration.read().events.length);
    await reconnectFirstGameGuest(pages, expectedUserIds, privateRoles[5], family, `Приет глас: ${target.name}`);
    await assertNarrationSilent(mobilePage, narrationStarts);
    await mobilePage.reload();
    await mobilePage.locator('main.play-shell[data-phase="voting"]').waitFor({ state: "visible" });
    await assertSixPlayerRoster(pages, expectedUserIds);
    if (await readPrivateRole(mobilePage, family) !== privateRoles[5]) throw new Error("Reload changed the viewer's private role.");
    await mobilePage.locator(voterSelector).waitFor({ state: "visible" });
    await assertSingleVoteTally(mobilePage, target.name);
    await enableNarrationProbe(mobilePage, family);
    await assertNarrationSilent(mobilePage, 0);
    // ACK receipts are transient. Reconfirm through the UI without double-counting the retained vote.
    await mobilePage.locator(`button[data-seat-user-id="${target.id}"]`).click();
    await mobilePage.getByRole("button", { name: `Потвърди гласа за ${target.name}`, exact: true }).click();
    await expectTextIn(mobilePage.locator(".play-action-receipt"), `Приет глас: ${target.name}`);
    await assertSingleVoteTally(mobilePage, target.name);
    await assertNoHorizontalOverflow(mobilePage, `six-client ${family} mobile voting after reconnect`);
    await finishFirstGameAndReplay(pages, privateRoles, family, roomUrl);
    for (const watcher of watchers) {
      await watcher.assertClean();
    }
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
}

async function assertSingleVoteTally(page, targetName) {
  await page.waitForFunction((name) => {
    const rows = [...document.querySelectorAll(".vote-tally-row")];
    return rows.length === 1 && rows[0].querySelector("span")?.textContent === name
      && rows[0].querySelector("strong")?.textContent === "1";
  }, targetName, { timeout: 10000 });
}

async function submitFirstInvestigation(pages, privateRoles, family) {
  const role = family === "mafia" ? "Комисар" : "Гадателка";
  const enemy = family === "mafia" ? "Мафиот" : "Върколак";
  const actor = privateRoles.indexOf(`Тайна роля: ${role}`);
  const target = privateRoles.indexOf(`Тайна роля: ${enemy}`);
  if (actor < 0 || target < 0) throw new Error("The starter investigation fixture no longer matches its roles.");
  const page = pages[actor];
  await page.locator(`button[data-seat-user-id="${authFixture.users[target].id}"]`).click();
  await page.getByRole("button", { name: family === "mafia" ? "Провери дали е от Мафията" : "Провери заплахата", exact: true }).click();
  await expectText(page, "Нощното действие е прието.");
  return actor;
}

async function finishFirstGameAndReplay(pages, privateRoles, family, roomUrl) {
  // Read only each synthetic player's own card; the server still assigns roles and decides victory.
  const enemyRole = family === "mafia" ? "Мафиот" : "Върколак";
  const targets = privateRoles.flatMap((role, index) => role === `Тайна роля: ${enemyRole}` ? [index] : []);
  if (targets.length !== (family === "mafia" ? 1 : 2)) {
    throw new Error("The six-player starter composition changed; review the postgame scenario.");
  }
  const eliminated = new Set();
  for (const targetIndex of targets) {
    const target = authFixture.users[targetIndex];
    const majority = Math.floor((pages.length - eliminated.size) / 2) + 1;
    const voters = pages.map((_, index) => index)
      .filter((index) => index !== targetIndex && !eliminated.has(index)).slice(0, majority);
    for (const index of voters) {
      const page = pages[index];
      await page.locator(`button[data-seat-user-id="${target.id}"]`).click();
      await page.getByRole("button", { name: `Потвърди гласа за ${target.name}`, exact: true }).click();
      await expectTextIn(page.locator(".play-action-receipt"), `Приет глас: ${target.name}`);
    }
    await advanceFirstGamePhase(pages, "voting", "resolution");
    await Promise.all(pages.map((page) => page.locator(
      `[data-seat-user-id="${target.id}"][data-alive="false"]`,
    ).waitFor({ state: "visible" })));
    eliminated.add(targetIndex);
    if (eliminated.size < targets.length) {
      await advanceFirstGamePhase(pages, "resolution", "night");
      await advanceFirstGamePhase(pages, "night", "day_announcement");
      await advanceFirstGamePhase(pages, "day_announcement", "day_discussion");
      await advanceFirstGamePhase(pages, "day_discussion", "voting");
    }
  }
  await pages[0].getByRole("button", { name: "Следваща фаза", exact: true }).click();
  await assertNarratedPhase(pages, "game_over");
  for (const page of pages) {
    await page.locator(`[data-endgame="${family === "mafia" ? "town" : "village"}"]`).waitFor({ state: "visible" });
    for (const [index, identity] of authFixture.users.entries()) {
      const row = page.locator("[data-endgame] li").filter({ has: page.getByText(identity.name, { exact: true }) });
      await expectTextIn(row, privateRoles[index].replace("Тайна роля: ", ""));
      if ((await row.getAttribute("data-winner") === "true") === eliminated.has(index)) {
        throw new Error("Final player winners disagree with the completed starter scenario.");
      }
    }
    await assertNoHorizontalOverflow(page, `${family} recorded finale`);
    // game_over precedes persistence; never treat an archive fallback as a successful recording.
    await page.getByRole("link", { name: "Виж записа", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    const unlocked = page.getByRole("dialog", { name: "Отключени легенди", exact: true });
    if (await unlocked.isVisible()) {
      await unlocked.getByRole("button", { name: "Продължи вечерта", exact: true }).click();
      await unlocked.waitFor({ state: "hidden" });
    }
  }
  await prepareFinaleScreenshot(pages[0]);
  await prepareFinaleScreenshot(pages[5]);
  await screenshot(pages[0], `six-client-${family}-finale-desktop.png`);
  await screenshot(pages[5], `six-client-${family}-finale-mobile.png`);

  const replayPage = pages[5];
  await replayPage.getByRole("link", { name: "Виж записа", exact: true }).click();
  await replayPage.waitForURL(/\/history\/[^/?]+\/replay$/);
  await replayPage.locator(`[data-replay-shell][data-family="${family}"]`).waitFor({ state: "visible" });
  await replayPage.getByRole("heading", { level: 1, name: family === "mafia" ? "Градът оцеля." : "Селото оцеля.", exact: true }).waitFor();
  await expectTextIn(replayPage.locator("[data-replay-summary]"), "Пълен запис");
  const roster = replayPage.getByRole("complementary", { name: "Участници в записа", exact: true });
  await roster.locator("summary").click();
  for (const identity of authFixture.users) await roster.getByText(identity.name, { exact: true }).waitFor();
  await replayPage.getByRole("link", { name: "Към развръзката", exact: true }).click();
  await replayPage.getByRole("heading", { level: 4, name: family === "mafia" ? "Гражданите печелят" : "Селото печели", exact: true }).waitFor();
  await assertNoHorizontalOverflow(replayPage, `${family} recorded replay mobile`);
  await screenshot(replayPage, `six-client-${family}-replay-mobile.png`);
  await replayPage.goBack();
  // The archive anchor may add an entry; traverse it before returning to the game.
  if (new URL(replayPage.url()).pathname.includes("/replay")) await replayPage.goBack();
  await replayPage.waitForURL((url) => url.pathname === roomUrl.pathname);
  await replayPage.locator("main[data-phase='game_over']").waitFor({ state: "visible" });
  await replayPage.locator(`[data-endgame="${family === "mafia" ? "town" : "village"}"]`).waitFor({ state: "visible" });
  await replayPage.getByRole("link", { name: "Виж записа", exact: true }).waitFor({ state: "visible" });
  if (await replayPage.getByText("Получен е личен резултат от нощното действие.", { exact: true }).count()) {
    throw new Error("Returning from replay announced a retained investigation as a new action.");
  }
  await prepareFinaleScreenshot(replayPage);
  await screenshot(replayPage, `six-client-${family}-back-to-game.png`);

  const host = pages[0];
  const repeat = host.getByRole("link", { name: "Още една игра", exact: true });
  const repeatUrl = new URL(await repeat.getAttribute("href"), baseUrl);
  assertRepeatedRoomOptions(roomUrl, repeatUrl, authFixture.defaultGameConfig(family === "mafia" ? "mafia_free" : "werewolves_classic", 6));
  await repeat.click();
  await host.waitForURL(repeatUrl.href);
  await expectInputValue(host.getByRole("slider", { name: "Брой играчи" }), "6");
  await host.getByRole("button", { name: family === "mafia" ? "Отвори масата" : "Създай селото", exact: true }).click();
  await host.waitForURL(/\/play\/[^/?]+(?:\?|$)/);
  if (new URL(host.url()).pathname === roomUrl.pathname) throw new Error("Repeat game reused the ended room.");
  await host.locator("main.play-shell[data-phase='lobby']").waitFor({ state: "visible" });
  await host.getByTestId("ready-toggle").waitFor({ state: "visible" });
  await assertSixPlayerRoster([host], [authFixture.users[0].id]);
  if (await host.locator("main.play-shell[data-phase='lobby']:visible").locator("[data-endgame], [data-private-dossier]").count()) {
    throw new Error("New room retained the previous game's result or private role.");
  }
}

async function prepareFinaleScreenshot(page) {
  await page.locator("[data-endgame]").evaluate(async (element) => {
    const images = [...element.querySelectorAll("img")];
    if (!images.length) throw new Error("The finale has no image assets.");
    await Promise.all(images.map((image) => image.decode()));
    if (images.some((image) => image.naturalWidth === 0)) throw new Error("The finale contains a broken image.");
  });
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
}

function assertRepeatedRoomOptions(original, repeated, defaults) {
  if (repeated.origin !== original.origin || repeated.pathname !== `/${defaults.mode === "mafia_free" ? "mafia" : "werewolf"}/create`) {
    throw new Error("Repeat game left the original game family or origin.");
  }
  for (const [query, option] of [
    ["mode", "mode"], ["players", "playerCount"], ["communication", "communicationMode"],
    ["narrator", "narratorMode"], ["tempo", "tempoProfile"], ["reveal", "revealRolesOnDeath"],
    ["visibility", "roomVisibility"], ["preset", "rolePreset"],
  ]) {
    const fallback = typeof defaults[option] === "boolean" ? (defaults[option] ? "1" : "0") : String(defaults[option]);
    if ((repeated.searchParams.get(query) ?? fallback) !== (original.searchParams.get(query) ?? fallback)) {
      throw new Error(`Repeat game changed the original ${query} option.`);
    }
  }
  if (["code", "spectator", "winnerTeam", "finalRoles"].some((key) => repeated.searchParams.has(key))) {
    throw new Error("Repeat game carried terminal or room identity data into creation.");
  }
}

async function assertSixPlayerRoster(pages, expectedUserIds) {
  await Promise.all(pages.map((page) => page.waitForFunction(
    (ids) => {
      const seats = Array.from(document.querySelectorAll("[data-seat-user-id]"));
      return seats.length === ids.length && ids.every((id) => seats.filter((seat) => seat.dataset.seatUserId === id).length === 1);
    },
    expectedUserIds,
    { timeout: 30_000 },
  )));
}

async function startReadyGame(host) {
  await host.waitForFunction(() => {
    const phase = document.querySelector("main.play-shell")?.getAttribute("data-phase");
    const seats = Array.from(document.querySelectorAll("[data-seat-user-id]"));
    return phase === "role_reveal" || (phase === "lobby" && seats.length === 6 && seats.every((seat) => seat.dataset.ready === "true"));
  }, undefined, { timeout: 15_000 });
  if (await host.locator("main.play-shell").getAttribute("data-phase") === "lobby") {
    try {
      await host.getByRole("button", { name: "Започни игра", exact: true }).click({ timeout: 5_000 });
    } catch (error) {
      // Autostart can remove the button between the phase read and the click.
      if (await host.locator("main.play-shell").getAttribute("data-phase") !== "role_reveal") throw error;
    }
  }
  await host.locator("main.play-shell[data-phase='role_reveal']").waitFor({ state: "visible", timeout: 15_000 });
}

async function putDealtCardAway(page) {
  // The deal is a modal moment on every phone: turn the card, then put it away to reach the table.
  await page.getByRole("dialog", { name: "Твоята тайна карта", exact: true })
    .getByRole("button", { name: "Обърни картата", exact: true })
    .click({ timeout: 15_000 });
  const done = page.getByRole("button", { name: "Запомних", exact: true });
  await done.click({ timeout: 15_000 });
  await done.waitFor({ state: "detached", timeout: 15_000 });
}

async function holdFirstGamePhase(pages, phase) {
  const selector = `main.play-shell[data-phase="${phase}"]`;
  await pages[0].locator(selector).waitFor({ state: "visible", timeout: 15_000 });
  if (phase === "role_reveal") await Promise.all(pages.map(putDealtCardAway));
  // Use the real host control to keep assertions independent of short phase timers.
  await pages[0].getByRole("button", { name: "+180 сек.", exact: true }).click();
  await Promise.all(pages.map((page) => page.locator(selector).waitFor({ state: "visible", timeout: 15_000 })));
}

async function advanceFirstGamePhase(pages, from, to) {
  const current = await pages[0].locator("main.play-shell").getAttribute("data-phase");
  if (current === from) {
    await pages[0].getByRole("button", { name: "Следваща фаза", exact: true }).click();
  } else if (current !== to) {
    throw new Error(`Expected first-round phase ${from} or ${to}, received ${current}.`);
  }
  await holdFirstGamePhase(pages, to);
  await assertNarratedPhase(pages, to);
}

async function readPrivateRole(page, family) {
  const personal = page.getByRole("region", { name: "Твоята роля", exact: true });
  await personal.waitFor({ state: "visible", timeout: 15_000 });
  const reveal = personal.getByRole("button", { name: "Виж ролята си", exact: true });
  if (await reveal.isVisible()) await reveal.click();
  const card = personal.locator("[data-private-dossier]");
  await card.waitFor({ state: "visible", timeout: 15_000 });
  const label = await card.getAttribute("aria-label");
  if (
    await page.locator("[data-private-dossier]").count() !== 1
    || await card.getAttribute("data-role-family") !== family
    || !label?.startsWith("Тайна роля: ")
    || label.trim() === "Тайна роля:"
  ) {
    throw new Error("Expected exactly one viewer-private role card from the selected family.");
  }
  return label;
}

function installGameSocketProbe(gameEndpoint) {
  const NativeWebSocket = window.WebSocket;
  const gameOrigin = new URL(gameEndpoint).origin;
  const sockets = new Map();
  let nextId = 0;
  const openEntries = () => [...sockets].filter(([, socket]) => socket.readyState === NativeWebSocket.OPEN);
  window.__frontendE2eGameSockets = {
    openIds: () => openEntries().map(([id]) => id),
    closeOpen() {
      const entries = openEntries();
      if (entries.length !== 1) throw new Error("Expected one open fixture game WebSocket.");
      const [id, socket] = entries[0];
      // Exercise the app's new-Room reconnect path; 4000 is a consented leave.
      socket.close(3001, "test interruption");
      return id;
    },
  };
  window.WebSocket = new Proxy(NativeWebSocket, {
    construct(Target, args, NewTarget) {
      const socket = Reflect.construct(Target, args, NewTarget);
      if (new URL(socket.url).origin === gameOrigin) {
        const id = ++nextId;
        sockets.set(id, socket);
        socket.addEventListener("close", () => sockets.delete(id), { once: true });
      }
      return socket;
    },
  });
}

async function reconnectFirstGameGuest(pages, expectedUserIds, privateRole, family, acceptedReceipt) {
  const guest = pages[5];
  const seat = `[data-seat-user-id="${expectedUserIds[5]}"]`;
  await expectTextIn(guest.locator(".play-action-receipt"), acceptedReceipt);
  const closedSocketId = await guest.evaluate(() => window.__frontendE2eGameSockets.closeOpen());
  await pages[0].locator(`${seat}[data-connected="false"]`).waitFor({ state: "visible", timeout: 30_000 });
  await guest.waitForFunction((previousId) => {
    const ids = window.__frontendE2eGameSockets.openIds();
    return ids.length === 1 && ids[0] > previousId;
  }, closedSocketId, { timeout: 30_000 });
  await pages[0].locator(`${seat}[data-connected="true"]`).waitFor({ state: "visible", timeout: 30_000 });
  await guest.locator(".connection-banner").waitFor({ state: "hidden", timeout: 30_000 });
  await assertSixPlayerRoster(pages, expectedUserIds);
  if (await readPrivateRole(guest, family) !== privateRole) {
    throw new Error("The returning guest's private assignment changed.");
  }
  await expectTextIn(guest.locator(".play-action-receipt"), acceptedReceipt);
  await Promise.all(pages.map(async (page) => {
    await page.locator("main.play-shell[data-phase='voting']").waitFor({ state: "visible" });
    await page.locator(`${seat}[data-voted="true"]`).waitFor({ state: "visible" });
  }));
}

async function testCreateTokenRetry() {
  const context = await activeBrowser.newContext({ viewport: viewports.desktop });
  const tokenUrl = `${baseUrl}/api/game-token`;
  const failureMessage = "Временно неуспешно издаване на игрови ключ.";
  let page;
  let failedRequests = 0;
  const failToken = async (route) => {
    failedRequests += 1;
    await route.fulfill({ status: 503, json: { error: failureMessage } });
  };

  try {
    await mockSyntheticSentry(context);
    await context.addInitScript(() => {
      window.localStorage.setItem("cookie-consent", "1");
      window.localStorage.setItem("welcome-modal-shown", "1");
    });
    await signInBrowserContext(context, authFixture.users[0]);
    page = await context.newPage();
    const watcher = watchPage(page, "create-token-retry", { expectedHttpError: { url: tokenUrl, status: 503 } });
    await page.route(tokenUrl, failToken, { times: 1 });
    const roomUrl = await createWerewolfRoom(page, "create-token-retry");
    const dialog = page.getByRole("dialog", { name: "Връзката със стаята прекъсна" });
    await dialog.waitFor({ state: "visible", timeout: 30_000 });
    await expectTextIn(dialog, failureMessage);
    if (failedRequests !== 1) {
      throw new Error("The create retry fixture did not inject exactly one token failure.");
    }

    await page.unroute(tokenUrl, failToken);
    await Promise.all([
      page.waitForResponse((response) => response.url() === tokenUrl && response.request().method() === "POST" && response.ok()),
      dialog.getByRole("button", { name: "Свържи отново", exact: true }).click(),
    ]);
    await dialog.waitFor({ state: "hidden" });
    await page.locator("main.play-shell[data-phase='lobby']").waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const ready = document.querySelector('[data-testid="ready-toggle"]');
      return ready instanceof HTMLButtonElement && !ready.disabled;
    }, undefined, { timeout: 30_000 });
    if (page.url() !== roomUrl.href) {
      throw new Error("Retry navigated away from the created room.");
    }
    await watcher.assertClean();
  } finally {
    try {
      if (page) await page.unroute(tokenUrl, failToken);
    } finally {
      await context.close();
    }
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
  const users = Array.from({ length: focus === "performance" ? 30 : 6 }, (_, index) => ({
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
        issuer: "local:credential",
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
    defaultGameConfig: sharedModule.createDefaultGameConfig,
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

async function mockSyntheticSentry(context) {
  // Only the CI fixture DSN is mocked; application errors still reach watchPage.
  if (process.env.NEXT_PUBLIC_SENTRY_DSN !== "https://public@example.invalid/2") return;
  await context.route(
    (url) => url.origin === "https://example.invalid" && url.pathname === "/api/2/envelope/"
      && url.searchParams.get("sentry_key") === "public" && url.searchParams.get("sentry_version") === "7",
    async (route) => {
      if (!["POST", "OPTIONS"].includes(route.request().method())) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        json: {},
        headers: {
          "access-control-allow-origin": baseUrl,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type, sentry-trace, baggage",
        },
      });
    },
  );
}

async function newPage(label, viewport, identity) {
  const context = await activeBrowser.newContext({ viewport });
  await mockSyntheticSentry(context);
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
    context,
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

function watchPage(page, label, { expectedHttpError } = {}) {
  const issues = [];
  const pendingDetails = [];
  const ignoreConsolePatterns = [/Download the React DevTools/i];
  let expectedHttpErrorRemaining = Boolean(expectedHttpError);

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }
    const text = message.text();
    if (ignoreConsolePatterns.some((pattern) => pattern.test(text))) {
      return;
    }
    const location = message.location();
    // A deliberately mocked HTTP failure can also emit one browser console error.
    if (
      expectedHttpErrorRemaining && location.url === expectedHttpError.url &&
      text.startsWith("Failed to load resource:") && new RegExp(`\\b${expectedHttpError.status}\\b`).test(text)
    ) {
      expectedHttpErrorRemaining = false;
      return;
    }
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
      && ["document", "script", "stylesheet", "image", "font"].includes(request.resourceType())
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
      ["document", "script", "stylesheet", "image", "font"].includes(resourceType)
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

async function assertNoInteractiveOverlap(page, label) {
  const overlaps = await page.evaluate(() => {
    const selector = 'button, a, input, select, textarea, summary, [role="button"]';
    const elements = Array.from(document.querySelectorAll(selector)).filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const isolated = element.closest('[inert], [aria-hidden="true"]');
      return !isolated && style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
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
    const visitedSheets = new Set();
    const collectUrls = (value, base) => {
      for (const match of value.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi)) {
        const raw = (match[1] ?? match[2] ?? match[3]).trim();
        if (!raw || raw.startsWith("#")) {
          continue;
        }
        const url = new URL(raw, base);
        if (["http:", "https:"].includes(url.protocol) && url.origin === window.location.origin) {
          found.add(url.href);
        }
      }
    };

    const visitRules = (rules, base) => {
      for (const rule of Array.from(rules)) {
        if ("styleSheet" in rule && rule.styleSheet) {
          visitSheet(rule.styleSheet, base);
        }
        if ("style" in rule && rule.style) {
          for (const property of Array.from(rule.style)) {
            collectUrls(rule.style.getPropertyValue(property), base);
          }
        }
        if ("cssRules" in rule && rule.cssRules) {
          visitRules(rule.cssRules, base);
        }
      }
    };

    const visitSheet = (sheet, base) => {
      if (visitedSheets.has(sheet)) return;
      visitedSheets.add(sheet);
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (error) {
        // CSSOM access is forbidden for cross-origin stylesheets without CORS.
        if (error.name === "SecurityError") return;
        throw error;
      }
      if (rules) visitRules(rules, sheet.href ? new URL(sheet.href, base).href : base);
    };

    for (const sheet of Array.from(document.styleSheets)) {
      visitSheet(sheet, document.baseURI);
    }

    for (const element of Array.from(document.querySelectorAll("*"))) {
      const style = window.getComputedStyle(element);
      collectUrls(style.backgroundImage, document.baseURI);
      collectUrls(style.maskImage, document.baseURI);
      collectUrls(style.webkitMaskImage, document.baseURI);
    }

    return Array.from(found);
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
    throw new Error(`${label} has broken CSS image/font assets:\n${broken.join("\n")}`);
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
  await page.screenshot({ path: join(artifactDir, fileName), fullPage: true, animations: "disabled" });
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
