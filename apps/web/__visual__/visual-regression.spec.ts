import { expect, test } from "playwright/test";

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
  { name: "history-empty", path: "/history" },
  { name: "leaderboard-empty", path: "/leaderboard" },
  { name: "achievements-gate", path: "/achievements" },
  { name: "forgot-password", path: "/forgot-password" },
  { name: "reset-password-invalid", path: "/reset-password" },
  { name: "verify-email-invalid", path: "/verify-email?token=fake" },
  { name: "report", path: "/report" },
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" },
  { name: "status", path: "/status" },
  { name: "faq", path: "/faq" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

for (const viewport of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`${viewport.name} ${route.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript(() => window.localStorage.setItem("cookie-consent", "1"));
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(600);
      await expect(page).toHaveScreenshot(`${viewport.name}-${route.name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.002,
        mask: [page.locator(".harbor-foot-time")],
        timeout: 15_000,
      });
    });
  }
}
