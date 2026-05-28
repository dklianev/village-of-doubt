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
  { name: "account-dashboard", path: "/account" },
  { name: "history-empty", path: "/history" },
  { name: "history", path: "/history?visualHistory=fixture" },
  { name: "leaderboard-empty", path: "/leaderboard" },
  { name: "achievements-gate", path: "/achievements" },
  { name: "achievements", path: "/achievements?visualAuth=1" },
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
  { name: "account-dashboard", path: "/account" },
  { name: "history-empty", path: "/history" },
  { name: "history", path: "/history?visualHistory=fixture" },
  { name: "leaderboard-empty", path: "/leaderboard" },
  { name: "achievements", path: "/achievements?visualAuth=1" },
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
  { name: "status", path: "/status" },
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" },
  { name: "report", path: "/report" },
  { name: "faq", path: "/faq" },
  { name: "account-dashboard", path: "/account" },
  { name: "history-empty", path: "/history" },
  { name: "history", path: "/history?visualHistory=fixture" },
  { name: "achievements-gate", path: "/achievements" },
  { name: "achievements", path: "/achievements?visualAuth=1" },
  { name: "leaderboard-empty", path: "/leaderboard" },
  { name: "friends", path: "/friends?visualAuth=1" },
  { name: "tutorial", path: "/tutorial" },
  { name: "sign-in", path: "/sign-in" },
  { name: "create", path: "/create?visualAuth=1" },
  { name: "lobby", path: "/lobby" },
  { name: "werewolf-create", path: "/werewolf/create?visualAuth=1" },
  { name: "mafia-create", path: "/mafia/create?visualAuth=1" },
];

for (const route of A11Y_ROUTES) {
  test(`@a11y route ${route.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    if (DARK_UTILITY_ROUTE_NAMES.has(route.name)) {
      await setVisualTheme(page, "dark");
    } else {
      await acceptCookies(page);
    }
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(600);

    const accessibility = await new AxeBuilder({ page })
      .include("body")
      .withTags(["wcag2a", "wcag2aa"])
      // Legacy visual surfaces still have known contrast debt; this sweep gates structural axe regressions.
      .disableRules(["color-contrast"])
      .analyze();

    expect(accessibility.violations).toEqual([]);
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
      if (route.name.startsWith("play-")) {
        await installNextDevIndicatorGuard(page);
      }
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      if (route.name.startsWith("play-")) {
        await hideNextDevIndicator(page);
      }
      await page.waitForTimeout(600);
      if (route.name.startsWith("play-")) {
        await hideNextDevIndicator(page);
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
