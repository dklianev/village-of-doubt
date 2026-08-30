import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "playwright/test";

const ROUTES = [
  { name: "начало", path: "/" },
  { name: "върколак", path: "/werewolf" },
  { name: "мафия", path: "/mafia" },
  { name: "роли-върколак", path: "/werewolf/roles" },
  { name: "роли-мафия", path: "/mafia/roles" },
  { name: "правила-върколак", path: "/werewolf/rules" },
  { name: "правила-мафия", path: "/mafia/rules" },
  { name: "създаване", path: "/create?visualAuth=1" },
  { name: "създаване-върколак", path: "/werewolf/create?visualAuth=1" },
  { name: "създаване-мафия", path: "/mafia/create?visualAuth=1" },
  { name: "урок", path: "/tutorial?step=1" },
  { name: "приятели", path: "/friends?visualAuth=1" },
  { name: "история", path: "/history?visualHistory=fixture" },
  { name: "запис", path: "/history/fixture-game-1/replay?visualReplay=fixture" },
  { name: "легенди", path: "/achievements?visualAuth=1&visualAchievements=fixture" },
  { name: "класация", path: "/leaderboard" },
  { name: "въпроси", path: "/faq" },
  { name: "поверителност", path: "/privacy" },
  { name: "условия", path: "/terms" },
  { name: "сигнал", path: "/report" },
  { name: "състояние", path: "/status" },
  { name: "вход", path: "/sign-in" },
  { name: "досие", path: "/account?visualAuth=1" },
] as const;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const THEMES = ["dark", "light"] as const;

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const route of ROUTES) {
      test(`@site-a11y ${viewport.name} ${theme} ${route.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.addInitScript((selectedTheme) => {
          window.localStorage.setItem("cookie-consent", "1");
          window.localStorage.setItem("werewolf-theme", selectedTheme);
        }, theme);

        await page.goto(route.path, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(250);

        const accessibility = await new AxeBuilder({ page })
          .include("body")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();

        expect(accessibility.violations).toEqual([]);

        const viewportGeometry = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));

        expect(viewportGeometry.scrollWidth).toBeLessThanOrEqual(viewportGeometry.clientWidth + 1);

        if (viewport.name === "mobile" && route.path.endsWith("/roles")) {
          const roleGridColumns = await page.locator(".role-codex-grid").evaluate((element) => (
            getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length
          ));
          expect(roleGridColumns).toBe(1);
        }
      });
    }
  }
}

test("@site-a11y keyboard users can skip chrome and Escape returns focus to More", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Към основното съдържание" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const more = page.getByRole("button", { name: "Още страници" });
  await expect(more).toBeEnabled();
  await more.click();
  await expect(page.getByRole("navigation", { name: "Още страници" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Още страници" })).toHaveCount(0);
  await expect(more).toBeFocused();
});
