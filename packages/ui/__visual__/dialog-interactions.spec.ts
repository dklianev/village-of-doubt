import { expect, test } from "playwright/test";

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
]) {
  for (const theme of ["light", "dark"]) {
    test(`@ui ${viewport.name} ${theme} dialog cancel reopen Escape lifecycle`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/iframe.html?id=primitives-dialog--interactive&viewMode=story&globals=theme:${theme}`);
      const opener = page.locator("#storybook-root button");
      await expect(opener).toBeVisible();
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
      await page.evaluate(() => document.fonts.ready);
      const body = page.locator("body");
      const originalOverflow = await body.evaluate((element) => getComputedStyle(element).overflow);
      const originalPointerEvents = await body.evaluate((element) => getComputedStyle(element).pointerEvents);
      const dialog = page.getByRole("dialog");
      const overlay = page.locator(".ds-dialog-overlay");
      // Capture the real CSS lifecycle before Radix processes animationend and unmounts.
      const exitEvents = await page.evaluateHandle(() => {
        const events: { type: string; name: string; elapsedTime: number; position: string; overflow: string }[] = [];
        const record = (event: AnimationEvent) => {
          const element = event.target;
          if (!(element instanceof HTMLElement) || !element.matches(".ds-dialog, .ds-dialog-overlay")) return;
          if (!event.animationName.endsWith("-close")) return;
          events.push({
            type: event.type,
            name: event.animationName,
            elapsedTime: event.elapsedTime,
            position: getComputedStyle(element).position,
            overflow: getComputedStyle(document.body).overflow,
          });
        };
        document.addEventListener("animationstart", record, true);
        document.addEventListener("animationend", record, true);
        return events;
      });

      for (const action of ["cancel", "Escape"]) {
        await opener.focus();
        await page.keyboard.press("Enter");
        await expect(dialog).toHaveAttribute("data-state", "open");
        await expect(dialog).toHaveCSS("position", "fixed");
        await expect(body).toHaveCSS("overflow", "hidden");
        await expect(body).toHaveAttribute("data-scroll-locked", "1");
        const cancel = dialog.getByRole("button").first();
        const confirm = dialog.getByRole("button").last();
        await expect(cancel).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(confirm).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(cancel).toBeFocused();
        await dialog.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
        if (action === "Escape") {
          await page.screenshot({ path: testInfo.outputPath("dialog-reopened.png") });
          await page.keyboard.press("Escape");
        } else {
          await cancel.click();
        }

        await expect(dialog).toHaveCount(0);
        await expect(overlay).toHaveCount(0);
        const events = await exitEvents.jsonValue();
        for (const name of ["ds-dialog-close", "ds-dialog-overlay-close"]) {
          expect(events).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: "animationstart", name, position: "fixed", overflow: "hidden" }),
            expect.objectContaining({ type: "animationend", name, position: "fixed" }),
          ]));
          expect(events.find((event) => event.type === "animationend" && event.name === name)?.elapsedTime).toBeCloseTo(0.18, 6);
        }
        await exitEvents.evaluate((events) => { events.length = 0; });
        await expect(opener).toBeFocused();
        await expect(body).not.toHaveAttribute("data-scroll-locked");
        await expect(body).toHaveCSS("overflow", originalOverflow);
        await expect(body).toHaveCSS("pointer-events", originalPointerEvents);
      }
      await page.screenshot({ path: testInfo.outputPath("dialog-closed.png") });
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
      expect(errors).toEqual([]);
      await exitEvents.dispose();
    });
  }
}
