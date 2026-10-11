import { expect, test, type Locator, type Page } from "playwright/test";

test.use({ contextOptions: { reducedMotion: "reduce", serviceWorkers: "block" } });

async function prepare(page: Page, theme: "light" | "dark") {
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
}

async function expectContained(page: Page, root: Locator) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  const overflow = await root.evaluate((root) => {
    const bounds = root.getBoundingClientRect();
    return [...root.querySelectorAll<HTMLElement>("h1, h2, p, button, a, select, label, legend")].flatMap((node) => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height || getComputedStyle(node).position === "absolute") return [];
      return rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || node.scrollWidth > node.clientWidth + 1
        ? [node.textContent?.trim()] : [];
    });
  });
  expect(overflow).toEqual([]);
}

async function expectSeparate(first: Locator, second: Locator) {
  const a = await first.boundingBox();
  const b = await second.boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  const overlapX = Math.min(a!.x + a!.width, b!.x + b!.width) - Math.max(a!.x, b!.x);
  const overlapY = Math.min(a!.y + a!.height, b!.y + b!.height) - Math.max(a!.y, b!.y);
  expect(overlapX <= 1 || overlapY <= 1).toBe(true);
}

for (const theme of ["light", "dark"] as const) {
  for (const { width, textScale } of [
    { width: 320, textScale: 100 }, { width: 390, textScale: 100 },
    { width: 320, textScale: 200 }, { width: 1440, textScale: 100 },
  ]) {
    test(`tutorial composition ${theme} ${width} text ${textScale}%`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await prepare(page, theme);
      await page.goto("/tutorial?step=2&game=werewolves_classic&redirect=%2Fmafia%2Fjoin%2FABC123#invite");
      await page.addStyleTag({ content: `html { font-size: ${textScale}% !important; }` });
      await page.evaluate(() => document.fonts.ready);
      const gameSelect = page.getByRole("combobox", { name: "Игра", exact: true });
      const sceneSelect = page.getByRole("combobox", { name: "Сцена", exact: true });
      for (const game of ["werewolves_classic", "mafia_free", "mafia_sport"]) {
        await expect(gameSelect).toBeEnabled();
        await gameSelect.selectOption(game);
        for (const scene of [2, 4]) {
          if (width < 640) await sceneSelect.selectOption(String(scene));
          else await page.getByRole("button", { name: scene === 2 ? "2. Нощ" : "4. Глас", exact: true }).click();
          await expect(page.locator(".tutorial-practice")).toBeVisible();
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(scene === 2 ? "Очите се затварят." : "Гласът оставя следа.");
          await expectContained(page, page.locator(".tutorial-flipbook"));
          await expectSeparate(page.locator(".tutorial-edition-kicker"), gameSelect);
          await expectSeparate(page.locator(".tutorial-edition p"), gameSelect);
          if (width < 640) {
            await expectSeparate(sceneSelect, page.locator(".tutorial-skip-link"));
            expect((await sceneSelect.boundingBox())!.height).toBeGreaterThanOrEqual(44);
            await expect(page.locator(".tutorial-progress-dots")).toBeHidden();
          }
          if (width === 390) {
            await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
            const art = (await page.locator(".tutorial-slide-art").boundingBox())!;
            expect(art.y).toBeLessThanOrEqual(230);
            expect(art.height).toBeGreaterThanOrEqual(90);
            expect(art.height).toBeLessThanOrEqual(150);
            const action = (await page.locator(".tutorial-practice button[type=submit]").boundingBox())!;
            expect(action.y + action.height).toBeLessThanOrEqual(844);
          }
          await expect(page.getByRole("link", { name: "Към поканата" })).toHaveAttribute("href", "/mafia/join/ABC123");
          expect(new URL(page.url()).hash).toBe("#invite");
        }
      }
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: info.outputPath("tutorial-composition.png"), animations: "disabled", style: "nextjs-portal { display: none; }" });
    });

    test(`achievement relic composition ${theme} ${width} text ${textScale}%`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await prepare(page, theme);
      await page.goto("/achievements?visualAuth=1&visualAchievements=fixture");
      await page.addStyleTag({ content: `html { font-size: ${textScale}% !important; }` });
      await page.evaluate(() => document.fonts.ready);
      const shell = page.locator(".achievement-shell");
      await expectContained(page, shell);
      const feature = page.locator('.achievement-feature[data-locked="false"]');
      await expect(feature).toHaveCount(1);
      await expect(page.locator('.achievement-plaque[data-locked="false"]')).toHaveCount(3);
      await expect(page.locator('.achievement-plaque[data-locked="true"]')).toHaveCount(3);
      await expect(page.locator(".achievement-progress")).toHaveText("4 от 7 отключени");
      const featuredId = await feature.getAttribute("data-achievement-id");
      expect(featuredId).toBeTruthy();
      await expect(page.locator(`.plaque-wall [data-achievement-id="${featuredId}"]`)).toHaveCount(0);
      const featureImages = feature.locator(".achievement-feature-art img");
      await expect(featureImages).toHaveCount(2);
      for (const featureImage of await featureImages.all()) {
        await featureImage.scrollIntoViewIfNeeded();
        await featureImage.evaluate((node) => (node as HTMLImageElement).decode());
        expect(await featureImage.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      }
      const plaques = page.locator(".achievement-plaque");
      for (const plaque of await plaques.all()) {
        const art = plaque.locator(".achievement-plaque-art");
        const image = art.locator("img");
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((node) => (node as HTMLImageElement).decode());
        expect(await image.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await expect(image).toHaveAttribute("alt", "");
        expect(Math.round((await art.boundingBox())!.width * 100) / 100).toBeGreaterThanOrEqual(80);
        await expectSeparate(art, plaque.getByRole("heading", { level: 3 }));
        await expect(plaque.locator(".achievement-plaque-tier")).toHaveText(/Бронз|Сребро|Злато/);
        expect(await plaque.locator(".achievement-plaque-inner").evaluate((node) => getComputedStyle(node).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
      }
      await expectContained(page, shell);
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: info.outputPath("achievement-relic-composition.png"), animations: "disabled", style: "nextjs-portal { display: none; }" });
    });
  }
}
