import { expect, test, type Page } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ contextOptions: { reducedMotion: "reduce", serviceWorkers: "block", deviceScaleFactor: 2 } });

async function openAccount(page: Page, theme: string, state = "") {
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("tutorial-completed", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
  await page.goto(`/account?visualAuth=1${state ? `&visualAccount=${state}` : ""}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Exercise the client before capturing: a screenshot must not race hydration.
  await page.getByRole("tab", { name: "Образ и достъп", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Име на масата", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Хроника", exact: true }).click();
  await page.evaluate(() => document.fonts.ready);
}

async function expectFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const clipped = await page.locator("main :is(h1,h2,h3,p,dt,dd,button,a,label,input)").evaluateAll((elements) => elements
    .filter((element) => element.getClientRects().length > 0)
    .filter((element) => {
      const box = element.getBoundingClientRect();
      // Root overflow clipping can hide elements without increasing scrollWidth.
      return box.left < -1 || box.right > document.documentElement.clientWidth + 1
        || (!(element instanceof HTMLInputElement) && element.scrollWidth > element.clientWidth + 2);
    })
    .map((element) => element.textContent));
  expect(clipped).toEqual([]);
}

for (const theme of ["dark", "light"] as const) {
  for (const width of [320, 390, 768, 1440]) {
    test(`account collection ${theme} ${width}: real relics, readable layout and focus`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 960 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await openAccount(page, theme);
      const relics = page.getByRole("list", { name: "Спечелени легенди" }).locator("img");
      await expect(relics).toHaveCount(3);
      for (const relic of await relics.all()) {
        await relic.scrollIntoViewIfNeeded();
        await expect.poll(() => relic.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
        const quality = await relic.evaluate(async (image: HTMLImageElement) => {
          // naturalWidth is density-corrected for srcset; inspect the actual delivered pixels.
          const response = await fetch(image.currentSrc, {
            headers: { Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.5" },
          });
          if (!response.ok) throw new Error(`Image ${response.status}: ${image.currentSrc}`);
          const bitmap = await createImageBitmap(await response.blob());
          const box = image.getBoundingClientRect();
          const result = {
            pixels: bitmap.width,
            required: Math.min(box.width, box.height * bitmap.width / bitmap.height) * devicePixelRatio,
            src: image.currentSrc,
          };
          bitmap.close();
          return result;
        });
        expect(decodeURIComponent(quality.src)).toContain("/game-art/achievements/relics/");
        expect(quality.pixels).toBeGreaterThanOrEqual(Math.floor(quality.required));
      }
      await expectFits(page);
      const link = page.getByRole("link", { name: "Виж всички легенди", exact: true });
      await expect(link).toHaveAttribute("href", "/achievements");
      await page.getByRole("tab", { name: "Хроника", exact: true }).focus();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("tabpanel", { name: "Хроника" })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(link).toBeFocused();
      expect(await link.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
      if (width === 390) expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await testInfo.attach(`account-${theme}-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      expect(errors).toEqual([]);
    });
  }

  for (const state of ["empty", "unavailable", "complete"]) {
    test(`account collection ${theme} ${state}: states stay distinct`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openAccount(page, theme, state);
      if (state === "empty") {
        await expect(page.getByText("Легендите още не са започнали.")).toBeVisible();
        await expect(page.getByRole("img", { name: "Заключена легенда: Спасител" })).toHaveCount(1);
        await expect(page.getByRole("list", { name: "Спечелени легенди" })).toHaveCount(0);
      } else if (state === "unavailable") {
        await expect(page.getByRole("tabpanel", { name: "Хроника" }).getByRole("alert")).toContainText("Игровите записи не са достъпни");
        await expect(page.getByRole("heading", { name: "Легенди", exact: true })).toHaveCount(0);
        await expect(page.getByText(/легенди отключени/)).toHaveCount(0);
      } else {
        await expect(page.getByText("7 от 7 легенди отключени.")).toBeVisible();
        await expect(page.getByRole("list", { name: "Спечелени легенди" }).locator("img")).toHaveCount(3);
        await expect(page.getByText(/чакат своята вечер/)).toHaveCount(0);
      }
      await expectFits(page);
      expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
      await testInfo.attach(`account-${theme}-${state}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    });
  }

  for (const browserName of ["chromium", "webkit"] as const) {
    test.describe(`account collection ${browserName} ${theme}`, () => {
      for (const width of [320, 390]) {
        for (const state of ["", "long"]) {
          test(`${width} ${state || "default"}: 200% text stays visible and numbers stay whole`, async ({ playwright, baseURL }, testInfo) => {
            const browser = await playwright[browserName].launch();
            try {
              const page = await browser.newPage({ baseURL: baseURL ?? "http://127.0.0.1:3000", viewport: { width, height: 900 }, reducedMotion: "reduce", serviceWorkers: "block", deviceScaleFactor: 2 });
              const errors: string[] = [];
              page.on("pageerror", (error) => errors.push(error.message));
              await openAccount(page, theme, state);
              await expectFits(page);
              await page.evaluate(() => {
                const styles = Array.from(document.querySelectorAll<HTMLElement>("main *"))
                  .map((element) => ({ element, size: parseFloat(getComputedStyle(element).fontSize) }));
                for (const { element, size } of styles) element.style.fontSize = `${size * 2}px`;
              });
              const numbers = page.getByRole("definition");
              await expect(numbers).toHaveCount(3);
              const splitNumbers = await numbers.evaluateAll((elements) => elements.filter((element) => {
                const range = document.createRange();
                range.selectNodeContents(element);
                return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size > 1;
              }).map((element) => element.textContent));
              expect.soft(splitNumbers).toEqual([]);
              for (const tab of ["Хроника", "Образ и достъп", "Данни и сигурност"]) {
                await page.getByRole("tab", { name: tab, exact: true }).click();
                await expect(page.getByRole("tabpanel", { name: tab, exact: true })).toBeVisible();
                await expectFits(page);
              }
              await page.getByRole("tab", { name: "Хроника", exact: true }).click();
              await expect(page.getByRole("heading", { level: 1 })).toHaveText(state === "long" ? "Александра Константинополска" : "Визуален играч");
              await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
              await testInfo.attach(`account-${browserName}-${theme}-${width}-${state || "default"}-large-text`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
              expect(errors).toEqual([]);
            } finally {
              await browser.close();
            }
          });
        }
      }
    });
  }
}
