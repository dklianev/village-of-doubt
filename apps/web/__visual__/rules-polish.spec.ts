import { expect, test, type Locator, type Page } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ contextOptions: { reducedMotion: "reduce", serviceWorkers: "block" } });

async function openRules(page: Page, family: "werewolf" | "mafia", theme: "light" | "dark") {
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
    localStorage.setItem("tutorial-completed", "1");
  }, theme);
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  await page.goto(`/${family}/rules`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(family === "mafia" ? "Мафия" : "Върколак");
  await page.evaluate(() => document.fonts.ready);
}

async function expectVisibleFocus(target: Locator) {
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport({ ratio: 1 });
  expect((await target.boundingBox())!.y).toBeGreaterThanOrEqual(64);
  expect(await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return element.matches(":focus-visible") && style.outlineStyle === "solid" && parseFloat(style.outlineWidth) >= 2;
  })).toBe(true);
}

for (const family of ["werewolf", "mafia"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`rules keyboard continuation ${family} ${theme} 768x700`, async ({ page }, info) => {
      await page.setViewportSize({ width: 768, height: 700 });
      await openRules(page, family, theme);
      const buttons = page.locator(".phase-node");
      const heading = page.locator("#phase-detail-title");
      await buttons.first().focus();
      for (let index = 0; index < 3; index++) await page.keyboard.press("Tab");
      await expect(buttons.nth(3)).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(buttons.nth(3)).toHaveAttribute("aria-pressed", "true");
      await expectVisibleFocus(heading);
      const screenshot = info.outputPath("keyboard-focus.png");
      await page.screenshot({ path: screenshot });
      await info.attach("keyboard-focus", { path: screenshot, contentType: "image/png" });

      await page.keyboard.press("Shift+Tab");
      await expectVisibleFocus(buttons.last());
      await page.keyboard.press("Space");
      await expect(buttons.last()).toHaveAttribute("aria-pressed", "true");
      await expectVisibleFocus(heading);
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Shift+Tab");
      await expectVisibleFocus(buttons.nth(4));
      await page.keyboard.press("Enter");
      await expect(buttons.nth(4)).toHaveAttribute("aria-pressed", "true");
      await expectVisibleFocus(heading);
      await page.keyboard.press("Tab");
      const previous = page.getByRole("button", { name: "Предишна фаза" });
      await expectVisibleFocus(previous);
      await page.keyboard.press("Enter");
      await expect(buttons.nth(3)).toHaveAttribute("aria-pressed", "true");
      await expectVisibleFocus(heading);
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await expectVisibleFocus(page.getByRole("button", { name: "Следваща фаза" }));
      await page.keyboard.press("Enter");
      await expect(buttons.nth(4)).toHaveAttribute("aria-pressed", "true");
      await expectVisibleFocus(heading);
    });

    for (const width of [320, 390, 768, 1440]) {
      test(`rules reading flow ${family} ${theme} ${width}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await openRules(page, family, theme);
        const objective = await page.locator("#rules-objective").boundingBox();
        const phases = await page.locator("#rules-phases").boundingBox();
        expect(objective!.y).toBeLessThan(phases!.y);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const objectiveText = await page.locator("#rules-objective header").boundingBox();
        expect(objectiveText!.x).toBeGreaterThanOrEqual(18);
        await page.screenshot({ path: info.outputPath("first-screen.png") });
        await info.attach("first-screen", { path: info.outputPath("first-screen.png"), contentType: "image/png" });
        const basics = await page.locator("#rules-basics").boundingBox();
        const details = await page.locator("#rules-details").boundingBox();
        expect(basics!.y).toBeGreaterThan(objective!.y);
        expect(basics!.y).toBeLessThan(phases!.y);
        expect(details!.y).toBeGreaterThan(phases!.y);
        if (width <= 760) {
          expect(await page.locator(".rules-contents").evaluate((node) => getComputedStyle(node).position)).toBe("sticky");
        }

        await page.getByRole("link", { name: "Ход на играта", exact: true }).click();
        await expect(page.locator("#phase-timeline-title")).toBeInViewport();
        const buttons = page.locator(".phase-node");
        for (const index of [2, 5, 0]) {
          const button = buttons.nth(index);
          await button.click();
          await expect(button).toHaveAttribute("aria-pressed", "true");
          await expect(page.locator("#phase-detail-title")).toBeInViewport();
          expect((await page.locator("#phase-detail-title").boundingBox())!.y).toBeGreaterThanOrEqual(64);
        }
        await buttons.nth(4).focus();
        await page.keyboard.press("Enter");
        await expect(buttons.nth(4)).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator("#phase-detail-title")).toHaveText(family === "mafia" ? "Гласуване Обвинение" : "Гласуване");
        await expectVisibleFocus(page.locator("#phase-detail-title"));
        await expect(page.locator(".phase-player-action")).toContainText("Избери жив играч");
        if (family === "mafia") await expect(page.locator(".phase-detail-flavor")).toHaveText("Обвинение");
        if (width <= 760) {
          const contents = await page.locator(".rules-contents").boundingBox();
          const heading = await page.locator("#phase-detail-title").boundingBox();
          expect(heading!.y).toBeGreaterThanOrEqual(contents!.y + contents!.height);
        }
        if (width > 760) {
          const art = page.locator(".phase-detail-art img");
          await art.scrollIntoViewIfNeeded();
          await art.evaluate((element) => (element as HTMLImageElement).decode());
          const delivery = await art.evaluate(async (element) => {
            const image = element as HTMLImageElement;
            const bitmap = await createImageBitmap(await (await fetch(image.currentSrc)).blob());
            const box = image.getBoundingClientRect();
            const requiredWidth = Math.min(
              Math.max(box.width, box.height * bitmap.width / bitmap.height) * devicePixelRatio,
              Number(image.getAttribute("width")),
            );
            const result = { decodedWidth: bitmap.width, requiredWidth };
            bitmap.close();
            return result;
          });
          expect(delivery.decodedWidth).toBeGreaterThanOrEqual(delivery.requiredWidth - 2);
        }
        if (width === 390) expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
        await page.screenshot({ path: info.outputPath("selected-phase.png") });
        await info.attach("selected-phase", { path: info.outputPath("selected-phase.png"), contentType: "image/png" });
        await page.getByRole("button", { name: "Следваща фаза" }).click();
        await expect(page.locator("#phase-detail-title")).toHaveText(family === "mafia" ? "Развръзка Присъда" : "Развръзка");
        await expect(page.getByRole("button", { name: "Следваща фаза" })).toBeDisabled();
        await page.getByRole("button", { name: "Предишна фаза" }).click();
        await expect(page.locator("#phase-detail-title")).toHaveText(family === "mafia" ? "Гласуване Обвинение" : "Гласуване");
        await page.getByRole("link", { name: "Особености", exact: true }).click();
        await expect(page.locator("#rules-details h2").first()).toBeInViewport();
        await expect(page.getByRole("link", { name: "Кратък наръчник" })).toHaveAttribute("href", `/tutorial?game=${family === "mafia" ? "mafia_free" : "werewolves_classic"}&redirect=%2F${family}%2Fcreate`);
        expect(errors).toEqual([]);
      });
    }
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 768, 1440]) {
    test(`sport Mafia flow ${theme} ${width}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await openRules(page, "mafia", theme);
      await page.getByRole("radio", { name: "Спортна", exact: true }).check();
      await expect(page.locator(".phase-node")).toHaveCount(8);
      await expect(page.getByRole("link", { name: "Наръчник за спортна Мафия" })).toHaveAttribute("href", "/tutorial?game=mafia_sport&redirect=%2Fmafia%2Fcreate%3Fmode%3Dmafia_sport");
      await page.locator('[data-phase="night"]').click();
      await expect(page.locator("#phase-detail-panel")).toContainText("няма Доктор");
      await page.getByRole("button", { name: "Следваща фаза" }).click();
      await expect(page.locator("#phase-detail-title")).toHaveText("Дневни речи Речи на масата");
      await expect(page.locator("#phase-detail-panel")).toContainText("Само текущият говорител може да номинира");
      await page.getByRole("button", { name: "Следваща фаза" }).click();
      await expect(page.locator("#phase-detail-title")).toHaveText("Номинации");
      await expect(page.locator("#phase-detail-panel")).toContainText("Тук не се подават нови");
      await expect(page.locator("#phase-detail-panel")).toContainText("без защити и гласуване");
      await page.getByRole("button", { name: "Следваща фаза" }).click();
      await expect(page.locator("#phase-detail-title")).toHaveText("Защита");
      await page.getByRole("button", { name: "Следваща фаза" }).click();
      await expect(page.locator("#phase-detail-panel")).toContainText("няма пропускане на вот");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 390) expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
      await page.screenshot({ path: info.outputPath("sport-voting.png") });
      await info.attach("sport-voting", { path: info.outputPath("sport-voting.png"), contentType: "image/png" });
      await page.getByRole("button", { name: "Предишна фаза" }).click();
      await page.getByRole("radio", { name: "Свободна", exact: true }).check();
      await expect(page.locator(".phase-node")).toHaveCount(6);
      await expect(page.locator("#phase-detail-title")).toHaveText("Дневно обсъждане Градът говори");
      await expect(page.locator('[data-phase="nomination"]')).toHaveCount(0);
      await expect(page.locator('[data-phase="defense"]')).toHaveCount(0);
    });
  }
}
