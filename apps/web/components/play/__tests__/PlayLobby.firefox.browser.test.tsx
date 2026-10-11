import { tmpdir } from "node:os";
import { join } from "node:path";
import { firefox } from "playwright";
import { expect as browserExpect } from "playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const baseUrl = process.env.PLAY_LOBBY_BASE_URL;
let browser: Awaited<ReturnType<typeof firefox.launch>>;

describe.skipIf(!baseUrl)("Firefox pregame hydration and public controls", () => {
  beforeAll(async () => { browser = await firefox.launch({ headless: true }); });
  afterAll(async () => { await browser?.close(); }, 30_000);

  for (const viewport of [{ width: 320, height: 568 }, { width: 1440, height: 900 }]) {
    for (const family of ["werewolves", "mafia"]) {
      for (const theme of ["dark", "light"]) {
        it(`${family} ${theme} ${viewport.width}: badges, host menus and reload`, async () => {
          const context = await browser.newContext({ viewport });
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
              if (message.type() === "error"
                || (message.type() === "warning" && /hydrat|server.render|did not match/i.test(message.text()))) {
                errors.push(message.text());
              }
            });
            // The real lobby beforeunload guard can fire after menu interaction.
            page.on("dialog", (dialog) => dialog.accept());
            await page.goto(`${baseUrl}/play/VISUAL?${new URLSearchParams({
              visualGame: "1", family, phase: "lobby", players: "8", viewer: "host",
            })}`);

            for (const reloaded of [false, true]) {
              if (reloaded) await page.reload();
              await page.locator('.play-stage[data-layout-ready="true"]').waitFor();
              await page.evaluate(() => document.fonts.ready);
              await browserExpect(page.locator("html")).toHaveAttribute("data-theme", theme);
              await browserExpect(page.getByRole("heading", { name: "Масата се събира" })).toBeVisible();
              await browserExpect(page.getByRole("status", { name: "Готови: 7 от 8" })).toHaveText("Готови7 / 8");
              await browserExpect(page.locator(".play-stage progress")).toHaveAttribute("value", "7");
              await browserExpect(page.locator(".play-stage progress")).toHaveAttribute("max", "8");
              await browserExpect(page.locator('[data-lobby-seat-status][data-state="ready"]')).toHaveCount(6);
              await browserExpect(page.locator('[data-lobby-seat-status][data-state="waiting"]')).toHaveText("Не е готов");
              await browserExpect(page.locator('[data-lobby-seat-status][data-state="disconnected"]')).toHaveText("Без връзка");
              await browserExpect(page.getByRole("group", { name: "Настройки на масата" })).toBeVisible();
              await browserExpect(page.getByTestId("ready-toggle")).toHaveCount(1);
              await browserExpect(page.getByTestId("ready-toggle")).toHaveAttribute("aria-pressed", "true");
              await browserExpect(page.getByRole("button", { name: "Започни игра", exact: true })).toBeEnabled();
              await browserExpect(page.locator("[data-private-dossier], .play-personal-area")).toHaveCount(0);

              const geometry = await page.evaluate(() => {
                const slots = [...document.querySelectorAll(".play-seat-slot")];
                return {
                  overflow: document.documentElement.scrollWidth > innerWidth,
                  lastSeatBottom: Math.max(...slots.map((seat) => seat.getBoundingClientRect().bottom)),
                  dockTop: document.querySelector(".play-action-dock")!.getBoundingClientRect().top,
                  collisions: slots.filter((seat) => {
                    const badge = seat.querySelector("[data-lobby-seat-status]")!.getBoundingClientRect();
                    const name = seat.querySelector("[data-seat-name]")!.getBoundingClientRect();
                    return Math.min(badge.right, name.right) > Math.max(badge.left, name.left)
                      && Math.min(badge.bottom, name.bottom) > Math.max(badge.top, name.top);
                  }).length,
                };
              });
              expect(geometry.overflow).toBe(false);
              expect(geometry.collisions).toBe(0);
              if (viewport.width === 320) {
                expect(geometry.lastSeatBottom).toBeLessThanOrEqual(geometry.dockTop - 4);
                await browserExpect(page.locator(".play-action-dock")).toHaveAttribute("data-expanded", "false");
                await browserExpect(page.locator('[data-lobby-seat-status] [aria-label="Домакин"]')).toBeHidden();
              } else {
                await browserExpect(page.getByRole("img", { name: "Домакин", exact: true })).toHaveCount(1);
              }

              const menus = page.locator("[data-seat-menu-trigger]");
              await browserExpect(menus).toHaveCount(family === "werewolves" ? 8 : 0);
              if (family === "werewolves") {
                for (const trigger of [menus.first(), menus.last()]) {
                  await trigger.click();
                  await browserExpect(trigger).toHaveAttribute("aria-expanded", "true");
                  await browserExpect(page.getByRole("button", { name: "Кмет", exact: true })).toBeVisible();
                  await page.keyboard.press("Escape");
                  await browserExpect(trigger).toHaveAttribute("aria-expanded", "false");
                  await browserExpect(trigger).toBeFocused();
                }
              }
              if (viewport.width === 320) {
                await page.getByRole("button", { name: "Покажи подробностите за стаята" }).click();
                await browserExpect(page.getByRole("button", { name: "Копирай покана" })).toBeVisible();
                await browserExpect(page.getByTestId("ready-toggle")).toHaveCount(1);
                await page.getByRole("button", { name: "Скрий подробностите за стаята" }).click();
              }
              expect(errors).toEqual([]);
            }
            await page.screenshot({
              path: join(tmpdir(), `play-lobby-firefox-${family}-${theme}-${viewport.width}.png`),
            });
          } finally {
            await context.close();
          }
        }, 45_000);
      }
    }
  }
});
