import { expect, test, type Page } from "playwright/test";

type Family = "werewolves" | "mafia";
type WaitingRoomWindow = Window & { waitingRoomCopies?: string[] };

async function openWaitingRoom(page: Page, family: Family, theme: "light" | "dark", viewer = "host", allReady = false) {
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
    const copies: string[] = [];
    (window as WaitingRoomWindow).waitingRoomCopies = copies;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value: string) => { copies.push(value); } },
    });
  }, theme);
  const response = await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=lobby&players=12&viewer=${viewer}${allReady ? "&lobbyReady=all" : ""}`);
  await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
  await expect(page.locator(".play-waiting-band")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return response;
}

for (const family of ["werewolves", "mafia"] as const) {
  test(`waiting room all-ready fixture hydrates consistently after fresh load and reload ${family}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await openWaitingRoom(page, family, "light", "host", true);
    expect(response?.ok()).toBe(true);
    expect(await response!.text()).toContain('aria-label="Готови: 12 от 12"');
    const count = page.locator(".play-waiting-readiness");
    await expect(count).toHaveAttribute("aria-label", "Готови: 12 от 12");
    await expect(count).toContainText("Всички са на масата.");
    await expect(page.locator('[data-lobby-seat-status][data-state="ready"]')).toHaveCount(12);
    expect(errors.filter((error) => /hydration|hydrated|server rendered|didn.t match|Minified React error/i.test(error))).toEqual([]);

    const reload = await page.reload();
    expect(reload?.ok()).toBe(true);
    expect(await reload!.text()).toContain('aria-label="Готови: 12 от 12"');
    await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
    await expect(count).toHaveAttribute("aria-label", "Готови: 12 от 12");
    await expect(count).toContainText("Всички са на масата.");
    expect(errors.filter((error) => /hydration|hydrated|server rendered|didn.t match|Minified React error/i.test(error))).toEqual([]);
  });

  for (const theme of ["light", "dark"] as const) {
    for (const viewport of [{ width: 390, height: 740 }, { width: 1440, height: 900 }]) {
      test(`waiting room controls and tools ${family} ${theme} ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await openWaitingRoom(page, family, theme);
        const stage = page.locator(".play-stage");
        const band = page.locator(".play-waiting-band");
        const invite = stage.locator(".play-waiting-invite");
        await expect(invite).toContainText("VISUAL");
        await expect(stage.locator("[data-table-core]")).toBeHidden();
        await expect(page.locator(".play-interaction-column, .play-mobile-navigation")).toHaveCount(0);
        await expect(page.locator(".play-personal-area, [data-private-dossier]")).toHaveCount(0);
        await expect(page.getByTestId("ready-toggle")).toHaveCount(1);
        await expect(band.getByRole("status", { name: /Готови:/ })).toBeVisible();
        await expect(band.getByRole("button", { name: "Започни игра", exact: true })).toBeEnabled();
        await expect(stage.locator("[data-lobby-seat-status][data-state='waiting']").first()).toBeVisible();

        await invite.getByRole("button", { name: "Копирай кода на стаята", exact: true }).click();
        await invite.getByRole("button", { name: "Копирай покана", exact: true }).click();
        expect(await page.evaluate(() => (window as WaitingRoomWindow).waitingRoomCopies)).toEqual([
          "VISUAL", new URL("/lobby/VISUAL", page.url()).href,
        ]);

        const rules = band.getByRole("button", { name: "Правила", exact: true });
        await rules.scrollIntoViewIfNeeded();
        await expect(rules).toBeInViewport({ ratio: 1 });
        await rules.click();
        const reference = page.getByRole("dialog", { name: "Правила на масата" });
        await expect(reference).toBeVisible();
        await reference.getByRole("tab", { name: "Състав", exact: true }).click();
        await expect(reference.getByRole("tabpanel")).toContainText("Роли в стаята");
        await page.keyboard.press("Escape");
        await expect(reference).toBeHidden();
        await expect(rules).toBeFocused();

        const signals = band.getByRole("button", { name: /Сигнали/ });
        await signals.click();
        const cues = page.getByRole("dialog", { name: "Сигнали за фазите" });
        await expect(cues).toBeVisible();
        await cues.getByRole("radio", { name: "Тихо", exact: true }).check();
        await expect(cues.getByRole("button", { name: "Пробвай" })).toBeDisabled();
        await page.keyboard.press("Escape");
        await expect(signals).toBeFocused();
        await expect(signals).toContainText("Тихо");
        expect(await page.evaluate(() => localStorage.getItem("werewolf-cue-mode"))).toBe("silent");

        for (const control of [band.getByTestId("ready-toggle"), band.getByRole("button", { name: "Започни игра", exact: true }), band.getByRole("link", { name: "Напусни масата" })]) {
          await control.scrollIntoViewIfNeeded();
          await expect(control).toBeInViewport({ ratio: 1 });
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      });
    }
  }

  test(`waiting room observer cannot ready or start ${family}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 740 });
    await openWaitingRoom(page, family, "light", "spectator");
    await expect(page.getByTestId("ready-toggle")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Започни игра", exact: true })).toHaveCount(0);
    const band = page.locator(".play-waiting-band");
    await expect(band.getByRole("button", { name: "Правила", exact: true })).toBeVisible();
    await expect(band.getByRole("link", { name: "Напусни масата" })).toHaveAttribute("href", family === "mafia" ? "/mafia" : "/werewolf");
  });

  test(`waiting room leave cancels without unmounting then follows the family link ${family}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWaitingRoom(page, family, "dark");
    const originalUrl = page.url();
    const stage = await page.locator(".play-stage").elementHandle();
    const leave = page.getByRole("link", { name: "Напусни масата" });
    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      expect(dialog.message()).toContain("домакин");
      await dialog.dismiss();
    });
    await leave.click();
    await expect(page).toHaveURL(originalUrl);
    expect(await stage!.evaluate((element) => element.isConnected)).toBe(true);
    await expect(page.getByTestId("ready-toggle")).toBeVisible();

    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.accept();
    });
    await leave.click();
    await expect(page).toHaveURL(family === "mafia" ? "/mafia" : "/werewolf");
    // Cache Components can retain the previous route's DOM in a hidden Activity.
    await expect(page.locator(".play-waiting-band")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: family === "mafia" ? "Мафия" : "Върколак", exact: true })).toBeVisible();
  });
}

test("waiting room clipboard rejection preserves the public room code and controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await openWaitingRoom(page, "werewolves", "light");
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => { throw new Error("Synthetic clipboard rejection"); };
  });
  await page.getByRole("button", { name: "Копирай покана", exact: true }).click();
  await expect(page.getByText("Не успяхме да копираме поканата. Кодът на стаята е VISUAL.")).toBeVisible();
  await expect(page.locator(".play-waiting-invite")).toContainText("VISUAL");
  await expect(page.getByTestId("ready-toggle")).toBeEnabled();
});
