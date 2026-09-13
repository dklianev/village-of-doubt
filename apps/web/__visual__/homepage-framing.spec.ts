import { expect, test } from "playwright/test";

for (const theme of ["light", "dark"] as const) {
  test(`homepage keeps each complete scene readable at intermediate widths in ${theme}`, async ({ page }) => {
    await page.addInitScript((selected) => {
      localStorage.setItem("werewolf-theme", selected);
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
    }, theme);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const width of [320, 390, 640, 641, 667, 720, 767, 768, 820, 1024, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      for (const card of await page.locator(".game-choice-card").all()) {
        const image = card.locator("img").filter({ visible: true });
        await expect(image).toHaveCount(1);
        // Native lazy loading needs the scene in view before decode can finish.
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((el) => (el as HTMLImageElement).decode());
        const framing = await image.evaluate((el) => {
          const image = el as HTMLImageElement;
          const box = image.getBoundingClientRect();
          const scale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight);
          return box.width / (image.naturalWidth * scale);
        });
        expect(framing, `${theme} ${width}: important figures must stay inside the image crop`).toBeGreaterThanOrEqual(0.95);
        await expect(card.locator(".game-choice-players")).toBeVisible();
        const text = await card.locator("h2").evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return { textRight: range.getBoundingClientRect().right, right: el.getBoundingClientRect().right };
        });
        expect(text.textRight).toBeLessThanOrEqual(text.right + 1);
        const buttons = await card.locator(".game-choice-actions a").all();
        for (const button of buttons) {
          expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await expect(page.getByText("Данните за игрите временно не са достъпни.", { exact: true })).toHaveCount(0);
  });
}
