import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

const start = new Date("2026-09-27T20:00:00.000Z");

async function openClock(page: Page, family: string, theme: string, width: number, height: number, timer = "90", players = 8) {
  await page.setViewportSize({ width, height });
  await page.clock.setFixedTime(start);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(theme => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
  await page.route("**/api/auth/get-session**", route => route.fulfill({ json: null }));
  await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=voting&players=${players}&voteTally=full&timer=${timer}`);
  await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return page.locator('.play-stage [role="timer"]');
}

for (const family of ["werewolves", "mafia"]) {
  for (const theme of ["dark", "light"]) {
    for (const [width, height, players] of [
      [1487, 1058, 8], [1366, 768, 8], [1024, 768, 8], [768, 1024, 8], [390, 844, 8], [320, 568, 8], [844, 390, 8],
      [1366, 1000, 8], [1487, 1058, 12], [1366, 768, 12], [1024, 768, 30], [320, 568, 30],
    ]) {
      test(`chronometer fits the table ${family} ${theme} ${width}x${height} ${players} players`, async ({ page }, info) => {
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        const timer = await openClock(page, family, theme, width!, height!, "90", players);
        await page.clock.setFixedTime(new Date(start.getTime() + 48_000));
        await expect(timer).toHaveAccessibleName("Оставащо време 00:42");
        const art = await timer.locator("img").evaluate(async image => {
          if (!(image instanceof HTMLImageElement)) throw new Error("Missing chronometer image element");
          await image.decode();
          return { width: image.naturalWidth, height: image.naturalHeight, rendered: image.clientWidth };
        });
        expect(art.width).toBeGreaterThanOrEqual(art.rendered);
        expect(art.width).toBe(art.height);
        const bounds = (await timer.boundingBox())!;
        await page.screenshot({ path: info.outputPath("chronometer.png") });
        expect(bounds.width).toBeCloseTo(bounds.height, 1);
        for (const seat of await page.locator(".play-seat-slot").all()) {
          const box = (await seat.boundingBox())!;
          const overlap = Math.max(0, Math.min(bounds.x + bounds.width, box.x + box.width) - Math.max(bounds.x, box.x))
            * Math.max(0, Math.min(bounds.y + bounds.height, box.y + box.height) - Math.max(bounds.y, box.y));
          expect(overlap, `The clock must never cover a player or their name: ${JSON.stringify({ bounds, box })}`).toBeLessThanOrEqual(4);
        }
        expect(await timer.locator("strong").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        expect(errors).toEqual([]);
      });
    }
  }
}

for (const state of ["none", "8", "0"]) {
  for (const theme of ["dark", "light"]) {
    test(`chronometer state ${state} ${theme} stays readable`, async ({ page }) => {
      const timer = await openClock(page, "werewolves", theme, 390, 844, state);
      await expect(timer).toHaveAttribute("data-state", state === "none" ? "unlimited" : state === "0" ? "finished" : "urgent");
      for (const text of await timer.locator("strong, .timer-dial-label").all()) {
        expect(await text.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      }
      expect(await timer.locator("strong").evaluate(element => getComputedStyle(element).animationName)).toBe("none");
      const result = await new AxeBuilder({ page }).include('[data-table-core]').withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(result.violations).toEqual([]);
      await page.getByRole("button", { name: "Към разговора" }).click();
      await expect(page.locator('.play-conversation-context [role="timer"]')).toHaveAttribute("data-presentation", "plain");
      await expect(page.locator('.play-conversation-context [role="timer"] svg')).toHaveCount(0);
    });
  }
}

test("chronometer catches deadline changes without resetting its reading", async ({ page }) => {
  const timer = await openClock(page, "werewolves", "dark", 1487, 1058);
  await page.clock.setFixedTime(new Date(start.getTime() + 48_000));
  await expect(timer).toHaveAccessibleName("Оставащо време 00:42");
  await expect(timer.locator("mask path")).toHaveAttribute("stroke-dasharray", "42 60");
  await page.clock.setFixedTime(new Date(start.getTime() + 82_000));
  await expect(timer).toHaveAttribute("data-state", "urgent");
  await expect(timer.locator("mask path")).toHaveAttribute("stroke-dasharray", "8 60");
  await page.clock.setFixedTime(new Date(start.getTime() + 91_000));
  await expect(timer).toHaveAccessibleName("Времето изтече");
  await expect(timer.locator("mask path")).toHaveAttribute("stroke-dasharray", "0 60");
});

for (const theme of ["dark", "light"]) {
  test(`chronometer preserves keyboard selection with enlarged text ${theme}`, async ({ page }) => {
    const timer = await openClock(page, "werewolves", theme, 320, 568);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(await timer.locator("strong").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    const seat = page.locator('.play-stage button[aria-label^="Избери "]:enabled').first();
    await seat.focus();
    await expect(seat).toBeFocused();
    await seat.press("Enter");
    await expect(page.locator('.play-seat-slot[data-selected="true"]')).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Потвърди гласа за / })).toBeEnabled();
  });
}
