import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 1024, 1440]) {
    test(`nominee selection shares the table state ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width < 1024 ? 844 : 900 });
      await page.addInitScript((theme) => {
        localStorage.setItem("werewolf-theme", theme);
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("welcome-modal-shown", "1");
      }, theme);
      await page.goto("/play/VISUAL?visualGame=1&family=mafia&phase=voting&players=10&voteTally=full");
      await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
      const dock = page.locator(".play-action-dock");
      if (width < 1024) await dock.getByRole("button", { name: "Покажи личния ход" }).click();
      await expect(dock.getByRole("heading", { name: "Твоят глас", exact: true })).toBeVisible();
      const confirm = dock.getByRole("button", { name: "Потвърди гласа", exact: true });
      await expect(confirm).toBeDisabled();
      const nomineesBox = await dock.getByTestId("nomination-panel").boundingBox();
      const choiceBox = await dock.locator(".play-selected-target").boundingBox();
      expect(nomineesBox!.y + nomineesBox!.height).toBeLessThanOrEqual(choiceBox!.y);
      expect(await confirm.evaluate((button) => getComputedStyle(button).boxShadow)).toBe("none");
      const vera = dock.getByRole("button", { name: "Избери Вера за гласуване", exact: true });
      const georgi = dock.getByRole("button", { name: "Избери Георги за гласуване", exact: true });
      await vera.focus();
      await vera.press("Enter");
      await expect(vera).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("button", { name: /^Избери Вера:/ })).toHaveAttribute("aria-pressed", "true");
      const vote = dock.getByRole("button", { name: "Потвърди гласа за Вера", exact: true });
      await expect(vote).toBeEnabled();
      await expect(vote).toHaveText("Потвърди гласа");
      await expect(page.locator(".play-action-receipt")).toHaveCount(0);
      await georgi.click();
      await expect(vera).toHaveAttribute("aria-pressed", "false");
      await expect(georgi).toHaveAttribute("aria-pressed", "true");
      await expect(dock.getByRole("heading", { name: "Твоят глас", exact: true })).toBeVisible();
      await expect(dock.locator(".play-selected-target strong")).toHaveText("Георги");
      // VISUAL has no authoritative server; clicking must not invent an accepted vote.
      await dock.getByRole("button", { name: "Потвърди гласа за Георги", exact: true }).click();
      await expect(page.locator(".play-action-receipt")).toHaveCount(0);
      await georgi.click();
      await expect(confirm).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const a11y = await new AxeBuilder({ page }).include(".play-action-dock").withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(a11y.violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath("nominee-selection.png") });
    });
  }
}
