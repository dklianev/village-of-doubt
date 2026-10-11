import { expect, test } from "playwright/test";

for (const { family, width, theme } of [
  { family: "werewolf", width: 1440, theme: "dark" },
  { family: "mafia", width: 390, theme: "light" },
] as const) {
  test.describe(`deferred create ${family} ${width}`, () => {
    test.use({ viewport: { width, height: 900 }, colorScheme: theme, serviceWorkers: "block" });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((theme) => {
        localStorage.setItem("werewolf-theme", theme);
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("welcome-modal-shown", "1");
      }, theme);
    });

    test("a slow editor closes immediately and cannot reopen after its chunk resolves", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let chunks = 0;
      let release = () => {};
      const gate = new Promise<void>((resolve) => { release = resolve; });
      await page.route("**/_next/static/chunks/*.js", async (route) => {
        const response = await route.fetch();
        if ((await response.text()).includes("function CreateCustomizationContent(")) {
          chunks++;
          await gate;
        }
        await route.fulfill({ response });
      });
      try {
        await page.goto(`/${family}/create?visualAuth=1`);
        await expect(page.locator("[data-create-active]")).toBeVisible();
        expect(chunks, "The editor is not needed for quick Create").toBe(0);
        const trigger = page.getByRole("button", { name: "Настрой детайлите", exact: true });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Настрой детайлите", exact: true });
        await expect(dialog).toBeVisible();
        await expect.poll(() => chunks).toBeGreaterThan(0);
        await expect(dialog.getByRole("status")).toContainText("Зареждаме");
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
        release();
        await page.unrouteAll({ behavior: "wait" });
        await expect(dialog).toBeHidden();
        await trigger.click();
        await expect(dialog.getByRole("heading", { name: "Избери ролите", exact: true })).toBeVisible();
        await dialog.getByRole("tab", { name: "Име на стаята", exact: true }).click();
        await dialog.getByRole("textbox", { name: "Име на стаята", exact: true }).fill("Тестова вечер");
        await page.keyboard.press("Escape");
        await trigger.click();
        await expect(dialog.getByRole("textbox", { name: "Име на стаята", exact: true })).toHaveValue("Тестова вечер");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(errors).toEqual([]);
      } finally {
        release();
        await page.unrouteAll({ behavior: "wait" });
      }
    });

    test("a failed chunk can be retried without losing the current setup", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let blocked = 0;
      let fail = true;
      await page.route("**/_next/static/chunks/*.js", async (route) => {
        const response = await route.fetch();
        if (fail && (await response.text()).includes("function CreateCustomizationContent(")) {
          blocked++;
          await route.abort("failed");
        } else await route.fulfill({ response });
      });
      await page.goto(`/${family}/create?visualAuth=1`);
      await expect(page.locator("[data-create-active]")).toBeVisible();
      await page.getByRole("button", { name: "Увеличи броя играчи", exact: true }).click();
      const playerCount = await page.getByRole("slider", { name: "Брой играчи", exact: true }).inputValue();
      const original = await page.locator(".create-quick-surface").elementHandle();
      await page.getByRole("button", { name: "Настрой детайлите", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Настрой детайлите", exact: true });
      await expect.poll(() => blocked).toBeGreaterThan(0);
      await expect(dialog.getByRole("alert")).toContainText("не се заредиха");
      fail = false;
      await dialog.getByRole("button", { name: "Опитай отново", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: "Избери ролите", exact: true })).toBeVisible();
      await expect(dialog.locator(".create-customization-ledger")).toContainText(`${playerCount} играчи`);
      expect(await original!.evaluate((node) => node === document.querySelector(".create-quick-surface"))).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      expect(errors).toEqual([]);
    });
  });
}
