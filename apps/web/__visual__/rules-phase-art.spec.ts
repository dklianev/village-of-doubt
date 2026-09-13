import { expect, test } from "playwright/test";

for (const family of ["werewolf", "mafia"] as const) {
  for (const theme of ["dark", "light"] as const) {
    for (const width of [320, 390, 1440]) {
      test(`phase artwork fills its card ${family} ${theme} ${width}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((theme) => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
        }, theme);
        await page.goto(`/${family}/rules`);
        await page.evaluate(() => document.fonts.ready);
        const cards = page.locator(".phase-node");
        await expect(cards).toHaveCount(6);
        for (const card of await cards.all()) {
          await card.scrollIntoViewIfNeeded();
          const art = card.locator("img");
          await art.evaluate((image) => (image as HTMLImageElement).decode());
          const cardBox = (await card.boundingBox())!;
          const artBox = (await art.boundingBox())!;
          expect(artBox.x).toBeLessThanOrEqual(cardBox.x + 2);
          expect(artBox.y).toBeLessThanOrEqual(cardBox.y + 2);
          expect(artBox.x + artBox.width).toBeGreaterThanOrEqual(cardBox.x + cardBox.width - 2);
          expect(artBox.y + artBox.height).toBeGreaterThanOrEqual(cardBox.y + cardBox.height - 2);
          expect(artBox.width).toBeGreaterThanOrEqual(cardBox.width - 3);
          expect(artBox.height).toBeGreaterThanOrEqual(cardBox.height - 3);
        }
        await cards.last().click();
        await expect(cards.last()).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator("#phase-detail-panel h3")).toContainText(family === "mafia" ? "Присъда" : "Развръзка");
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await page.locator(".phase-timeline").screenshot({ path: info.outputPath("phase-art.png") });
      });
    }
  }
}
