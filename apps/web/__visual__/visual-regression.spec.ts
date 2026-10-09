import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "playwright/test";
import { expectDecodedImage } from "./image-readiness";

const PLAY_VISUAL_ROUTES = [
  { name: "play-werewolves-lobby", path: "/play/VISUAL?visualGame=1&phase=lobby&family=werewolves&viewer=host" },
  { name: "play-werewolves-role-reveal", path: "/play/VISUAL?visualGame=1&phase=role_reveal&family=werewolves&role=seer" },
  { name: "play-werewolves-night", path: "/play/VISUAL?visualGame=1&phase=night&family=werewolves&role=seer" },
  { name: "play-werewolves-day", path: "/play/VISUAL?visualGame=1&phase=day_discussion&family=werewolves&dead=1" },
  { name: "play-werewolves-voting", path: "/play/VISUAL?visualGame=1&phase=voting&family=werewolves&voteTally=full" },
  { name: "play-werewolves-resolution", path: "/play/VISUAL?visualGame=1&phase=resolution&family=werewolves&dead=2" },
  { name: "play-werewolves-game-over", path: "/play/VISUAL?visualGame=1&phase=game_over&family=werewolves&winner=werewolves&dead=5" },
  { name: "play-mafia-lobby", path: "/play/VISUAL?visualGame=1&phase=lobby&family=mafia&viewer=host" },
  { name: "play-mafia-role-reveal", path: "/play/VISUAL?visualGame=1&phase=role_reveal&family=mafia&role=commissioner" },
  { name: "play-mafia-night", path: "/play/VISUAL?visualGame=1&phase=night&family=mafia&role=commissioner" },
  { name: "play-mafia-day", path: "/play/VISUAL?visualGame=1&phase=day_discussion&family=mafia&dead=1" },
  { name: "play-mafia-voting", path: "/play/VISUAL?visualGame=1&phase=voting&family=mafia&voteTally=full" },
  { name: "play-mafia-resolution", path: "/play/VISUAL?visualGame=1&phase=resolution&family=mafia&dead=2" },
  { name: "play-mafia-game-over", path: "/play/VISUAL?visualGame=1&phase=game_over&family=mafia&winner=mafia&dead=4" },
];

