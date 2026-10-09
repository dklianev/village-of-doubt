import { expect, test } from "playwright/test";

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 667 }]) {
    for (const kind of ["offline", "404"] as const) {
      test(`${kind} keeps recovery in view at ${viewport.width}x${viewport.height} in ${theme}`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.addInitScript((theme) => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
        }, theme);
        await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
        await page.route("**/api/health", (route) => route.fulfill({ status: 503, json: { status: "unavailable" } }));
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(kind === "offline" ? "/offline" : "/synthetic-missing-page");
        await expect(page.locator(".auth-chip-slot")).toHaveAttribute("data-auth-state", "guest");
        await page.evaluate(() => document.fonts.ready);
        const action = page.locator("main .btn-primary");
        await expect(action).toBeVisible();
        const box = (await action.boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        expect(box.height).toBeGreaterThanOrEqual(44);
        await action.focus();
        await expect(action).toBeFocused();
        await expect(action).toHaveCSS("outline-style", "solid");
        await page.screenshot({ path: testInfo.outputPath("system-state.png"), caret: "initial", style: "nextjs-portal { display: none; }" });
        await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
        expect(errors).toEqual([]);
      });
    }
  }
}

for (const family of ["werewolves", "mafia"]) {
  for (const theme of ["light", "dark"] as const) {
    for (const viewport of [{ width: 390, height: 667 }, { width: 844, height: 390 }]) {
      test(`recovery owns focus above the navbar for ${family} ${theme} ${viewport.width}`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.addInitScript(theme => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
        }, theme);
        await page.route("**/api/auth/get-session**", route => route.fulfill({ json: null }));
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=voting&players=10&connection=lost`);
        await expect(page.locator(".auth-chip-slot")).toHaveAttribute("data-auth-state", "guest");
        const dialog = page.getByRole("dialog", { name: "Връзката е прекъсната" });
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveCSS("animation-name", "none");
        const retry = dialog.getByRole("button", { name: "Опитай пак" });
        const reload = dialog.getByRole("button", { name: "Презареди" });
        await retry.focus();
        await page.keyboard.press("Shift+Tab");
        await expect(reload).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(retry).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(dialog).toBeVisible();
        // The navigation opener lies behind the recovery overlay, not above it.
        const menu = await page.getByRole("button", { name: "Отвори менюто", includeHidden: true }).boundingBox();
        if (menu) await page.mouse.click(menu.x + menu.width / 2, menu.y + menu.height / 2);
        await expect(page.getByRole("dialog", { name: "Навигация" })).toHaveCount(0);
        if (viewport.height < 400) await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
        await page.evaluate(() => document.fonts.ready);
        expect(await dialog.evaluate(element => {
          const box = element.getBoundingClientRect();
          return Boolean(document.elementFromPoint(box.left + 20, box.top + 20)?.closest(".reconnect-modal"));
        })).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
        await reload.scrollIntoViewIfNeeded();
        await expect(reload).toBeInViewport();
        expect(errors).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath("recovery.png"), caret: "initial", style: "nextjs-portal{display:none}" });
      });
    }
  }
}
