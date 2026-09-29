import { expect, test } from "playwright/test";

test.use({ serviceWorkers: "block" });

const connections = ["lost", "error", "reconnecting"] as const;
const viewports = [
  { name: "desktop", width: 1440, height: 900, theme: "dark" },
  { name: "mobile", width: 390, height: 844, theme: "light" },
] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  });
});

for (const family of ["werewolves", "mafia"] as const) {
  for (const viewport of viewports) {
    for (const connection of connections) {
      test(`completed ${family} game stays navigable when ${connection} on ${viewport.name}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.emulateMedia({ colorScheme: viewport.theme, reducedMotion: "reduce" });
        await page.addInitScript((theme) => localStorage.setItem("werewolf-theme", theme), viewport.theme);
        const query = new URLSearchParams({
          visualGame: "1", phase: "game_over", family, winner: family, connection,
        });
        const response = await page.goto(`/play/VISUAL?${query}`, { waitUntil: "domcontentloaded" });
        expect(response?.ok()).toBe(true);
        await expect(page).toHaveURL(new RegExp(`/play/VISUAL\\?${query}$`));
        await expect(page.locator("html")).toHaveAttribute("data-theme", viewport.theme);
        const finale = page.locator("[data-endgame]");
        await expect(finale).toBeVisible();
        await expect(finale).toHaveAttribute("data-family", family);
        await expect(finale).toHaveAttribute("data-endgame", family);
        await expect(page.locator(`.connection-${connection}`)).toBeVisible();
        await expect(page.locator("#conclusion-heading")).toBeFocused();
        // Reconnecting mounts its blocking dialog only after three seconds.
        await page.waitForTimeout(3_500);
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.locator("dialog[open]")).toHaveCount(0);
        await expect(page.getByText("Runtime Error", { exact: true })).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: testInfo.outputPath("finale-recovery.png"), fullPage: false });

        const links = finale.getByRole("link");
        await expect(links).toHaveCount(3);
        for (const link of await links.all()) {
          await page.keyboard.press("Tab");
          await expect(link).toBeFocused();
          await expect(link).toBeInViewport();
          expect(await link.evaluate((element) => element.closest("[inert]") === null)).toBe(true);
        }
        // Exercise each finale destination across the three connection states.
        const destination = links.nth(connections.indexOf(connection));
        const href = await destination.getAttribute("href");
        expect(href).toBeTruthy();
        const expectedUrl = new URL(href!, page.url()).href;
        expect(errors, "Finale console and runtime errors").toEqual([]);
        await destination.click();
        await expect(page).toHaveURL(expectedUrl);
      });
    }
  }

  for (const connection of connections) {
    test(`active ${family} game keeps blocking recovery when ${connection}`, async ({ page }) => {
      await page.goto(`/play/VISUAL?visualGame=1&phase=voting&family=${family}&connection=${connection}`);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await expect(page.locator(".play-shell-inner")).toHaveAttribute("inert", "");
      await expect(page.locator("[data-endgame]")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      const retry = dialog.getByRole("button").first();
      if (connection === "reconnecting") {
        await expect(retry).toBeDisabled();
      } else {
        const message = dialog.locator("p").first();
        const before = await message.innerText();
        await retry.click();
        await expect(message).not.toHaveText(before);
      }
    });
  }
}
