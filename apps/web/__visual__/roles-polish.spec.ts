import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "playwright/test";

for (const family of ["werewolf", "mafia"] as const) {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [320, 768, 1100, 1440]) {
      test(`role discovery and dossier ${family} ${theme} ${width}`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((value) => {
          localStorage.setItem("werewolf-theme", value);
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("welcome-modal-shown", "1");
        }, theme);
        await page.goto(`/${family}/roles`);
        const search = page.getByRole("textbox", { name: "Търси роля" });
        await search.fill("няма-такава-роля");
        await expect(page.getByRole("heading", { name: "Няма роля по този филтър" })).toBeVisible();
        await page.getByRole("button", { name: "Покажи всички роли" }).click();
        await expect(search).toHaveValue("");

        if (width < 761) await page.getByRole("button", { name: "Филтри и подредба" }).click();
        await page.getByRole("group", { name: "Тип роли" }).getByRole("button", { name: "Нощни", exact: true }).click();
        await expect(page.getByRole("button", { name: "Нощни", exact: true })).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("combobox", { name: "Подредба" }).selectOption("night");
        await page.getByRole("button", { name: "Изчисти филтрите" }).click();
        await expect(page.getByRole("combobox", { name: "Подредба" })).toHaveValue("core");
        const insets = await page.getByRole("region", { name: "Филтри за роли" }).evaluate((toolbar) => {
          const frame = toolbar.getBoundingClientRect();
          return [...toolbar.querySelectorAll("input, button, select")]
            .filter((control) => control.getClientRects().length > 0)
            .map((control) => {
              const bounds = control.getBoundingClientRect();
              return Math.min(bounds.left - frame.left, frame.right - bounds.right);
            });
        });
        expect(insets.length).toBeGreaterThan(0);
        expect(Math.min(...insets)).toBeGreaterThanOrEqual(8);
        const role = family === "werewolf" ? "red_riding_hood" : "bodyguard";
        await search.fill(role);
        await expect(page.locator(".role-codex-card")).toHaveCount(1);
        const trigger = page.locator(`.role-${role} button`);
        await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
        await expect(page.locator(".role-card-title")).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const catalogA11y = await new AxeBuilder({ page }).include(".roles-shell").analyze();
        expect(catalogA11y.violations).toEqual([]);

        await trigger.focus();
        const before = await page.evaluate(() => ({ scroll: scrollY, nav: document.querySelector("header")!.getBoundingClientRect().toJSON() }));
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        if (family === "werewolf") await expect(dialog.locator(".role-warning")).toBeVisible();
        else await expect(dialog.locator(".role-warning")).toHaveCount(0);
        await dialog.locator("img").evaluate((image) => (image as HTMLImageElement).decode());
        const panel = dialog.locator(".role-codex-detail-panel");
        expect(await panel.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        const modalA11y = await new AxeBuilder({ page }).include(".role-codex-detail").analyze();
        expect(modalA11y.violations).toEqual([]);
        await panel.evaluate((node) => { node.scrollTop = node.scrollHeight; });
        const close = (await dialog.locator(".role-codex-detail-close").boundingBox())!;
        expect(close.y).toBeGreaterThanOrEqual(0);
        expect(close.y + close.height).toBeLessThanOrEqual(900);
        await page.keyboard.press("Tab");
        expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        expect(await page.evaluate(() => ({ scroll: scrollY, nav: document.querySelector("header")!.getBoundingClientRect().toJSON() }))).toEqual(before);
        await expect(page).toHaveURL(new RegExp(`/${family}/roles$`));
        expect(errors).toEqual([]);
      });
    }
  }
}
