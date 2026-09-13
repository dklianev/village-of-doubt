import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ROLE_DEFINITIONS } from "@werewolf/shared";

const baseUrl = process.env.ROLE_DOSSIER_BASE_URL;
let browser: Awaited<ReturnType<typeof chromium.launch>>;

describe.skipIf(!baseUrl)("live local role dossiers", () => {
  beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
  afterAll(async () => { await browser?.close(); }, 30_000);

  for (const [path, family, role] of [
    ["werewolf", "werewolves", "seer"],
    ["mafia", "mafia", "commissioner"],
  ] as const) {
    for (const width of [320, 390, 1440]) {
      for (const theme of ["dark", "light"]) {
        it(`${family} ${theme} dossier is self-contained at ${width}px`, async () => {
          const context = await browser.newContext({ viewport: { width, height: 900 } });
          await context.addInitScript((selectedTheme) => {
            localStorage.setItem("cookie-consent", "1");
            localStorage.setItem("welcome-modal-shown", "1");
            localStorage.setItem("werewolf-theme", selectedTheme);
          }, theme);
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          try {
            await page.goto(`${baseUrl}/${path}`);
            await page.waitForFunction((selectedTheme) => document.documentElement.dataset.theme === selectedTheme, theme);
            const trigger = page.locator(`.role-spotlight__link[data-role="${role}"]`);
            await trigger.scrollIntoViewIfNeeded();
            await trigger.focus();
            const before = await page.evaluate(() => ({ scroll: scrollY, history: history.length, url: location.href }));
            const ink = await page.locator("main").evaluate((node) => getComputedStyle(node).getPropertyValue("--ink").trim());
            await trigger.click();
            const dialog = page.getByRole("dialog", { name: ROLE_DEFINITIONS[role].nameBg });
            await dialog.waitFor({ state: "visible" });
            expect(await dialog.evaluate((node) => node.parentElement === document.body && !node.closest("[inert]"))).toBe(true);
            expect(await dialog.getAttribute("data-family")).toBe(family);
            expect(await dialog.evaluate((node) => getComputedStyle(node).getPropertyValue("--ink").trim())).toBe(ink);
            expect(await page.locator("main").evaluate((node) => !!node.closest("[inert]"))).toBe(true);
            expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);

            const heading = dialog.getByRole("heading", { level: 2 });
            expect(await heading.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeLessThanOrEqual(width < 760 ? 28 : 40);
            expect(await heading.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
            const close = dialog.locator(".role-codex-detail-close");
            expect(await close.locator("svg").count()).toBe(1);
            const bounds = (await close.boundingBox())!;
            expect(Math.min(bounds.width, bounds.height)).toBeGreaterThanOrEqual(44);
            const art = dialog.locator(".role-codex-frame img");
            await art.evaluate((node) => (node as HTMLImageElement).decode());
            expect(await art.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
            expect(await art.evaluate((node) => getComputedStyle(node).filter)).toBe("none");
            const frame = dialog.locator(".role-art-frame");
            expect(await frame.getAttribute("data-frame-family")).toBe(family);
            expect(await frame.evaluate((node) => getComputedStyle(node, "::after").backgroundImage)).toContain(`/frames/frame-${family}-v1.webp`);
            expect(await frame.evaluate((node) => getComputedStyle(node, "::after").pointerEvents)).toBe("none");
            const portrait = (await art.boundingBox())!;
            expect(portrait.width / portrait.height).toBeCloseTo(2 / 3, 2);
            expect(await dialog.locator(".role-codex-detail-panel").evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
            const definition = ROLE_DEFINITIONS[role];
            for (const [label, value] of [
              ["Нощен ред", String(definition.nightOrder ?? "Без нощен ред")],
              ["Играчи", `${definition.minPlayers}+`],
              ["Копия", definition.maxCopies === 1 ? "1 копие" : `До ${definition.maxCopies} копия`],
            ] as const) {
              const fact = dialog.locator("dl > div").filter({ has: page.locator("dt", { hasText: label }) });
              expect(await fact.locator("dd").innerText()).toBe(value);
              expect(await fact.isVisible()).toBe(true);
            }
            await dialog.locator(".role-codex-detail-panel").evaluate((node) => { node.scrollTop = node.scrollHeight; });
            const pinnedClose = (await close.boundingBox())!;
            expect(pinnedClose.y).toBeGreaterThanOrEqual(0);
            expect(pinnedClose.y + pinnedClose.height).toBeLessThanOrEqual(900);
            await dialog.locator(".role-codex-detail-panel").evaluate((node) => { node.scrollTop = 0; });
            await page.screenshot({ path: join(tmpdir(), `role-dossier-${path}-${width}-${theme}.png`) });
            await page.keyboard.press("Escape");
            await dialog.waitFor({ state: "hidden" });
            expect(await trigger.evaluate((node) => node === document.activeElement)).toBe(true);
            expect(await page.evaluate(() => ({ scroll: scrollY, history: history.length, url: location.href }))).toEqual(before);
            expect(await page.locator("main").evaluate((node) => !!node.closest("[inert]"))).toBe(false);
            expect(errors).toEqual([]);
          } finally {
            await context.close();
          }
        }, 60_000);
      }
    }
  }
});
