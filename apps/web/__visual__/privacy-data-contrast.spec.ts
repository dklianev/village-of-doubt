import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "playwright/test";

test.use({ serviceWorkers: "block" });

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`privacy data contrast ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((theme) => {
        localStorage.setItem("werewolf-theme", theme);
        localStorage.setItem("cookie-consent", "1");
      }, theme);
      await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
      await page.route("**/api/account/export**", (route) => route.fulfill({
        status: 503,
        json: { error: "unavailable" },
      }));
      await page.goto("/privacy?visualAuth=1#privacy-data", { waitUntil: "domcontentloaded" });
      await expect(page.locator(".auth-chip-slot").first()).toHaveAttribute("data-auth-state", "guest");
      const download = page.getByRole("button", { name: /Изтегли моите данни/ });
      await download.scrollIntoViewIfNeeded();
      await expect(download).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const audit = () => new AxeBuilder({ page })
        .include("#privacy-data")
        .withRules(["color-contrast"])
        .analyze();
      expect((await audit()).violations).toEqual([]);
      await download.click();
      await expect(page.locator("#privacy-data").getByRole("alert")).toContainText("Не успяхме да подготвим данните");
      await expect(download).toBeEnabled();
      expect((await audit()).violations).toEqual([]);
      await testInfo.attach(`privacy-data-${theme}-${width}`, {
        body: await page.screenshot({ caret: "initial" }), contentType: "image/png",
      });
    });
  }
}
