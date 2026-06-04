import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "playwright/test";

const STORIES = [
  { name: "surface", id: "primitives-surface--all-variants" },
  { name: "eyebrow", id: "primitives-eyebrow--all-variants" },
  { name: "display", id: "primitives-display--all-sizes" },
  { name: "paper-card", id: "primitives-papercard--all-variants" },
  { name: "paper-card-interactive", id: "primitives-papercard--interactive" },
  { name: "paper-card-accent-win", id: "primitives-papercard--with-accent-win" },
  { name: "paper-card-accent-loss", id: "primitives-papercard--with-accent-loss" },
  { name: "paper-card-accent-warning", id: "primitives-papercard--with-accent-warning" },
  { name: "scene-card", id: "primitives-scenecard--all-variants" },
  { name: "scene-card-interactive", id: "primitives-scenecard--interactive" },
  { name: "scene-card-accent-win", id: "primitives-scenecard--with-accent-win" },
  { name: "scene-card-accent-loss", id: "primitives-scenecard--with-accent-loss" },
  { name: "scene-card-accent-warning", id: "primitives-scenecard--with-accent-warning" },
  { name: "scene-card-background", id: "primitives-scenecard--with-background" },
  { name: "scene-card-background-veil", id: "primitives-scenecard--with-background-veil" },
  { name: "scene-card-background-none", id: "primitives-scenecard--with-background-no-overlay" },
  { name: "scene-card-background-focal", id: "primitives-scenecard--with-background-focal-shift" },
  { name: "scene-card-background-tall-hero", id: "primitives-scenecard--with-background-tall-hero" },
  { name: "pill", id: "primitives-pill--all-variants" },
  { name: "pill-states", id: "primitives-pill--interaction-states" },
  { name: "pill-shimmer", id: "primitives-pill--with-shimmer" },
  { name: "pill-tracked", id: "primitives-pill--tracked" },
  { name: "pill-faction-werewolves", id: "primitives-pill--faction-werewolves" },
  { name: "pill-faction-mafia", id: "primitives-pill--faction-mafia" },
  { name: "pill-focused-shimmer", id: "primitives-pill--focused-shimmer" },
  { name: "pill-disabled-faction", id: "primitives-pill--disabled-faction" },
  { name: "medallion", id: "primitives-medallion--all-variants" },
  { name: "toast", id: "primitives-toast--all-variants" },
  { name: "toast-states", id: "primitives-toast--interaction-states" },
  { name: "dialog", id: "primitives-dialog--all-variants" },
  { name: "dialog-states", id: "primitives-dialog--interaction-states" },
  { name: "sheet", id: "primitives-sheet--all-variants" },
  { name: "sheet-states", id: "primitives-sheet--interaction-states" },
  { name: "empty-state", id: "primitives-emptystate--all-variants" },
  { name: "paper-card-states", id: "primitives-papercard--interaction-states" },
  { name: "scene-card-states", id: "primitives-scenecard--interaction-states" },
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
        const accessibility = await new AxeBuilder({ page }).include("#storybook-root").analyze();
        expect(accessibility.violations).toEqual([]);
        await expect(page).toHaveScreenshot(`${viewport.name}-${theme}-${story.name}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.01,
          timeout: 15_000,
        });
      });
    }
  }
}