const ROUTES = [
  { name: "home", path: "/" },
  { name: "werewolf-home", path: "/werewolf" },
  { name: "mafia-home", path: "/mafia" },
  { name: "werewolf-roles", path: "/werewolf/roles" },
  { name: "werewolf-rules", path: "/werewolf/rules" },
  { name: "tutorial-1", path: "/tutorial?step=1" },
  { name: "tutorial-2", path: "/tutorial?step=2" },
  { name: "tutorial-3", path: "/tutorial?step=3" },
  { name: "tutorial-4", path: "/tutorial?step=4" },
  { name: "tutorial-5", path: "/tutorial?step=5" },
  { name: "tutorial-6", path: "/tutorial?step=6" },
  { name: "sign-in", path: "/sign-in" },
  { name: "account-dashboard", path: "/account?visualAuth=1" },
  { name: "history-empty", path: "/history" },
  { name: "history", path: "/history?visualHistory=fixture" },
  { name: "replay", path: "/history/fixture-game-1/replay?visualReplay=fixture" },
  { name: "leaderboard-empty", path: "/leaderboard?visualLeaderboard=empty" },
  { name: "leaderboard-filled", path: "/leaderboard?visualLeaderboard=fixture" },
  { name: "achievements-gate", path: "/achievements" },
  { name: "achievements", path: "/achievements?visualAuth=1&visualAchievements=fixture" },
  { name: "friends", path: "/friends?visualAuth=1" },
  { name: "create", path: "/create?visualAuth=1" },
  { name: "lobby", path: "/lobby" },
  { name: "werewolf-create", path: "/werewolf/create?visualAuth=1" },
  { name: "mafia-create", path: "/mafia/create?visualAuth=1" },
  ...PLAY_VISUAL_ROUTES,
  { name: "forgot-password", path: "/forgot-password" },
  { name: "reset-password-invalid", path: "/reset-password" },
  { name: "verify-email-invalid", path: "/verify-email?error=TOKEN_EXPIRED" },
  { name: "report", path: "/report" },
  { name: "privacy", path: "/privacy" },
  { name: "privacy-auth", path: "/privacy?visualAuth=1" },
  { name: "terms", path: "/terms" },
  { name: "terms-auth", path: "/terms?visualAuth=1" },
  { name: "status", path: "/status" },
  { name: "faq", path: "/faq" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const COLLECTION_VISUAL_ROUTE_NAMES = new Set(["history", "history-empty", "replay", "leaderboard-empty", "leaderboard-filled", "achievements"]);

const REPRESENTATIVE_VIEWPORTS = [
  { name: "compact-375", width: 375, height: 812 },
  { name: "tablet-768", width: 768, height: 1024 },
] as const;

const REPRESENTATIVE_ROUTES = [
  { name: "home", path: "/", pathname: "/", heading: "Върколак или Мафия" },
  {
    name: "tutorial-1",
    path: "/tutorial?step=1",
    pathname: "/tutorial",
    heading: "Масата се събира.",
  },
  {
    name: "werewolf-rules",
    path: "/werewolf/rules",
    pathname: "/werewolf/rules",
    heading: "Правила за Върколак",
  },
] as const;

const LIGHT_UTILITY_ROUTES = [
  { name: "home", path: "/" },
  { name: "werewolf-home", path: "/werewolf" },
  { name: "mafia-home", path: "/mafia" },
  { name: "account-dashboard", path: "/account?visualAuth=1" },
  { name: "history-empty", path: "/history" },
  { name: "history", path: "/history?visualHistory=fixture" },
  { name: "replay", path: "/history/fixture-game-1/replay?visualReplay=fixture" },
  { name: "leaderboard-empty", path: "/leaderboard?visualLeaderboard=empty" },
  { name: "leaderboard-filled", path: "/leaderboard?visualLeaderboard=fixture" },
  { name: "achievements", path: "/achievements?visualAuth=1&visualAchievements=fixture" },
  { name: "friends", path: "/friends?visualAuth=1" },
  { name: "create", path: "/create?visualAuth=1" },
  { name: "lobby", path: "/lobby" },
  { name: "werewolf-create", path: "/werewolf/create?visualAuth=1" },
  { name: "mafia-create", path: "/mafia/create?visualAuth=1" },
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" },
  { name: "report", path: "/report" },
  { name: "status", path: "/status" },
  { name: "faq", path: "/faq" },
];

const DARK_UTILITY_ROUTE_NAMES = new Set([
  "home",
  "werewolf-home",
  "mafia-home",
  "account-dashboard",
  "history-empty",
  "history",
  "replay",
  "leaderboard-empty",
  "leaderboard-filled",
  "achievements",
  "friends",
  "privacy",
  "privacy-auth",
  "terms",
  "terms-auth",
  "report",
  "status",
  "faq",
  "create",
  "lobby",
  "werewolf-create",
  "mafia-create",
  ...PLAY_VISUAL_ROUTES.map((route) => route.name),
]);

const A11Y_ROUTES = [
  { name: "home", path: "/" },
  { name: "werewolf-home", path: "/werewolf" },
  { name: "mafia-home", path: "/mafia" },
  { name: "werewolf-roles", path: "/werewolf/roles" },
  { name: "mafia-roles", path: "/mafia/roles" },
  { name: "werewolf-rules", path: "/werewolf/rules" },
  { name: "mafia-rules", path: "/mafia/rules" },
  { name: "roles", path: "/roles" },
  { name: "status", path: "/status" },
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" },
  { name: "report", path: "/report" },
  { name: "faq", path: "/faq" },
  { name: "account-dashboard", path: "/account?visualAuth=1" },
  { name: "history-empty", path: "/history" },
  { name: "history", path: "/history?visualHistory=fixture" },
  { name: "replay", path: "/history/fixture-game-1/replay?visualReplay=fixture" },
  { name: "achievements-gate", path: "/achievements" },
  { name: "achievements", path: "/achievements?visualAuth=1&visualAchievements=fixture" },
  { name: "leaderboard-empty", path: "/leaderboard?visualLeaderboard=empty" },
  { name: "leaderboard-filled", path: "/leaderboard?visualLeaderboard=fixture" },
  { name: "friends", path: "/friends?visualAuth=1" },
  { name: "tutorial", path: "/tutorial" },
  { name: "sign-in", path: "/sign-in" },
  { name: "create", path: "/create?visualAuth=1" },
  { name: "lobby", path: "/lobby" },
  { name: "werewolf-create", path: "/werewolf/create?visualAuth=1" },
  { name: "mafia-create", path: "/mafia/create?visualAuth=1" },
  { name: "play-werewolves-night", path: "/play/VISUAL?visualGame=1&phase=night&family=werewolves&role=seer" },
  { name: "play-mafia-voting", path: "/play/VISUAL?visualGame=1&phase=voting&family=mafia&voteTally=full" },
  { name: "forgot-password", path: "/forgot-password" },
  { name: "reset-password-invalid", path: "/reset-password" },
  { name: "verify-email-invalid", path: "/verify-email?error=TOKEN_EXPIRED" },
  { name: "offline", path: "/offline" },
  { name: "not-found", path: "/route-that-does-not-exist" },
];

const CREATE_DETAIL_ROUTES = [
  { name: "werewolf", path: "/werewolf/create?visualAuth=1" },
  { name: "mafia", path: "/mafia/create?visualAuth=1" },
] as const;

for (const route of A11Y_ROUTES) {
  test(`@a11y route ${route.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    if (DARK_UTILITY_ROUTE_NAMES.has(route.name)) {
      await setVisualTheme(page, "dark");
    } else {
      await acceptCookies(page);
    }
    if (route.name.startsWith("play-")) {
      await installNextDevIndicatorGuard(page);
    }
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    if (route.name.endsWith("rules")) {
      await materializeDeferredRulesContent(page);
    }
    if (route.name.startsWith("play-")) {
      await waitForStablePlayStage(page);
      await hideNextDevIndicator(page);
    }
    await page.waitForTimeout(600);

    const accessibility = await new AxeBuilder({ page })
      .include("body")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const contrastViolations = accessibility.violations
      .filter((violation) => violation.id === "color-contrast")
      .flatMap((violation) => violation.nodes.map((node) => node.target));
    console.log(`CONTRAST_BASELINE ${route.name} ${JSON.stringify(contrastViolations)}`);
    expect(contrastViolations).toEqual([]);
    expect(accessibility.violations.filter((violation) => violation.id !== "color-contrast")).toEqual([]);
  });
}

for (const viewport of VIEWPORTS) {
  for (const theme of ["dark", "light"] as const) {
    for (const route of CREATE_DETAIL_ROUTES) {
      test(`@a11y create detail workspace ${viewport.name} ${theme} ${route.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await setVisualTheme(page, theme);
        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.getByRole("button", { name: "Настрой детайлите" }).click();
        await page.getByRole("button", { name: "Настрой ръчно", exact: true }).click();

        const dialog = page.getByRole("dialog", { name: "Настрой детайлите" });
        await expect(dialog).toBeVisible();

        const accessibility = await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        expect(accessibility.violations).toEqual([]);

        const geometry = await dialog.evaluate((element) => ({
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        }));
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);

        if (viewport.name === "mobile") {
          const gallery = dialog.locator(".role-carousel");
          const galleryGeometry = await gallery.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          }));
          expect(galleryGeometry.scrollWidth).toBeLessThanOrEqual(galleryGeometry.clientWidth + 1);
          await expect(dialog.getByRole("button", { name: "Следващи роли" })).toHaveCount(0);
          const lastRole = gallery.locator(".role-tile-large").last();
          await lastRole.scrollIntoViewIfNeeded();
          await expect(lastRole).toBeInViewport();
        }
      });
    }
  }
}

