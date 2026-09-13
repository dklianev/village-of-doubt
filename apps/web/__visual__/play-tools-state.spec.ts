import { expect, test } from "playwright/test";

for (const width of [390, 1440]) {
  test(`reference preserves selection and isolates game shortcuts ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("werewolf-theme", "light");
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
    });
    await page.goto("/play/VISUAL?visualGame=1&family=werewolves&phase=voting&players=12&voteTally=full");
    await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
    const target = page.locator('.play-seat-slot[data-targetable="true"]').last();
    await target.locator("button[data-seat-token]").click();
    await expect(target).toHaveAttribute("data-selected", "true");
    if (width < 1024) await page.getByRole("button", { name: "Към разговора", exact: true }).click();
    await page.getByRole("button", { name: "Правила", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Правила на масата" });
    const panel = dialog.getByRole("tabpanel");
    await panel.focus();
    await panel.press("1");
    await expect(target).toHaveAttribute("data-selected", "true");
    await panel.press("?");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(target).toHaveAttribute("data-selected", "true");
  });

  test(`reference and signals preserve a public draft ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
    });
    await page.goto("/play/VISUAL?visualGame=1&family=werewolves&phase=day_discussion&players=8");
    await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
    if (width < 1024) await page.getByRole("button", { name: "Към разговора", exact: true }).click();
    await page.getByRole("tab", { name: "Разговор", exact: true }).click();
    const input = page.getByRole("textbox", { name: "Съобщение в дневния разговор" });
    await input.fill("Ще изчакам да чуя останалите.");
    for (const name of [/^Правила$/, /Сигнали/]) {
      await page.locator(".play-console-tools").getByRole("button", { name }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(input).toHaveValue("Ще изчакам да чуя останалите.");
    }
  });
}
