import { expect, test } from "playwright/test";

for (const width of [320, 390, 1440] as const) {
  for (const theme of ["dark", "light"] as const) {
    test(`leaderboard headers fit ${width} ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("werewolf-theme", selectedTheme);
      }, theme);
      await page.goto("/leaderboard?visualLeaderboard=fixture");
      const ranking = page.getByRole("table", { name: "Начело на класацията" });
      await expect(ranking.locator("tbody tr")).toHaveCount(3);
      await page.evaluate(() => document.fonts.ready);
      const headers = await ranking.getByRole("columnheader").evaluateAll((cells) => cells.map((cell) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        const text = range.getBoundingClientRect();
        const box = cell.getBoundingClientRect();
        const style = getComputedStyle(cell);
        return {
          label: cell.textContent,
          lines: range.getClientRects().length,
          fits: text.left >= box.left + parseFloat(style.paddingLeft) - 1
            && text.right <= box.right - parseFloat(style.paddingRight) + 1,
        };
      }));
      expect(headers).toHaveLength(4);
      for (const header of headers) {
        expect(header.lines, `${header.label} must stay on one line`).toBe(1);
        expect(header.fits, `${header.label} must fit its cell`).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const screenshot = testInfo.outputPath("leaderboard-labels.png");
      await page.screenshot({ path: screenshot });
      await testInfo.attach("leaderboard-labels", { path: screenshot, contentType: "image/png" });
    });
  }
}