test("@geometry desktop role cards never overlap between workspace rows", async ({ page }) => {
  await page.setViewportSize({ width: 1383, height: 828 });
  await setVisualTheme(page, "light");
  await page.goto("/werewolf/create?visualAuth=1", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByRole("button", { name: "Настрой детайлите" }).click();
  await page.getByRole("button", { name: "Настрой ръчно", exact: true }).click();

  const cards = page.locator('.role-carousel[data-layout="workspace"] .role-tile-large');
  await expect(cards.first()).toBeVisible();
  const rectangles = await cards.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));

  const overlaps: Array<[number, number]> = [];
  for (let first = 0; first < rectangles.length; first += 1) {
    for (let second = first + 1; second < rectangles.length; second += 1) {
      const firstRectangle = rectangles[first]!;
      const secondRectangle = rectangles[second]!;
      const horizontal = Math.min(firstRectangle.right, secondRectangle.right)
        - Math.max(firstRectangle.left, secondRectangle.left);
      const vertical = Math.min(firstRectangle.bottom, secondRectangle.bottom)
        - Math.max(firstRectangle.top, secondRectangle.top);
      if (horizontal > 1 && vertical > 1) {
        overlaps.push([first, second]);
      }
    }
  }

  expect(overlaps).toEqual([]);
});

