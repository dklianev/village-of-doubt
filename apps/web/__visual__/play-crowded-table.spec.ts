import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "playwright/test";

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["light", "dark"] as const) {
    for (const phase of ["voting", "lobby"] as const) {
      test(`crowded ${family} ${theme} ${phase} keeps seats separate through resizing`, async ({ page }) => {
        const count = family === "werewolves" ? 30 : 24;
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.addInitScript(theme => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("welcome-modal-shown", "1");
        }, theme);
        await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=${phase}&players=${count}&viewer=host&voteTally=full`);
        const stage = page.locator(".play-stage");
        await expect(stage).toHaveAttribute("data-layout-mode", "crowded-table");
        await page.evaluate(() => document.fonts.ready);
        const ids = () => stage.locator("[data-seat-user-id]").evaluateAll(seats => seats.map(seat => seat.getAttribute("data-seat-user-id")));
        const originalOrder = await ids();
        expect(originalOrder).toHaveLength(count);

        for (const width of [1280, 1440, 1920, 390, 320, 1280]) {
          await page.setViewportSize({ width, height: width >= 1024 ? 720 : 844 });
          await expect(stage).toHaveAttribute("data-layout-mode", width >= 1024 ? "crowded-table" : "mobile-table-grid");
          await expect.poll(async () => stage.evaluate(stage => {
            const stageRect = stage.getBoundingClientRect();
            const rects = [...stage.querySelectorAll(".play-seat-slot")].map(seat => seat.getBoundingClientRect());
            const timer = stage.querySelector('[role="timer"]')?.getBoundingClientRect();
            const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            return rects.every((rect, i) => rect.width >= 44 && rect.height >= 44
              && rect.left >= stageRect.left && rect.right <= stageRect.right
              && rect.top >= stageRect.top && rect.bottom <= stageRect.bottom
              && (!timer || !overlaps(rect, timer))
              && rects.slice(i + 1).every(other => !overlaps(rect, other)));
          })).toBe(true);
          expect(await ids()).toEqual(originalOrder);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        }

        if (phase === "voting") {
          const target = stage.getByRole("button", { name: /^Избери / }).first();
          await target.focus();
          await target.press("Enter");
          await expect(target).toHaveAttribute("aria-pressed", "true");
          await expect(target.locator("[data-seat-selection]")).toBeVisible();
          await expect(page.getByRole("button", { name: /^Потвърди гласа/ })).toBeEnabled();
          await expect(page.locator(".play-action-receipt")).toHaveCount(0);
        } else {
          const trigger = stage.getByRole("button", { name: /^Управление за / }).first();
          if (await trigger.count()) {
            await trigger.click();
            const controls = stage.locator('[data-seat-menu-controls]:visible');
            await expect(controls).toBeVisible();
            const rect = await controls.boundingBox();
            expect(rect!.x).toBeGreaterThanOrEqual(0);
            expect(rect!.x + rect!.width).toBeLessThanOrEqual(1280);
            await page.keyboard.press("Escape");
            await expect(trigger).toBeFocused();
          }
        }
        const a11y = await new AxeBuilder({ page }).include(".play-stage").withTags(["wcag2a", "wcag2aa"]).analyze();
        expect(a11y.violations).toEqual([]);

        await page.addStyleTag({ content: ".play-stage { font-size: 32px !important; }" });
        await page.setViewportSize({ width: 1290, height: 720 });
        await expect(stage).toHaveAttribute("data-layout-mode", "dense-table-grid");
        expect(await ids()).toEqual(originalOrder);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1290);
      });
    }
  }
}
