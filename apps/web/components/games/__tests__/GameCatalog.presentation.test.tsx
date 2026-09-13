import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const baseUrl = process.env.PRESENTATION_BASE_URL;
let browser: Awaited<ReturnType<typeof chromium.launch>>;

// Opt in against an existing dev server; the normal unit suite needs no server.
describe.skipIf(!baseUrl)("live roles and rules presentation", () => {
  beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
  afterAll(async () => { await browser?.close(); }, 30_000);

  for (const family of ["werewolf", "mafia"]) {
    for (const theme of ["light", "dark"] as const) {
      it(`${family} stays compact and interactive in ${theme}`, async () => {
        for (const width of [390, 1440]) {
          const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, colorScheme: theme });
          await context.addInitScript((selectedTheme) => {
            localStorage.setItem("cookie-consent", "1");
            localStorage.setItem("welcome-modal-shown", "1");
            localStorage.setItem("werewolf-theme", selectedTheme);
          }, theme);
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          try {
            await page.goto(`${baseUrl}/${family}/roles`);
            await page.evaluate(() => document.fonts.ready);
            const hero = await page.locator(".role-codex-hero").boundingBox();
            const grid = await page.locator(".role-codex-grid").boundingBox();
            if (width === 390) {
              expect(hero!.height).toBeLessThan(340);
              expect(grid!.y).toBeLessThan(760);
            }
            const firstImage = page.locator(".role-codex-card img").first();
            await firstImage.scrollIntoViewIfNeeded();
            await firstImage.evaluate((node) => (node as HTMLImageElement).decode());
            const gridPixels = await firstImage.evaluate(async (node) => {
              const image = node as HTMLImageElement;
              const bitmap = await createImageBitmap(await (await fetch(image.currentSrc)).blob());
              const result = { pixels: bitmap.width, css: image.getBoundingClientRect().width };
              bitmap.close();
              return result;
            });
            expect(gridPixels.pixels).toBeGreaterThanOrEqual(Math.floor(gridPixels.css));
            expect(gridPixels.pixels).toBeLessThanOrEqual(Math.ceil(gridPixels.css * 1.55));
            expect(await page.locator(".role-codex-tags span").first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12);
            await page.locator(".role-codex-card-button").first().click();
            const detailImage = page.locator(".role-codex-detail img");
            await detailImage.evaluate((node) => (node as HTMLImageElement).decode());
            expect(await detailImage.getAttribute("sizes")).not.toBe(await firstImage.getAttribute("sizes"));
            const detailPixels = await detailImage.evaluate(async (node) => {
              const image = node as HTMLImageElement;
              const bitmap = await createImageBitmap(await (await fetch(image.currentSrc)).blob());
              const result = { pixels: bitmap.width, css: image.getBoundingClientRect().width };
              bitmap.close();
              return result;
            });
            expect(detailPixels.pixels).toBeGreaterThanOrEqual(Math.floor(detailPixels.css));
            expect(detailPixels.pixels).toBeLessThanOrEqual(Math.ceil(detailPixels.css * 1.55));
            await page.keyboard.press("Escape");
            expect(await page.getByRole("dialog").count()).toBe(0);

            await page.goto(`${baseUrl}/${family}/rules`);
            expect(await page.locator("main h1").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeLessThanOrEqual(48);
            await page.locator(".phase-node").nth(1).click();
            expect(await page.locator(".phase-node").nth(1).getAttribute("aria-pressed")).toBe("true");
            expect(await page.locator(".phase-detail-panel__lead h3").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeLessThanOrEqual(32);
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            expect(errors).toEqual([]);
          } finally {
            await context.close();
          }
        }
      }, 60_000);
    }
  }
});
