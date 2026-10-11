import { test, expect, type Page } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openWaitingScene(page: Page, family: "werewolves" | "mafia", theme: "light" | "dark", players: number, phase: "lobby" | "mayor_successor" = "lobby") {
  await page.addInitScript(theme => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
  await page.route("**/api/auth/get-session**", route => route.fulfill({ json: null }));
  const query = new URLSearchParams({ visualGame: "1", family, phase, players: String(players), viewer: "host" });
  const response = await page.goto(`/play/ABC234?${query}`);
  expect(response?.ok()).toBe(true);
  await expect(page.locator('.play-stage[data-layout-ready="true"]')).toBeVisible();
  await expect(page.locator(".play-seat-slot")).toHaveCount(players);
  await page.evaluate(() => document.fonts.ready);
}

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["light", "dark"] as const) {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 600 }]) {
      test(`waiting scene status text ${family} ${theme} ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await openWaitingScene(page, family, theme, 8);
        const statuses = page.locator("[data-lobby-seat-status]");
        await expect(statuses).toHaveCount(8);
        const geometry = await statuses.evaluateAll(elements => elements.map(status => {
          const label = status.querySelector("span")!;
          const box = status.getBoundingClientRect();
          const portrait = status.closest(".play-seat-slot")!.querySelector("[data-seat-portrait]")!.getBoundingClientRect();
          // Text ranges catch glyph overflow even when the label's element box fits.
          const range = document.createRange();
          range.selectNodeContents(label);
          const textRects = [...range.getClientRects()];
          return {
            participant: status.getAttribute("title"),
            state: status.getAttribute("data-state"),
            text: label.textContent,
            hasText: textRects.length > 0 && textRects.every(rect => rect.width > 0 && rect.height > 0),
            insideStatus: textRects.every(rect => rect.left >= box.left - 0.5 && rect.right <= box.right + 0.5
              && rect.top >= box.top - 0.5 && rect.bottom <= box.bottom + 0.5),
            overlapsPortrait: textRects.some(rect => Math.min(rect.right, portrait.right) > Math.max(rect.left, portrait.left)
              && Math.min(rect.bottom, portrait.bottom) > Math.max(rect.top, portrait.top)),
          };
        }));
        expect(geometry).toEqual(expect.arrayContaining([
          expect.objectContaining({ state: "ready", text: "Готов" }),
          expect.objectContaining({ state: "waiting", text: "Не е готов" }),
          expect.objectContaining({ state: "disconnected", text: "Без връзка" }),
        ]));
        for (const { participant, hasText, insideStatus, overlapsPortrait } of geometry) {
          expect.soft({ hasText, insideStatus, overlapsPortrait }, participant ?? "status").toEqual({
            hasText: true, insideStatus: true, overlapsPortrait: false,
          });
        }
      });
    }

    for (const players of [9, 10, 11, 12]) {
      test(`waiting scene seats do not overlap ${family} ${theme} 1366 players=${players}`, async ({ page }) => {
        await page.setViewportSize({ width: 1366, height: 768 });
        await openWaitingScene(page, family, theme, players);
        const overlaps = await page.locator(".play-seat-slot").evaluateAll(elements => {
          const seats = elements.map(element => ({
            name: element.querySelector("[data-seat-name]")!.textContent,
            rect: element.getBoundingClientRect(),
          }));
          return seats.flatMap((a, index) => seats.slice(index + 1)
            .filter(b => Math.min(a.rect.right, b.rect.right) > Math.max(a.rect.left, b.rect.left) + 0.5
              && Math.min(a.rect.bottom, b.rect.bottom) > Math.max(a.rect.top, b.rect.top) + 0.5)
            .map(b => [a.name, b.name]));
        });
        expect(overlaps).toEqual([]);
      });
    }
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 900 }]) {
    for (const players of [6, 8, 12]) {
      test(`waiting scene every menu fits and receives pointers ${theme} ${viewport.width} players=${players}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await openWaitingScene(page, "werewolves", theme, players);
        const triggers = page.locator("[data-seat-menu-trigger]");
        await expect(triggers).toHaveCount(players);
        await expect(triggers.nth(3)).toHaveAccessibleName("Управление за Неда");
        // Exercise the known right-edge regression first, then every other seat.
        const indices = [3, ...Array.from({ length: players }, (_, index) => index).filter(index => index !== 3)];
        for (const index of indices) {
          const trigger = triggers.nth(index);
          await test.step(`${index}: ${await trigger.getAttribute("aria-label")}`, async () => {
            await trigger.evaluate(element => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
            await trigger.click();
            await expect(trigger).toHaveAttribute("aria-expanded", "true");
            const menu = page.locator('[data-seat-menu-root][data-open="true"] [data-seat-menu-controls]');
            await expect(menu).toBeVisible();
            const geometry = await menu.evaluate(element => {
              const stage = element.closest(".play-stage")!.getBoundingClientRect();
              const trigger = element.closest("[data-seat-menu-root]")!.querySelector("[data-seat-menu-trigger]")!;
              return [trigger, element, ...element.querySelectorAll("button")].map(control => {
                const rect = control.getBoundingClientRect();
                const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
                return {
                  control: control.getAttribute("aria-label") ?? control.textContent,
                  insideStage: rect.left >= stage.left - 0.5 && rect.right <= stage.right + 0.5
                    && rect.top >= stage.top - 0.5 && rect.bottom <= stage.bottom + 0.5,
                  insideViewport: rect.left >= -0.5 && rect.right <= innerWidth + 0.5
                    && rect.top >= -0.5 && rect.bottom <= innerHeight + 0.5,
                  receivesPointer: hit !== null && control.contains(hit),
                };
              });
            });
            for (const { control, insideStage, insideViewport, receivesPointer } of geometry) {
              expect.soft({ insideStage, insideViewport, receivesPointer }, `${index}: ${control}`).toEqual({
                insideStage: true, insideViewport: true, receivesPointer: true,
              });
            }
            await page.keyboard.press("Escape");
            await expect(menu).toHaveCount(0);
            await expect(trigger).toHaveAttribute("aria-expanded", "false");
          });
        }
      });
    }
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [{ width: 390, height: 600 }, { width: 1440, height: 900 }]) {
    test(`mayor succession menu stays above seats ${theme} ${viewport.width}`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.setViewportSize(viewport);
      await openWaitingScene(page, "werewolves", theme, 12, "mayor_successor");
      const trigger = page.getByRole("button", { name: "Управление за Неда", exact: true });
      await trigger.evaluate(element => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
      await trigger.click();
      const menu = page.getByRole("group", { name: "Команди за Неда", exact: true });
      const mayor = menu.getByRole("button", { name: "Кмет", exact: true });
      await expect(mayor).toBeVisible();
      await expect.poll(() => mayor.evaluate(button => {
        const rect = button.getBoundingClientRect();
        return button.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
      })).toBe(true);
      await page.screenshot({ path: info.outputPath("mayor-menu.png") });
      // Visibility alone missed the neighboring seat intercepting the actual click.
      await mayor.click();
      await expect(menu).toBeHidden();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(trigger).toBeFocused();
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [320, 1440]) {
  test(`waiting scene enlarged text ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/auth/get-session**", route => route.fulfill({ json: null }));
    await page.goto("/play/ABC234?visualGame=1&phase=lobby&players=8&viewer=host");
    await expect(page.locator('[data-layout-ready="true"]')).toBeVisible();
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll<HTMLElement>("main.play-shell *")]
        .map(element => ({ element, size: parseFloat(getComputedStyle(element).fontSize) }));
      for (const { element, size } of sizes) element.style.fontSize = `${size * 2}px`;
    });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const start = page.getByRole("button", { name: "Започни игра", exact: true });
    await start.scrollIntoViewIfNeeded();
    await expect(start).toBeInViewport({ ratio: 1 });
    if (width === 1440) await expect(page.locator(".play-stage")).toHaveAttribute("data-layout-mode", "dense-table-grid");
  });
}

for (const family of ["werewolves", "mafia"]) {
  for (const theme of ["light", "dark"]) {
    for (const width of [320, 390, 768, 1440]) {
      test(`waiting scene layout ${family} ${theme} ${width}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(theme => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
        }, theme);
        await page.route("**/api/auth/get-session**", route => route.fulfill({ json: null }));
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(`/play/ABC234?visualGame=1&family=${family}&phase=lobby&players=12&viewer=host&lobbyReady=all`);
        await expect(page.locator('[data-layout-ready="true"]')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(await page.locator("main.play-shell").evaluate(root =>
          getComputedStyle(root, "::before").backgroundRepeat.split(", ").at(-1))).toBe("no-repeat");
        const geometry = await page.locator("main.play-shell").evaluate(root => {
          const seats = [...root.querySelectorAll(".play-seat-slot")].map(seat => seat.getBoundingClientRect());
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            overlaps: seats.flatMap((a, i) => seats.slice(i + 1).filter(b =>
              Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1
              && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1)).length,
          };
        });
        expect(geometry).toEqual({ overflow: false, overlaps: 0 });
        const accessibility = await new AxeBuilder({ page }).include("main.play-shell").analyze();
        expect(accessibility.violations).toEqual([]);
        await page.screenshot({ path: info.outputPath("scene.png"), fullPage: true });
        if (family === "werewolves") {
          const trigger = page.getByRole("button", { name: "Управление за Искра", exact: true });
          await trigger.focus();
          await page.keyboard.press("Enter");
          const menu = page.getByRole("group", { name: "Команди за Искра", exact: true });
          await expect(menu).toBeVisible();
          await expect(menu.getByRole("button", { name: "Кмет", exact: true })).toBeInViewport({ ratio: 1 });
          await page.keyboard.press("Escape");
          await expect(menu).toBeHidden();
          await expect(trigger).toBeFocused();
        }
        expect(errors).toEqual([]);
      });
    }
  }
}
