import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const baseUrl = process.env.PRESENTATION_BASE_URL;
const artifactDir = process.env.PRESENTATION_ARTIFACT_DIR;
let browser: Awaited<ReturnType<typeof chromium.launch>>;

// Opt in against an existing server; the normal unit suite needs no server.
describe.skipIf(!baseUrl)("live roles and rules presentation", () => {
  beforeAll(async () => {
    if (artifactDir) await mkdir(artifactDir, { recursive: true });
    browser = await chromium.launch({ headless: true });
  });
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
          const lifecycle = observeDocument(page);
          if (artifactDir) await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
          let failed = false;
          page.on("pageerror", (error) => errors.push(error.message));
          try {
            await page.goto(`${baseUrl}/${family}/roles`);
            await page.locator(".role-codex-card-button").first().waitFor();
            await page.waitForFunction(() => document.querySelector<HTMLInputElement>(".role-search-input")?.disabled === false);
            const geometry = await page.waitForFunction(() => {
              if (document.fonts.status !== "loaded") return null;
              const hero = document.querySelector<HTMLElement>(".role-codex-hero");
              const grid = document.querySelector<HTMLElement>(".role-codex-grid");
              if (!hero?.checkVisibility() || !grid?.checkVisibility()) return null;
              return { hero: hero.getBoundingClientRect().toJSON(), grid: grid.getBoundingClientRect().toJSON() };
            });
            const bounds = await geometry.jsonValue();
            await geometry.dispose();
            if (!bounds) throw new Error("Visible catalog geometry was not available");
            const { hero, grid } = bounds;
            expect(new URL(page.url()).pathname).toBe(`/${family}/roles`);
            if (width === 390) {
              expect(hero.height).toBeLessThan(340);
              expect(grid.y).toBeLessThan(760);
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
            const dialog = page.getByRole("dialog");
            await dialog.waitFor({ state: "visible" });
            const detailImage = page.locator(".role-codex-detail img");
            await detailImage.waitFor({ state: "visible" });
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
            await dialog.waitFor({ state: "hidden" });
            expect(await page.getByRole("dialog").count()).toBe(0);

            await page.goto(`${baseUrl}/${family}/rules`);
            expect(await page.locator("main h1").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeLessThanOrEqual(48);
            await page.locator(".phase-node").nth(1).click();
            await expect.poll(() => page.locator(".phase-node").nth(1).getAttribute("aria-pressed")).toBe("true");
            expect(await page.locator(".phase-detail-panel__lead h3").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeLessThanOrEqual(32);
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            expect(errors).toEqual([]);
          } catch (error) {
            failed = true;
            console.error(`Catalog lifecycle ${family}/${theme}/${width}: ${JSON.stringify(lifecycle)}`);
            throw error;
          } finally {
            if (artifactDir) {
              await context.tracing.stop(failed ? { path: join(artifactDir, `${family}-${theme}-${width}.zip`) } : undefined);
            }
            await context.close();
          }
        }
      }, 60_000);
    }
  }
});

function observeDocument(page: Page) {
  const events: Array<{ event: string; path?: string; message?: string }> = [];
  const record = (entry: (typeof events)[number]) => {
    events.push(entry);
    if (events.length > 30) events.shift();
  };
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      record({ event: "document-request", path: new URL(request.url()).pathname });
    }
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) record({ event: "navigation", path: new URL(frame.url()).pathname });
  });
  page.on("console", (message) => {
    if (/\[Fast Refresh\]|\[HMR\]/.test(message.text())) record({ event: "dev-runtime", message: message.text() });
  });
  page.on("crash", () => record({ event: "page-crash" }));
  return events;
}
