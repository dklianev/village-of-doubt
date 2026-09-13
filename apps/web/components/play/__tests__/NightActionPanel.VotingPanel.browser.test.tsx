import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const baseUrl = process.env.ACTION_PANEL_BASE_URL;
let browser: Awaited<ReturnType<typeof chromium.launch>>;

describe.skipIf(!baseUrl)("action panel feedback and long names", () => {
  beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
  afterAll(async () => { await browser?.close(); }, 30_000);

  for (const width of [320, 390, 1440]) {
    for (const theme of ["dark", "light"]) {
      for (const family of ["mafia", "werewolves"]) {
        for (const phase of ["night", "voting"]) {
          it(`${family} ${phase} ${theme} ${width}`, async () => {
            const context = await browser.newContext({
              viewport: { width, height: width < 1024 ? 844 : 1000 },
              reducedMotion: "reduce",
            });
            try {
              await context.addInitScript((theme) => {
                localStorage.setItem("werewolf-theme", theme);
                localStorage.setItem("cookie-consent", "1");
                localStorage.setItem("welcome-modal-shown", "1");
              }, theme);
              const page = await context.newPage();
              const errors: string[] = [];
              page.on("pageerror", (error) => errors.push(error.message));
              page.on("console", (message) => {
                if (message.type() === "error") errors.push(message.text());
              });
              const params = new URLSearchParams({
                visualGame: "1", family, phase, players: "9",
                role: family === "mafia" ? "commissioner" : "seer",
                mode: family === "mafia" ? "mafia_free" : "werewolves_classic",
              });
              await page.goto(`${baseUrl}/play/VISUAL?${params}`);
              await page.locator('.play-stage[data-layout-ready="true"]').waitFor();
              expect(await page.title()).toContain("Сенките");
              const dock = page.locator(".play-action-dock");
              if (width < 1024) await dock.getByRole("button", { name: "Покажи личния ход" }).click();
              await page.locator('.play-seat-slot[data-targetable="true"] button[data-seat-token]').first().click();

              const skipName = phase === "night" ? "Пропусни" : "Пропусни глас";
              const confirmSkip = phase === "night" ? "Потвърди пропуска" : "Потвърди пропускането";
              const actionName = phase === "voting" ? /^Потвърди гласа за / : family === "mafia"
                ? "Провери дали е от Мафията" : "Провери заплахата";
              await dock.getByRole("button", { name: skipName, exact: true }).click();
              expect(await dock.getByRole("button", { name: confirmSkip }).getAttribute("aria-pressed")).toBe("true");
              await dock.getByRole("button", { name: actionName }).click();
              expect(await dock.getByRole("button", { name: skipName, exact: true }).getAttribute("aria-pressed")).toBe("false");
              expect(await page.locator(".play-action-receipt").count()).toBe(0);
              await dock.getByRole("button", { name: skipName, exact: true }).click();
              expect(await dock.getByRole("button", { name: confirmSkip }).getAttribute("aria-pressed")).toBe("true");

              // Stress only presentation; the fixture has no server and the name is synthetic.
              await dock.locator(".play-selected-target strong").evaluate((name) => {
                name.textContent = "АлександраКонстантинополскаАнтон";
              });
              const geometry = await dock.locator(".play-selected-target strong, .play-action-buttons button").evaluateAll((elements) => elements.map((element) => {
                const range = document.createRange();
                range.selectNodeContents(element);
                const text = range.getBoundingClientRect();
                const container = (element.tagName === "STRONG" ? element.parentElement! : element).getBoundingClientRect();
                return {
                  text: element.textContent,
                  fits: text.left >= container.left - 1 && text.right <= container.right + 1
                    && text.top >= container.top - 1 && text.bottom <= container.bottom + 1,
                };
              }));
              expect(geometry.every((item) => item.fits), JSON.stringify(geometry)).toBe(true);
              expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
              expect(errors).toEqual([]);
              if (width === 320) {
                await page.screenshot({ path: join(tmpdir(), `action-panel-${family}-${phase}-${theme}-${width}.png`) });
              }
            } finally {
              await context.close();
            }
          }, 60_000);
        }
      }
    }
  }
});
