import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "playwright/test";

test.use({ serviceWorkers: "block" });

for (const theme of ["light", "dark"]) {
  for (const width of [320, 390, 768, 1440]) {
    test(`catalog headers retain readable content ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(theme => {
        localStorage.setItem("werewolf-theme", theme);
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("welcome-modal-shown", "1");
      }, theme);
      await page.route("**/api/auth/get-session**", route => route.fulfill({ json: null }));
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      for (const route of ["/werewolf/roles", "/mafia/roles", "/history?visualHistory=fixture"]) {
        await page.goto(route);
        const header = route.startsWith("/history") ? page.locator("main > header") : page.locator(".role-codex-hero");
        await expect(header.getByRole("heading", { level: 1 })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        if (route.startsWith("/history")) {
          const firstCase = page.locator(".case-file").first();
          await expect(firstCase).toBeVisible();
          if (width <= 390) expect((await firstCase.boundingBox())!.y).toBeLessThan(540);
          await page.screenshot({ path: testInfo.outputPath(`history-${theme}-${width}.png`), animations: "disabled" });
        } else if (width <= 390) {
          const bounds = (await header.boundingBox())!;
          expect(bounds.x).toBeGreaterThanOrEqual(16);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 16);
        }
        expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
        await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
        const failures = await header.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          return [...element.querySelectorAll("h1, p, a")].filter(node => {
            const box = node.getBoundingClientRect();
            if (!box.width || !box.height) return false;
            return box.left < bounds.left - 1 || box.right > bounds.right + 1 || node.scrollWidth > node.clientWidth + 1;
          }).map(node => node.textContent);
        });
        expect(failures).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
      expect(errors).toEqual([]);
    });
  }
}