for (const theme of ["dark", "light"] as const) {
  test(`@geometry play command sits under the table beside the inline role ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setVisualTheme(page, theme);
    await installNextDevIndicatorGuard(page);
    await page.goto("/play/VISUAL?visualGame=1&phase=voting&family=mafia&players=10&voteTally=full", {
      waitUntil: "domcontentloaded",
    });
    await waitForStablePlayStage(page);
    await hideNextDevIndicator(page);

    // The table spans the room; the console band below holds role, command and conversation.
    const primary = page.getByRole("group", { name: "Текущо действие" });
    const personal = page.locator(".play-console-band > .play-personal-area");
    const card = personal.locator(".role-card[data-private-dossier]");
    await expect(primary).toBeVisible();
    await expect(card).toBeVisible();
    await expect(page.getByRole("group", { name: "Лично досие" })).toHaveCount(0);
    await expect(page.locator(".play-action-dock [data-private-dossier], .play-stage [data-private-dossier]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Отвори тайното досие" })).toHaveCount(0);

    const primaryGeometry = await primary.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(primaryGeometry.scrollWidth).toBeLessThanOrEqual(primaryGeometry.clientWidth + 1);

    const [primaryBox, stageBox] = await Promise.all([primary.boundingBox(), page.locator(".play-stage").boundingBox()]);
    expect(primaryBox).not.toBeNull();
    expect(stageBox).not.toBeNull();
    const personalBox = (await personal.boundingBox())!;
    expect(primaryBox!.y).toBeGreaterThanOrEqual(stageBox!.y + stageBox!.height - 1);
    expect(personalBox.y).toBeGreaterThanOrEqual(stageBox!.y + stageBox!.height - 1);
    expect(personalBox.x + personalBox.width).toBeLessThanOrEqual(primaryBox!.x + 1);
    await personal.getByRole("button", { name: "Скрий ролята", exact: true }).click();
    await expect(personal).toBeVisible();
    await expect(page.locator("[data-private-dossier], .role-card-result, .play-private-conversation")).toHaveCount(0);
    await personal.getByRole("button", { name: "Виж ролята си", exact: true }).click();
    await expect(card).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

test("@geometry mobile history stays inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setVisualTheme(page, "dark");
  await page.goto("/history?visualHistory=fixture", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const pageGeometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(pageGeometry.scrollWidth).toBeLessThanOrEqual(pageGeometry.clientWidth + 1);

  const caseFiles = await page.locator(".case-file").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right };
    }),
  );
  for (const caseFile of caseFiles) {
    expect(caseFile.left).toBeGreaterThanOrEqual(-1);
    expect(caseFile.right).toBeLessThanOrEqual(391);
  }
});

test("@geometry achievements features the latest item above an aligned collection", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setVisualTheme(page, "dark");
  await page.goto("/achievements?visualAuth=1&visualAchievements=fixture", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const wall = page.locator(".plaque-wall");
  const plaques = wall.locator(".achievement-plaque");
  await expect(plaques).toHaveCount(6);
  const feature = page.locator(".achievement-feature");
  await expect(feature).toHaveCount(1);
  const featuredId = await feature.getAttribute("data-achievement-id");
  await expect(wall.locator(`[data-achievement-id="${featuredId}"]`)).toHaveCount(0);
  const wallBox = (await wall.boundingBox())!;
  const featureBox = (await feature.boundingBox())!;
  expect(featureBox.y + featureBox.height).toBeLessThan(wallBox.y);
  const boxes = await plaques.evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width };
  }));
  for (let column = 0; column < 3; column += 1) {
    expect(Math.abs(boxes[column]!.x - boxes[column + 3]!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[column]!.width - boxes[column + 3]!.width)).toBeLessThanOrEqual(1);
    expect(boxes[column + 3]!.y).toBeGreaterThan(boxes[column]!.y);
  }

  const archiveLink = page.getByRole("link", { name: "Виж записаните игри" });
  const archiveBox = await archiveLink.boundingBox();
  expect(archiveBox).not.toBeNull();
  expect(Math.abs(wallBox.x - archiveBox!.x)).toBeLessThanOrEqual(2);
  expect(archiveBox!.y).toBeGreaterThan(wallBox.y + wallBox.height);
});

test("@geometry mobile game over uses document scroll without nested story scrollbars", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setVisualTheme(page, "dark");
  await installNextDevIndicatorGuard(page);
  await page.goto(
    "/play/VISUAL?visualGame=1&phase=game_over&family=werewolves&winner=werewolves&dead=5",
    { waitUntil: "domcontentloaded" },
  );
  await waitForStablePlayStage(page);
  await hideNextDevIndicator(page);

  const pageGeometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(pageGeometry.scrollWidth).toBeLessThanOrEqual(pageGeometry.clientWidth + 1);

  const conclusion = page.locator('[data-endgame="werewolves"]');
  const story = conclusion.locator(".post-game-story");
  const scene = conclusion.locator('section[aria-labelledby="conclusion-heading"]');
  await expect(scene.getByRole("heading", { level: 1, name: "Върколаците победиха", exact: true })).toBeFocused();
  await expect(story).toBeVisible();
  await expect(page.locator(".play-stage, .play-seat-slot, .play-primary-column, .play-action-dock")).toHaveCount(0);
  // Hydration can replace deferred content between separate element measurements.
  await expect.poll(() => page.evaluate(() => {
    const shell = document.querySelector("main.play-finale-shell");
    const root = shell?.querySelector("[data-endgame]");
    const scenePanel = root?.querySelector('section[aria-labelledby="conclusion-heading"]');
    const heading = scenePanel?.querySelector("h1");
    const links = [...(scenePanel?.querySelectorAll("a") ?? [])];
    const storyPanel = root?.querySelector(".post-game-story");
    const timeline = storyPanel?.querySelector("ol");
    if (!shell || !root || !scenePanel || !heading || links.length !== 2 || !storyPanel || !timeline) return ["missing finale content"];

    const violations: string[] = [];
    for (const element of [shell, root, scenePanel, heading, storyPanel, timeline, ...links]) {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || getComputedStyle(element).visibility !== "visible") {
        violations.push(`hidden finale content: ${element.className}`);
      }
    }
    for (const element of [storyPanel, timeline]) {
      if (element.scrollHeight > element.clientHeight + 1) violations.push(`nested story scroll: ${element.className}`);
    }
    if (scenePanel.getBoundingClientRect().y - shell.getBoundingClientRect().y > 1) violations.push("finale top gap");
    const sceneRect = scenePanel.getBoundingClientRect();
    if (Math.abs(sceneRect.left) > 1 || Math.abs(sceneRect.width - innerWidth) > 1) violations.push("scene not fullbleed");
    for (const panel of [heading, storyPanel, ...links]) {
      const rect = panel.getBoundingClientRect();
      if (rect.left < 19 || rect.right > innerWidth - 19) violations.push(`finale outside gutters: ${panel.className}`);
    }
    for (const element of [heading, ...links]) {
      const rect = element.getBoundingClientRect();
      // Measure content, not the decorative button pseudo-element's scroll extent.
      const range = document.createRange();
      range.selectNodeContents(element);
      const clipsY = getComputedStyle(element).overflowY !== "visible";
      for (const content of range.getClientRects()) {
        if (content.left < rect.left - 1 || content.right > rect.right + 1
          || content.top < (clipsY ? rect.top : sceneRect.top) - 1
          || content.bottom > (clipsY ? rect.bottom : sceneRect.bottom) + 1) violations.push(`finale text clipped: ${element.textContent}`);
      }
    }
    for (const link of links) {
      const rect = link.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) violations.push("finale action hit target");
    }
    return violations;
  })).toEqual([]);

  const backdrop = scene.locator(':scope > img[src$=".webp"]').first();
  await expectDecodedImage(backdrop);
  await expect(backdrop).toHaveAttribute("src", "/game-art/endgame/werewolves-v1.webp");
  await expect(backdrop).toHaveCSS("object-fit", "cover");
  await expect(backdrop).toHaveCSS("filter", "none");
  const archive = scene.getByRole("link", { name: "Към архива", exact: true });
  await expect(archive).toHaveAttribute("href", "/history");
  // Compare one connected render; deferred content can remount during hydration.
  await expect.poll(() => scene.evaluate((element) => {
    const art = element.querySelector<HTMLImageElement>('img[src$="werewolves-v1.webp"]');
    const archive = element.querySelector('a[href="/history"]');
    if (!element.isConnected || !art?.complete || !art.naturalWidth || !archive) return false;
    const artBox = art.getBoundingClientRect();
    const archiveBox = archive.getBoundingClientRect();
    return Math.abs(artBox.x) < 0.5 && Math.abs(artBox.width - 390) < 0.5
      && artBox.height > 0 && archiveBox.height > 0 && artBox.y >= archiveBox.bottom;
  })).toBe(true);

  const outerChrome = await conclusion.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderWidth: style.borderTopWidth,
      padding: style.paddingTop,
      backgroundImage: style.backgroundImage,
      boxShadow: style.boxShadow,
    };
  });
  expect(outerChrome).toEqual({
    borderWidth: "0px",
    padding: "0px",
    backgroundImage: "none",
    boxShadow: "none",
  });

  await expect(scene.getByRole("heading", { level: 1, name: "Върколаците победиха", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(scene.getByRole("link", { name: "Още една игра", exact: true })).toBeFocused();
  await story.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

test("@geometry desktop game over uses a fullbleed native scene without rectangular chrome", async ({ page }) => {
  await page.setViewportSize({ width: 1150, height: 685 });
  await setVisualTheme(page, "dark");
  await installNextDevIndicatorGuard(page);
  await page.goto(
    "/play/VISUAL?visualGame=1&phase=game_over&family=werewolves&winner=werewolves&dead=5",
    { waitUntil: "domcontentloaded" },
  );
  await waitForStablePlayStage(page);
  await hideNextDevIndicator(page);

  const conclusion = page.locator('[data-endgame="werewolves"]');
  const scene = conclusion.locator('section[aria-labelledby="conclusion-heading"]');
  const backdrop = scene.locator(':scope > img[src$=".webp"]').first();
  await expect(conclusion).toBeVisible();
  await expect(page.locator(".play-stage, .play-primary-column, .play-action-dock")).toHaveCount(0);
  await expectDecodedImage(backdrop);
  await expect(backdrop).toHaveAttribute("src", "/game-art/endgame/werewolves-v1.webp");
  await expect(backdrop).toHaveAttribute("alt", "");

  const conclusionChrome = await conclusion.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderWidth: style.borderTopWidth,
      backgroundImage: style.backgroundImage,
      boxShadow: style.boxShadow,
      overflow: style.overflow,
    };
  });
  expect(conclusionChrome).toEqual({
    borderWidth: "0px",
    backgroundImage: "none",
    boxShadow: "none",
    overflow: "visible",
  });

  await expect(scene).toHaveCSS("border-radius", "0px");
  await expect(scene).toHaveCSS("border-top-width", "0px");
  await expect(scene).toHaveCSS("box-shadow", "none");
  await expect(backdrop).toHaveCSS("object-fit", "cover");
  await expect(backdrop).toHaveCSS("filter", "none");
  await expect(backdrop).toHaveCSS("opacity", "1");
  const sceneBox = (await scene.boundingBox())!;
  const artBox = (await backdrop.boundingBox())!;
  expect(sceneBox.x).toBeCloseTo(0, 0);
  expect(sceneBox.width).toBeCloseTo(1150, 0);
  expect(artBox).toEqual(sceneBox);
  await expect(scene.getByRole("heading", { level: 1, name: "Върколаците победиха", exact: true })).toBeVisible();
  await expect(scene.getByRole("link", { name: "Още една игра", exact: true })).toBeVisible();
  await expect(scene.getByRole("link", { name: "Към архива", exact: true })).toHaveAttribute("href", "/history");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("@geometry mobile hunter revenge keeps the action sheet inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setVisualTheme(page, "dark");
  await installNextDevIndicatorGuard(page);
  await page.goto(
    "/play/VISUAL?visualGame=1&phase=hunter_revenge&family=werewolves&role=hunter&viewer=dead&players=8&dead=1",
    { waitUntil: "domcontentloaded" },
  );
  await waitForStablePlayStage(page);
  await hideNextDevIndicator(page);

  const pageGeometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(pageGeometry.scrollWidth).toBeLessThanOrEqual(pageGeometry.clientWidth + 1);

  const actionDock = page.locator(".play-action-dock");
  await expect(actionDock).toBeVisible();
  const dockBox = await actionDock.boundingBox();
  expect(dockBox).not.toBeNull();
  expect(dockBox!.x).toBeGreaterThanOrEqual(-1);
  expect(dockBox!.x + dockBox!.width).toBeLessThanOrEqual(391);
});

for (const viewport of REPRESENTATIVE_VIEWPORTS) {
  for (const route of REPRESENTATIVE_ROUTES) {
    test(`@representative ${viewport.name} ${route.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setVisualTheme(page, "dark");
      if (route.name.startsWith("tutorial-") || route.name.endsWith("rules")) await installNextDevIndicatorGuard(page);
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      if (route.name.endsWith("rules")) {
        await materializeDeferredRulesContent(page);
      }
      await page.waitForTimeout(600);

      const currentUrl = new URL(page.url());
      expect(currentUrl.pathname).toBe(route.pathname);
      if (route.name === "tutorial-1") {
        expect(currentUrl.searchParams.get("step")).toBe("1");
      }
      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
      if (route.name === "home") await materializeHomepageDeck(page);
      if (route.name.endsWith("-home")) await materializeFamilyPortraits(page);
      if (route.name === "home" || route.name.endsWith("-home")) await hideNextDevIndicator(page);
      if (route.name.startsWith("tutorial-") || route.name.endsWith("rules")) await hideNextDevIndicator(page);
      await expect(page).toHaveScreenshot(`${viewport.name}-${route.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        mask: visualMasks(page),
        timeout: 15_000,
      });
    });
  }

  test(`@representative ${viewport.name} werewolf create details`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setVisualTheme(page, "dark");
    await page.goto("/werewolf/create?visualAuth=1", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    expect(new URL(page.url()).pathname).toBe("/werewolf/create");

    await page.getByRole("button", { name: "Настрой детайлите" }).click();
    await page.getByRole("button", { name: "Настрой ръчно", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Настрой детайлите" });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveScreenshot(`${viewport.name}-werewolf-create-details.png`, {
      fullPage: false,
      maxDiffPixelRatio: 0.01,
      mask: visualMasks(page),
      timeout: 15_000,
    });
  });
}

for (const viewport of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`${viewport.name} ${route.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      if (DARK_UTILITY_ROUTE_NAMES.has(route.name)) {
        await setVisualTheme(page, "dark");
      } else {
        await acceptCookies(page);
      }
      if (route.name.startsWith("play-") || route.name.startsWith("tutorial-") || route.name.endsWith("rules") || COLLECTION_VISUAL_ROUTE_NAMES.has(route.name)) {
        await installNextDevIndicatorGuard(page);
      }
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      if (route.name.endsWith("rules")) {
        await materializeDeferredRulesContent(page);
      }
      if (route.name.startsWith("play-")) {
        await waitForStablePlayStage(page);
        await hideNextDevIndicator(page);
      }
      if (route.name.endsWith("-roles")) {
        await materializeRolePortraits(page);
      }
      await page.waitForTimeout(600);
      if (route.name.startsWith("play-")) {
        await hideNextDevIndicator(page);
      }
      if (route.name === "replay") {
        await expect(page.getByText("actorNameBg", { exact: false })).toHaveCount(0);
        await expect(page.getByText("targetNameBg", { exact: false })).toHaveCount(0);
        await expect(page.getByText("roleNameBg", { exact: false })).toHaveCount(0);
      }
      if (route.name === "home" || route.name.endsWith("-home")) await hideNextDevIndicator(page);
      if (route.name.startsWith("tutorial-") || route.name.endsWith("rules")) await hideNextDevIndicator(page);
      if (COLLECTION_VISUAL_ROUTE_NAMES.has(route.name)) await hideNextDevIndicator(page);
      if (route.name === "home") await materializeHomepageDeck(page);
      if (route.name.endsWith("-home")) await materializeFamilyPortraits(page);
      if (route.name === "achievements") await materializeAchievementRelics(page);
      await expect(page).toHaveScreenshot(`${viewport.name}-${route.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        mask: visualMasks(page),
        timeout: 15_000,
      });
    });
  }

  for (const route of LIGHT_UTILITY_ROUTES) {
    test(`${viewport.name} ${route.name} light`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setVisualTheme(page, "light");
      if (COLLECTION_VISUAL_ROUTE_NAMES.has(route.name)) await installNextDevIndicatorGuard(page);
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(600);
      if (COLLECTION_VISUAL_ROUTE_NAMES.has(route.name)) await hideNextDevIndicator(page);
      if (route.name === "achievements") {
        await materializeAchievementRelics(page);
      }
      if (route.name === "replay") {
        await expect(page.getByText("actorNameBg", { exact: false })).toHaveCount(0);
        await expect(page.getByText("targetNameBg", { exact: false })).toHaveCount(0);
        await expect(page.getByText("roleNameBg", { exact: false })).toHaveCount(0);
      }
      if (route.name === "home" || route.name.endsWith("-home")) await hideNextDevIndicator(page);
      if (route.name === "home") await materializeHomepageDeck(page);
      if (route.name.endsWith("-home")) await materializeFamilyPortraits(page);
      await expect(page).toHaveScreenshot(`${viewport.name}-${route.name}-light.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        mask: visualMasks(page),
        timeout: 15_000,
      });
    });
  }

  test(`${viewport.name} tutorial feedback open`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await acceptCookies(page);
    await page.addInitScript(() => {
      window.localStorage.setItem("welcome-modal-shown", "1");
    });
    await mockFeedbackSession(page);
    await installNextDevIndicatorGuard(page);
    await page.goto("/tutorial", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByRole("button", { name: "Дай ни бележка" }).click();
    await expect(page.getByRole("dialog", { name: "Дай ни бележка." })).toBeVisible();
    await page.waitForTimeout(600);
    await hideNextDevIndicator(page);
    await expect(page).toHaveScreenshot(`${viewport.name}-tutorial-feedback-open.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
      mask: visualMasks(page),
      timeout: 15_000,
    });
  });

  test(`${viewport.name} report details abuse`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setVisualTheme(page, "dark");
    await page.goto("/report", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByRole("button", { name: "Напред", exact: true }).click();
    await expect(page.getByText("Код на стая и приблизителен час")).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page).toHaveScreenshot(`${viewport.name}-report-details-abuse.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
      mask: visualMasks(page),
      timeout: 15_000,
    });
  });

  test(`${viewport.name} report details copyright`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setVisualTheme(page, "dark");
    await page.goto("/report", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByText("Авторски права", { exact: true }).click();
    await page.getByRole("button", { name: "Напред", exact: true }).click();
    await expect(page.getByText("Линк към материала и кой е автор")).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page).toHaveScreenshot(`${viewport.name}-report-details-copyright.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
      mask: visualMasks(page),
      timeout: 15_000,
    });
  });

  test(`${viewport.name} report review`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setVisualTheme(page, "dark");
    await page.goto("/report?visualAuth=1&visualStep=review", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByText("Преглед преди изпращане.")).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page).toHaveScreenshot(`${viewport.name}-report-review.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
      mask: visualMasks(page),
      timeout: 15_000,
    });
  });

  test(`${viewport.name} report success`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await setVisualTheme(page, "dark");
    await page.goto("/report?visualAuth=1&visualStep=success", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByRole("heading", { name: "Сигналът е изпратен.", exact: true })).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page).toHaveScreenshot(`${viewport.name}-report-success.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
      mask: visualMasks(page),
      timeout: 15_000,
    });
  });
}

function visualMasks(page: Page) {
  return [page.locator(".harbor-foot-time"), page.locator(".status-hero-time")];
}

async function waitForStablePlayStage(page: Page) {
  await expect(page.locator(".play-stage, [data-endgame]")).toBeVisible({ timeout: 10_000 });
  if (await page.locator(".play-stage").count()) {
    await expect(page.locator(".play-stage")).toHaveAttribute("data-layout-ready", "true", {
      timeout: 10_000,
    });
  } else {
    await expect(page.locator("[data-endgame]").getByRole("link", { name: "Още една игра", exact: true })).toBeVisible();
    await expect(page.locator(".post-game-story")).toBeVisible();
  }

  await page.waitForFunction(async () => {
    await document.fonts.ready;

    const readSignature = () => {
      const conclusion = document.querySelector<HTMLElement>("[data-endgame]");
      if (conclusion) {
        const scene = conclusion.querySelector('section[aria-labelledby="conclusion-heading"]');
        const heading = conclusion.querySelector("h1");
        const story = conclusion.querySelector(".post-game-story");
        const actions = [...(scene?.querySelectorAll("a") ?? [])];
        const image = scene?.querySelector<HTMLImageElement>(':scope > img[src$=".webp"]');
        if (!scene || !heading || !story || actions.length !== 2 || !image?.complete || !image.naturalWidth) return "";
        const rects = [conclusion, scene, image, heading, story, ...actions].map((element) => element.getBoundingClientRect());
        if (rects.some((rect) => rect.width <= 0 || rect.height <= 0)) return "";
        return rects.flatMap((rect) => [rect.x, rect.y, rect.width, rect.height].map(Math.round)).join(":");
      }
      const stage = document.querySelector<HTMLElement>(".play-stage");
      const scene = document.querySelector<HTMLElement>("[data-table-scene]");
      const seats = [...document.querySelectorAll<HTMLElement>(".play-seat-slot")];
      if (!stage || !scene || seats.length === 0 || stage.dataset.layoutReady !== "true") {
        return "";
      }

      const stageRect = stage.getBoundingClientRect();
      const sceneRect = scene.getBoundingClientRect();
      const firstSeatRect = seats[0]!.getBoundingClientRect();
      return [
        stage.dataset.layoutMode,
        Math.round(stageRect.width),
        Math.round(stageRect.height),
        Math.round(sceneRect.width),
        Math.round(sceneRect.height),
        Math.round(firstSeatRect.x),
        Math.round(firstSeatRect.y),
        seats.length,
      ].join(":");
    };

    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const first = readSignature();
    if (!first) {
      return false;
    }
    await nextFrame();
    const second = readSignature();
    await nextFrame();
    return first === second && second === readSignature();
  }, undefined, { timeout: 10_000, polling: "raf" });
}

async function materializeHomepageDeck(page: Page) {
  // Full-page capture does not scroll, so visit deferred art as a reader would.
  const deck = page.locator(".home-start-deck");
  await deck.scrollIntoViewIfNeeded();
  const images = deck.locator("img");
  await expect(images).toHaveCount(3);
  for (const image of await images.all()) await expectDecodedImage(image);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
}

async function materializeRolePortraits(page: Page) {
  for (const portrait of await page.locator(".role-codex-card img").all()) {
    await portrait.scrollIntoViewIfNeeded();
    await portrait.evaluate((image: HTMLImageElement) => image.decode());
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
}

async function materializeFamilyPortraits(page: Page) {
  const path = new URL(page.url()).pathname;
  expect(["/werewolf", "/mafia"]).toContain(path);
  const artwork = page.locator(".role-spotlight__art, .variant-chip__art");
  await expect(artwork).toHaveCount(path === "/werewolf" ? 7 : 4);
  for (const frame of await artwork.all()) {
    await frame.scrollIntoViewIfNeeded();
    await expect(frame.locator("img")).toHaveCount(1);
    await expectDecodedImage(frame.locator("img"));
  }
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    window.scrollTo({ top: 0, behavior: "instant" });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function materializeAchievementRelics(page: Page) {
  const scene = await page.locator("body").evaluate(async body => {
    const style = getComputedStyle(body, "::after");
    const url = style.backgroundImage.match(/url\("([^"]+)"\)/)?.[1];
    const image = new Image();
    if (url) {
      image.src = url;
      await image.decode();
    }
    return { url, width: image.naturalWidth, height: parseFloat(style.height), position: style.position };
  });
  expect(scene.url).toContain("/game-art/achievements/collection-table-");
  expect(scene.width).toBeGreaterThanOrEqual(1280);
  const sceneHeight = await page.locator("html").getAttribute("data-theme") === "light" && page.viewportSize()!.width >= 640 ? 1112 : 1024;
  expect(scene.height).toBe(sceneHeight);
  expect(scene.position).toBe("absolute");
  const images = page.locator(".achievement-shell img");
  await expect(images).toHaveCount(8);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expectDecodedImage(image);
  }
  await page.evaluate(async () => {
    window.scrollTo({ top: 0, behavior: "instant" });
    // Let the compositor repaint the absolute scene after materializing offscreen relics.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  const sceneScreenshot = test.info().outputPath("painted-collection.png");
  await page.screenshot({ path: sceneScreenshot, fullPage: true });
  await test.info().attach("painted-collection", { path: sceneScreenshot, contentType: "image/png" });
}

async function materializeDeferredRulesContent(page: Page) {
  await page.evaluate(async () => {
    const settle = () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const step = Math.max(320, Math.floor(window.innerHeight * 0.72));

    for (let top = 0; top < document.documentElement.scrollHeight; top += step) {
      window.scrollTo({ top, behavior: "instant" });
      await settle();
    }

    window.scrollTo({ top: 0, behavior: "instant" });
    await settle();
  });
  await page.addStyleTag({
    content: `
      .rules-phase-timeline,
      .rules-table-protocol,
      .rules-scenario-section,
      .rules-chapter-grid {
        content-visibility: visible !important;
        contain-intrinsic-size: none !important;
      }
    `,
  });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function acceptCookies(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("cookie-consent", "1");
  });
}

async function setVisualTheme(page: Page, theme: "dark" | "light") {
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem("cookie-consent", "1");
    window.localStorage.setItem("werewolf-theme", selectedTheme);
  }, theme);
}

async function hideNextDevIndicator(page: Page) {
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((element) => element.remove());
  });
}

async function installNextDevIndicatorGuard(page: Page) {
  await page.addInitScript(() => {
    const hideNextPortal = () => {
      document.querySelectorAll("nextjs-portal").forEach((element) => element.remove());
    };
    const installObserver = () => {
      hideNextPortal();
      new MutationObserver(hideNextPortal).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    };
    if (document.documentElement) {
      installObserver();
    } else {
      window.addEventListener("DOMContentLoaded", installObserver, { once: true });
    }
  });
}

async function mockFeedbackSession(page: Page) {
  await page.route(/\/api\/auth\/(?:get-session|session)(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session: {
          id: "visual-session",
          token: "visual-session-token",
          userId: "visual-user",
          expiresAt: "2099-01-01T00:00:00.000Z",
          createdAt: "2026-05-17T00:00:00.000Z",
          updatedAt: "2026-05-17T00:00:00.000Z",
        },
        user: {
          id: "visual-user",
          email: "visual@example.com",
          name: "Визуален играч",
          image: null,
          emailVerified: true,
          createdAt: "2026-05-17T00:00:00.000Z",
          updatedAt: "2026-05-17T00:00:00.000Z",
        },
      }),
    });
  });
}
