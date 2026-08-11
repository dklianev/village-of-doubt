import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "playwright/test";

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
  { name: "leaderboard-empty", path: "/leaderboard" },
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
  { name: "verify-email-invalid", path: "/verify-email?token=fake" },
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

const LIGHT_UTILITY_ROUTES = [
  { name: "home", path: "/" },
  { name: "werewolf-home", path: "/werewolf" },
  { name: "mafia-home", path: "/mafia" },
  { name: "account-dashboard", path: "/account?visualAuth=1" },
  { name: "history-empty", path: "/history" },
  { name: "history", path: "/history?visualHistory=fixture" },
  { name: "replay", path: "/history/fixture-game-1/replay?visualReplay=fixture" },
  { name: "leaderboard-empty", path: "/leaderboard" },
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
  { name: "leaderboard-empty", path: "/leaderboard" },
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
  { name: "verify-email-invalid", path: "/verify-email?token=fake" },
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
          const initialPosition = await gallery.evaluate((element) => element.scrollLeft);
          await dialog.getByRole("button", { name: "Следващи роли" }).click();
          await expect.poll(() => gallery.evaluate((element) => element.scrollLeft)).toBeGreaterThan(initialPosition);
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
  test(`@geometry play action dock columns ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setVisualTheme(page, theme);
    await installNextDevIndicatorGuard(page);
    await page.goto("/play/VISUAL?visualGame=1&phase=voting&family=mafia&players=10&voteTally=full", {
      waitUntil: "domcontentloaded",
    });
    await waitForStablePlayStage(page);
    await hideNextDevIndicator(page);

    const primary = page.getByRole("group", { name: "Текущо действие" });
    const dossier = page.getByRole("group", { name: "Лично досие" });
    await expect(primary).toBeVisible();
    await expect(dossier).toBeVisible();

    const primaryGeometry = await primary.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(primaryGeometry.scrollWidth).toBeLessThanOrEqual(primaryGeometry.clientWidth + 1);

    const [primaryBox, dossierBox] = await Promise.all([primary.boundingBox(), dossier.boundingBox()]);
    expect(primaryBox).not.toBeNull();
    expect(dossierBox).not.toBeNull();
    expect(primaryBox!.x + primaryBox!.width).toBeLessThanOrEqual(dossierBox!.x + 1);
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

test("@geometry achievements centers an orphan plaque on the hall wall", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setVisualTheme(page, "dark");
  await page.goto("/achievements?visualAuth=1&visualAchievements=fixture", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const wall = page.locator(".plaque-wall");
  const plaques = wall.locator(".achievement-plaque");
  const plaqueCount = await plaques.count();
  expect(plaqueCount % 3).toBe(1);

  const [wallBox, lastPlaqueBox] = await Promise.all([
    wall.boundingBox(),
    plaques.nth(plaqueCount - 1).boundingBox(),
  ]);
  expect(wallBox).not.toBeNull();
  expect(lastPlaqueBox).not.toBeNull();

  const wallCenter = wallBox!.x + wallBox!.width / 2;
  const plaqueCenter = lastPlaqueBox!.x + lastPlaqueBox!.width / 2;
  expect(Math.abs(wallCenter - plaqueCenter)).toBeLessThanOrEqual(2);

  const archiveLink = page.getByRole("link", { name: "Виж записаните игри" });
  const archiveBox = await archiveLink.boundingBox();
  expect(archiveBox).not.toBeNull();
  const archiveCenter = archiveBox!.x + archiveBox!.width / 2;
  expect(Math.abs(wallCenter - archiveCenter)).toBeLessThanOrEqual(2);
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

  const story = page.locator(".play-stage-takeover .post-game-story");
  const winner = page.locator(".play-stage-takeover .play-winner");
  const timeline = story.locator("ol");
  await expect(story).toBeVisible();
  const stage = page.locator(".play-stage");
  const takeover = page.locator(".play-stage-takeover");
  const [storyGeometry, timelineGeometry, stageBox, takeoverBox, winnerBox, storyBox] = await Promise.all([
    story.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight })),
    timeline.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight })),
    stage.boundingBox(),
    takeover.boundingBox(),
    winner.boundingBox(),
    story.boundingBox(),
  ]);
  expect(storyGeometry.scrollHeight).toBeLessThanOrEqual(storyGeometry.clientHeight + 1);
  expect(timelineGeometry.scrollHeight).toBeLessThanOrEqual(timelineGeometry.clientHeight + 1);
  expect(stageBox).not.toBeNull();
  expect(takeoverBox).not.toBeNull();
  expect(winnerBox).not.toBeNull();
  expect(storyBox).not.toBeNull();
  expect(takeoverBox!.y - stageBox!.y).toBeLessThanOrEqual(48);
  for (const panelBox of [winnerBox!, storyBox!]) {
    expect(panelBox.x).toBeGreaterThanOrEqual(23);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(367);
  }

  const winnerFrame = await winner.evaluate((element) => {
    const style = getComputedStyle(element, "::before");
    return {
      maskImage: style.maskImage,
      webkitMaskImage: style.webkitMaskImage,
    };
  });
  expect(winnerFrame).toEqual({ maskImage: "none", webkitMaskImage: "none" });

  const winnerSurface = await winner.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundSize: style.backgroundSize.split(", ")[2],
      backgroundRepeat: style.backgroundRepeat.split(", ")[2],
    };
  });
  expect(winnerSurface).toEqual({ backgroundSize: "100%", backgroundRepeat: "no-repeat" });

  const outerChrome = await takeover.evaluate((element) => {
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

  const stageChrome = await stage.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderWidth: style.borderTopWidth,
      padding: style.paddingTop,
      backgroundImage: style.backgroundImage,
      boxShadow: style.boxShadow,
    };
  });
  expect(stageChrome).toEqual({
    borderWidth: "0px",
    padding: "0px",
    backgroundImage: "none",
    boxShadow: "none",
  });
});

test("@geometry desktop game over uses a feathered takeover without rectangular chrome", async ({ page }) => {
  await page.setViewportSize({ width: 1150, height: 685 });
  await setVisualTheme(page, "dark");
  await installNextDevIndicatorGuard(page);
  await page.goto(
    "/play/VISUAL?visualGame=1&phase=game_over&family=werewolves&winner=werewolves&dead=5",
    { waitUntil: "domcontentloaded" },
  );
  await waitForStablePlayStage(page);
  await hideNextDevIndicator(page);

  const takeover = page.locator(".play-stage-takeover");
  const winnerScene = takeover.locator(".play-winner-scene");
  await expect(takeover).toBeVisible();

  const takeoverChrome = await takeover.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderWidth: style.borderTopWidth,
      backgroundImage: style.backgroundImage,
      boxShadow: style.boxShadow,
      overflow: style.overflow,
    };
  });
  expect(takeoverChrome).toEqual({
    borderWidth: "0px",
    backgroundImage: "none",
    boxShadow: "none",
    overflow: "visible",
  });

  const winnerSceneStyle = await winnerScene.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      maskImage: style.maskImage,
      webkitMaskImage: style.webkitMaskImage,
      opacity: Number(style.opacity),
    };
  });
  expect(winnerSceneStyle.maskImage).toContain("radial-gradient");
  expect(winnerSceneStyle.webkitMaskImage).toContain("radial-gradient");
  expect(winnerSceneStyle.opacity).toBeLessThanOrEqual(0.4);
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

for (const viewport of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`${viewport.name} ${route.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
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
      if (route.name.startsWith("play-")) {
        await waitForStablePlayStage(page);
        await hideNextDevIndicator(page);
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
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(600);
      if (route.name === "replay") {
        await expect(page.getByText("actorNameBg", { exact: false })).toHaveCount(0);
        await expect(page.getByText("targetNameBg", { exact: false })).toHaveCount(0);
        await expect(page.getByText("roleNameBg", { exact: false })).toHaveCount(0);
      }
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
    await page.goto("/tutorial", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByRole("button", { name: "Дай ни бележка" }).click();
    await expect(page.getByRole("dialog", { name: "Дай ни бележка." })).toBeVisible();
    await page.waitForTimeout(600);
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
    await page.getByRole("button", { name: "Напред →" }).click();
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
    await page.getByRole("button", { name: "Напред →" }).click();
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
    await expect(page.getByText("Светилникът свети.")).toBeVisible();
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
  await expect(page.locator(".play-stage")).toHaveAttribute("data-layout-ready", "true", {
    timeout: 10_000,
  });

  await page.waitForFunction(async () => {
    await document.fonts.ready;

    const readSignature = () => {
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
