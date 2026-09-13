import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ROLE_DEFINITIONS } from "@werewolf/shared";

const baseUrl = process.env.ROLE_DEEP_LINK_BASE_URL;
let browser: Awaited<ReturnType<typeof chromium.launch>>;

// Opt in against an existing server, as in GameCatalog.presentation.test.tsx.
describe.skipIf(!baseUrl)("live role catalogue deep links", () => {
  beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
  afterAll(async () => { await browser?.close(); }, 30_000);

  for (const [family, role, foreignRole] of [
    ["werewolf", "seer", "commissioner"],
    ["mafia", "commissioner", "seer"],
  ] as const) {
    for (const width of [390, 1440]) {
      it(`${family} deep links retain focus and history at ${width}px`, async () => {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        await context.addInitScript(() => {
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("welcome-modal-shown", "1");
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const path = `/${family}/roles`;
        try {
          await page.goto(`${baseUrl}${path}?source=home&role=${role}#catalogue`);
          const dialog = page.getByRole("dialog", { name: ROLE_DEFINITIONS[role].nameBg });
          await dialog.waitFor({ state: "visible" });
          expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
          await page.keyboard.press("Shift+Tab");
          await page.keyboard.press("Tab");
          expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
          await page.screenshot({ path: join(tmpdir(), `role-deep-link-${family}-${width}.png`) });
          const historyLength = await page.evaluate(() => history.length);
          await dialog.locator(".role-codex-detail-close").click();
          await dialog.waitFor({ state: "hidden" });
          expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash)
            .toBe(`${path}?source=home#catalogue`);
          expect(await page.evaluate(() => history.length)).toBe(historyLength);
          expect(await page.locator(`.role-${role} button`).evaluate((node) => node === document.activeElement)).toBe(true);

          // Exercise Next's native-history integration and the URL subscription.
          await page.evaluate((code) => history.pushState(null, "", `?role=${code}`), role);
          await dialog.waitFor({ state: "visible" });
          await page.goBack();
          await dialog.waitFor({ state: "hidden" });
          await page.goForward();
          await dialog.waitFor({ state: "visible" });
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
          await page.reload();
          await page.locator(".role-codex-card-button").first().waitFor({ state: "visible" });
          expect(await page.getByRole("dialog").count()).toBe(0);

          for (const query of [`role=${foreignRole}`, `role=${role}&role=${role}`, "role=__proto__"]) {
            await page.evaluate((search) => history.replaceState(null, "", `?${search}`), query);
            await page.locator(`.role-${role} button`).click();
            await dialog.waitFor({ state: "visible" });
            await page.keyboard.press("Escape");
            await dialog.waitFor({ state: "hidden" });
          }
          expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
          expect(errors).toEqual([]);
        } finally {
          await context.close();
        }
      }, 60_000);
    }
  }
});
