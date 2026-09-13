import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "playwright/test";

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [320, 390, 872, 1023, 1440]) {
      test(`play tools and frame ${family} ${theme} ${width}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript((theme) => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("welcome-modal-shown", "1");
        }, theme);
        await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=voting&players=12&voteTally=full`);
        const stage = page.locator('.play-stage[data-layout-ready="true"]');
        await expect(stage).toBeVisible();
        await expect(page.locator('.play-personal-area .role-card')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);

        const clipping = await stage.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const problems: string[] = [];
          // The decorative frame extends 7px beyond the stage's border box.
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (!["hidden", "clip", "auto", "scroll"].includes(style.overflowX)) continue;
            const clip = parent.getBoundingClientRect();
            if (rect.left - 7 < clip.left || rect.right + 7 > clip.right) problems.push(parent.className || parent.tagName);
          }
          return problems;
        });
        expect(clipping, "The complete decorative frame must fit inside every clipping ancestor").toEqual([]);
        await stage.screenshot({ path: testInfo.outputPath("table.png") });

        if (width < 1024) await page.getByRole("button", { name: "Към разговора", exact: true }).click();
        const tools = page.locator(".play-console-tools");
        const rules = tools.getByRole("button", { name: "Правила", exact: true });
        await rules.scrollIntoViewIfNeeded();
        const before = await page.locator(".play-interaction-column").boundingBox();
        const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        await rules.click();
        const reference = page.getByRole("dialog", { name: "Правила на масата" });
        await expect(reference).toBeVisible();
        await expect(reference.getByRole("tab", { name: "Текуща фаза" })).toHaveAttribute("aria-selected", "true");
        for (const tab of ["Правила", "Състав", "Текуща фаза"]) {
          await reference.getByRole("tab", { name: tab, exact: true }).click();
          await expect(reference.getByRole("tabpanel")).toBeVisible();
          if (tab === "Състав") {
            const portraits = reference.locator('li > span[aria-hidden="true"]');
            expect(await portraits.first().evaluate((element) => getComputedStyle(element).backgroundImage)).not.toBe("none");
            await reference.screenshot({ path: testInfo.outputPath("roster.png") });
          }
        }
        await reference.getByRole("tab", { name: "Текуща фаза" }).press("ArrowRight");
        await expect(reference.getByRole("tab", { name: "Правила", exact: true })).toBeFocused();
        await page.keyboard.press("Home");
        await expect(reference.getByRole("tab", { name: "Текуща фаза" })).toBeFocused();
        const box = await reference.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(901);
        expect((await page.locator(".play-interaction-column").boundingBox())!.height).toBeCloseTo(before!.height, 0);
        await reference.screenshot({ path: testInfo.outputPath("rules.png") });
        if (width === 390 || width === 1440) {
          expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
        }
        await page.keyboard.press("Escape");
        await expect(reference).not.toBeVisible();
        await expect(rules).toBeFocused();
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(documentHeight);

        const signals = tools.getByRole("button", { name: /Сигнали/ });
        await signals.click();
        const cues = page.getByRole("dialog", { name: "Сигнали за фазите" });
        await expect(cues).toBeVisible();
        await cues.getByRole("radio", { name: "Тихо", exact: true }).check();
        await expect(cues.getByRole("button", { name: "Пробвай" })).toBeDisabled();
        await cues.getByRole("radio", { name: "Визуално", exact: true }).check();
        await cues.getByRole("button", { name: "Пробвай" }).click();
        expect((await page.locator(".play-interaction-column").boundingBox())!.height).toBeCloseTo(before!.height, 0);
        await cues.screenshot({ path: testInfo.outputPath("signals.png") });
        await page.keyboard.press("Escape");
        await expect(signals).toBeFocused();
        await expect(signals).toContainText("Визуално");
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      });
    }
  }
}
