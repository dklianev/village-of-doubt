import { expect, test } from "playwright/test";

for (const browserName of ["chromium", "firefox"] as const) {
  for (const { width, height, theme } of [
    { width: 1440, height: 900, theme: "dark" },
    { width: 1440, height: 900, theme: "light" },
    { width: 390, height: 844, theme: "dark" },
    { width: 320, height: 740, theme: "light" },
    { width: 740, height: 360, theme: "dark" },
  ]) {
    test(`account dialog lifecycle ${browserName} ${theme} ${width}x${height}`, async ({ playwright, baseURL }, testInfo) => {
      const browser = await playwright[browserName].launch();
      try {
        const page = await browser.newPage({ baseURL: baseURL ?? "http://127.0.0.1:3000", viewport: { width, height }, reducedMotion: "reduce", serviceWorkers: "block" });
        const errors: string[] = [];
        const mutations: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.addInitScript((theme) => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("tutorial-completed", "1");
          localStorage.setItem("welcome-modal-shown", "1");
        }, theme);
        await page.route("**/api/auth/**", (route) => {
          if (route.request().method() !== "GET") mutations.push(route.request().url());
          return route.fulfill({ json: { user: {
            id: "visual-account-user", name: "Synthetic player", email: "synthetic@example.invalid", emailVerified: true,
          } } });
        });
        await page.route("**/api/account/delete", (route) => {
          mutations.push(route.request().url());
          return route.fulfill({ status: 403, json: { error: "Synthetic fixture: deletion is forbidden" } });
        });
        await page.goto("/account?visualAuth=1");
        await expect(page).toHaveTitle(/.+/);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Визуален играч");
        await page.getByRole("tab", { name: "Данни и сигурност" }).click();
        await page.locator('header a[href="/"]').first().click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole("heading", { name: "Върколак или Мафия", exact: true })).toBeVisible();
        await page.goBack();
        const trigger = page.getByRole("button", { name: "Изтрий моето досие" });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Сигурен/сигурна ли си?" });
        const input = dialog.getByRole("textbox");
        await expect(input).toBeFocused();
        await input.fill("synthetic draft");

        for (let cycle = 0; cycle < 2; cycle += 1) {
          await expect(dialog).toBeVisible();
          expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
          await page.goForward();
          await expect(page).toHaveURL(/\/$/);
          await expect(page.getByRole("heading", { name: "Върколак или Мафия", exact: true })).toBeVisible();
          await expect(page.locator("dialog:modal")).toHaveCount(0);
          await expect(page.locator("dialog[open]")).toHaveCount(0);
          await page.goBack();
          await expect(dialog).toBeVisible();
          expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
          await expect(input).toBeFocused();
          await expect(input).toHaveValue("synthetic draft");
        }

        // Native top-layer isolation rejects focus outside the dialog after restoration.
        await trigger.evaluate((element) => element.focus());
        await expect(input).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(dialog.getByRole("button", { name: "Отказ", exact: true })).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(input).toBeFocused();
        await expect(dialog.getByRole("button", { name: "Изтрий завинаги" })).toBeDisabled();
        await page.evaluate(() => document.fonts.ready);
        const box = await dialog.boundingBox();
        expect(box).not.toBeNull();
        expect(Math.abs(box!.x + box!.width / 2 - width / 2)).toBeLessThanOrEqual(1);
        expect(Math.abs(box!.y + box!.height / 2 - height / 2)).toBeLessThanOrEqual(1);
        expect(box!.x).toBeGreaterThanOrEqual(15);
        expect(box!.y).toBeGreaterThanOrEqual(19);
        expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        const screenshot = testInfo.outputPath("dialog.png");
        await page.screenshot({ path: screenshot });
        await testInfo.attach(`dialog-${browserName}-${theme}-${width}`, { path: screenshot, contentType: "image/png" });
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
        await trigger.click();
        await expect(input).toHaveValue("");
        await dialog.getByRole("button", { name: "Отказ", exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
        expect(mutations).toEqual([]);
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    });
  }
}
