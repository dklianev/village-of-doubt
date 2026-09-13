import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const baseUrl = process.env.PLAY_LOBBY_BASE_URL;
let browser: Awaited<ReturnType<typeof chromium.launch>>;

describe.skipIf(!baseUrl)("lobby readiness layout", () => {
  beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
  afterAll(async () => { await browser?.close(); }, 30_000);

  for (const width of [320, 820, 1440]) {
    for (const theme of ["dark", "light"]) {
      for (const family of ["mafia", "werewolves"]) {
        for (const viewer of ["host", "alive"]) {
          it(`${family} ${viewer} ${theme} ${width}`, async () => {
            const context = await browser.newContext({ viewport: { width, height: 844 } });
            try {
              await context.addInitScript((theme) => {
                localStorage.setItem("werewolf-theme", theme);
                localStorage.setItem("cookie-consent", "1");
                localStorage.setItem("welcome-modal-shown", "1");
              }, theme);
              const page = await context.newPage();
              const errors: string[] = [];
              page.on("pageerror", (error) => errors.push(error.message));
              await page.goto(`${baseUrl}/play/VISUAL?${new URLSearchParams({
                visualGame: "1", phase: "lobby", family, viewer, players: "6",
              })}`);
              await page.locator('.play-stage[data-layout-ready="true"]').waitFor();
              const ready = page.getByTestId("ready-toggle");
              await ready.waitFor();
              expect(await ready.count()).toBe(1);
              expect(await page.locator(".narrator-desk").count()).toBe(0);
              expect(await page.locator(".play-stage").innerText()).not.toMatch(/РУНД 0|ЖИВИ|Свободен ход/);
              expect(await page.locator(".play-stage [data-seat-user-id]").count()).toBe(6);
              if (width < 1024) {
                const button = await ready.boundingBox();
                expect(button).not.toBeNull();
                expect(button!.height).toBeGreaterThanOrEqual(44);
                expect(button!.y).toBeGreaterThanOrEqual(0);
                expect(button!.y + button!.height).toBeLessThanOrEqual(844);
                expect(await page.locator(".play-action-dock").getAttribute("data-expanded")).toBe("false");
                await page.getByRole("button", { name: "Покажи подробностите за стаята" }).click();
                await page.getByRole("button", { name: "Копирай покана" }).waitFor();
                expect(await ready.count()).toBe(1);
                await page.getByRole("button", { name: "Скрий подробностите за стаята" }).click();
                expect(await ready.isVisible()).toBe(true);
              }
              expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
              expect(errors).toEqual([]);
              if (viewer === "host" && width !== 820) {
                await page.screenshot({ path: join(tmpdir(), `play-lobby-${family}-${theme}-${width}.png`), caret: "initial" });
              }
            } finally {
              await context.close();
            }
          }, 30_000);
        }
      }
    }
  }
});
