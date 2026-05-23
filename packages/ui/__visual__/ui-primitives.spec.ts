import { expect, test } from "playwright/test";

const STORIES = [
  { name: "surface", id: "primitives-surface--all-variants" },
  { name: "eyebrow", id: "primitives-eyebrow--all-variants" },
  { name: "display", id: "primitives-display--all-sizes" },
  { name: "paper-card", id: "primitives-papercard--all-variants" },
  { name: "scene-card", id: "primitives-scenecard--all-variants" },
  { name: "pill", id: "primitives-pill--all-variants" },
  { name: "medallion", id: "primitives-medallion--all-variants" },
  { name: "toast", id: "primitives-toast--all-variants" },
  { name: "dialog", id: "primitives-dialog--all-variants" },
  { name: "sheet", id: "primitives-sheet--all-variants" },
  { name: "empty-state", id: "primitives-emptystate--all-variants" },
] as const;

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const THEMES = ["light", "dark"] as const;

for (const viewport of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const story of STORIES) {
      test(`@ui ${viewport.name} ${theme} ${story.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForSelector("#storybook-root");
        await page.evaluate((selectedTheme) => {
          document.documentElement.dataset.theme = selectedTheme;
        }, theme);
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(700);
        await expect(page).toHaveScreenshot(`${viewport.name}-${theme}-${story.name}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.01,
          timeout: 15_000,
        });
      });
    }
  }
}
