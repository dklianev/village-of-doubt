import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "playwright/test";

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["dark", "light"] as const) {
    for (const width of [320, 390, 1440] as const) {
      test(`play command hierarchy ${family} ${theme} ${width}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.setViewportSize({ width, height: width > 1023 ? 1000 : 844 });
        await page.addInitScript((selectedTheme) => {
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("werewolf-theme", selectedTheme);
        }, theme);
        const query = new URLSearchParams({
          visualGame: "1", family, phase: "night", players: "9",
          role: family === "mafia" ? "commissioner" : "seer",
        });
        await page.goto(`/play/VISUAL?${query}`, { waitUntil: "domcontentloaded" });
        await expect(page.locator(".play-stage")).toHaveAttribute("data-layout-ready", "true");
        await page.evaluate(() => document.fonts.ready);

        const personal = page.locator(".play-primary-column > .play-personal-area");
        const card = personal.locator(".role-card[data-private-dossier]");
        await expect(card).toBeVisible();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        const { personalBox, stageBox } = await page.locator(".play-primary-column").evaluate((column) => ({
          personalBox: column.querySelector(".play-personal-area")!.getBoundingClientRect().toJSON(),
          stageBox: column.querySelector(".play-stage")!.getBoundingClientRect().toJSON(),
        }));
        expect(personalBox.y, "The persistent role stays below the table at every viewport")
          .toBeGreaterThanOrEqual(stageBox.y + stageBox.height - 1);
        const dock = page.locator(".play-action-dock");
        await expect(dock.locator("[data-private-dossier]")).toHaveCount(0);
        await expect(dock.getByRole("group", { name: "Лично досие" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Отвори тайното досие" })).toHaveCount(0);
        if (width < 1024) {
          await expect(dock).toHaveAttribute("data-expanded", "false");
          const chrome = await dock.evaluate((element) => {
            const style = getComputedStyle(element);
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 1;
            const context = canvas.getContext("2d")!;
            context.fillStyle = style.backgroundColor;
            context.fillRect(0, 0, 1, 1);
            return {
              background: style.backgroundColor,
              backgroundAlpha: context.getImageData(0, 0, 1, 1).data[3],
              opacity: Number(style.opacity),
              borders: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
              borderStyles: [style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle],
              topCorners: [style.borderTopLeftRadius, style.borderTopRightRadius],
            };
          });
          expect(chrome.backgroundAlpha, `Collapsed mobile dock chrome: ${JSON.stringify(chrome)}`).toBe(255);
          expect(chrome.opacity).toBe(1);
          expect(chrome.borders).toEqual(["1px", "1px", "1px", "1px"]);
          expect(chrome.borderStyles).toEqual(["solid", "solid", "solid", "solid"]);
          expect(chrome.topCorners).toEqual(["8px", "8px"]);
        }
        const heading = dock.locator(".play-action-dock-head h2");
        const headingBox = await heading.boundingBox();
        expect(headingBox!.width).toBeGreaterThan(100);
        expect(headingBox!.height).toBeGreaterThan(16);
        const seat = page.locator('.play-seat-slot[data-targetable="true"] button[data-seat-token]').first();
        await seat.click();
        await expect(seat).toHaveAttribute("aria-pressed", "true");
        if (width < 1024 && await dock.getAttribute("data-expanded") !== "true") {
          await dock.getByRole("button", { name: "Покажи личния ход" }).click();
        }
        const target = dock.getByRole("group", { name: "Избрана цел" });
        const confirm = dock.locator('[data-command-priority="primary"]').first();
        await expect(target).toHaveAttribute("data-selection-state", "ready");
        await expect(confirm).toBeEnabled();
        const targetBox = await target.boundingBox();
        const confirmBox = await confirm.boundingBox();
        expect(confirmBox!.y).toBeGreaterThanOrEqual(targetBox!.y + targetBox!.height);
        await confirm.click();
        await expect(target).toHaveAttribute("data-selection-state", "ready");
        await expect(dock.getByRole("button", { name: "Пропусни", exact: true })).toHaveAttribute("aria-pressed", "false");

        if (width > 1023) {
          const actionBox = await dock.getByRole("group", { name: "Текущо действие" }).boundingBox();
          expect(actionBox!.x).toBeGreaterThanOrEqual(stageBox.x + stageBox.width - 1);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        expect(errors).toEqual([]);
        const screenshot = testInfo.outputPath("command-hierarchy.png");
        await page.screenshot({ path: screenshot, fullPage: true });
        await testInfo.attach("command-hierarchy", { path: screenshot, contentType: "image/png" });

        if (width < 1024) {
          const details = card.locator("details").filter({ has: page.locator("summary", { hasText: "За ролята" }) });
          const result = card.getByRole("status", { name: "Личен резултат" });
          await expect(result).toBeVisible();
          await expect(details.getByRole("status")).toHaveCount(0);
          await details.locator(":scope > summary").click();
          await expect(result).toBeVisible();
          await details.locator(":scope > summary").click();
          await expect(result).toBeVisible();
        }
        await personal.getByRole("button", { name: "Скрий ролята", exact: true }).click();
        await expect(page.locator("[data-private-dossier], .role-card-result")).toHaveCount(0);
        await personal.getByRole("button", { name: "Виж ролята си", exact: true }).click();
        await expect(card).toBeVisible();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      });
    }
  }
}

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["dark", "light"] as const) {
    test(`desktop voting hierarchy and contrast ${family} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 900 });
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("werewolf-theme", selectedTheme);
      }, theme);
      await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=voting&players=10&voteTally=full`);
      await expect(page.locator(".play-stage")).toHaveAttribute("data-layout-ready", "true");
      const dock = page.locator(".play-action-dock");
      await dock.scrollIntoViewIfNeeded();
      const accessibility = await new AxeBuilder({ page }).include(".play-action-dock").withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(accessibility.violations).toEqual([]);
      await page.locator('.play-seat-slot[data-targetable="true"] button[data-seat-token]').first().click();
      const confirm = dock.getByRole("button", { name: /Потвърди гласа/ });
      await expect(confirm).toBeEnabled();
      await confirm.scrollIntoViewIfNeeded();
      const tally = dock.getByRole("region", { name: "Текущо броене на гласовете" });
      await expect(tally).not.toBeVisible();
      await dock.locator("summary", { hasText: "Преброяване" }).click();
      await expect(tally).toBeVisible();
      const targetBox = await dock.locator(".play-selected-target").boundingBox();
      const confirmBox = await confirm.boundingBox();
      const tallyBox = await tally.boundingBox();
      expect(confirmBox!.y).toBeGreaterThanOrEqual(targetBox!.y + targetBox!.height);
      expect(tallyBox!.y).toBeGreaterThanOrEqual(confirmBox!.y + confirmBox!.height);
    });
  }
}

for (const family of ["werewolves", "mafia"] as const) {
  test(`mobile vote tally opens inline ${family}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("werewolf-theme", "light");
    });
    await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=voting&players=10&voteTally=full&timer=90`);
    await expect(page.locator(".play-stage")).toHaveAttribute("data-layout-ready", "true");
    const dock = page.locator(".play-action-dock");
    await dock.getByRole("button", { name: "Покажи личния ход" }).click();
    const tally = dock.getByRole("region", { name: "Текущо броене на гласовете" });
    const summary = dock.locator("summary", { hasText: "Преброяване" });
    await expect(tally).not.toBeVisible();
    await summary.click();
    await expect(tally).toBeVisible();
    await tally.scrollIntoViewIfNeeded();
    await expect(tally).toBeInViewport();
    await summary.click();
    await expect(tally).not.toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}
