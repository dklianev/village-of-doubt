import sharp from "sharp";
import { expect, test, type Locator, type Page } from "playwright/test";
import { expectDecodedImage } from "./image-readiness";

test.use({ trace: "retain-on-failure" });

async function prepare(page: Page, theme: "dark" | "light") {
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem("werewolf-theme", selectedTheme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && /game-art|\/_next\/image/.test(response.url())) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  return errors;
}

async function expectCoverDensity(image: Locator) {
  await image.scrollIntoViewIfNeeded();
  const pixels = await image.evaluate(async (element) => {
    const img = element as HTMLImageElement;
    await img.decode();
    const response = await fetch(img.currentSrc, { headers: { Accept: "image/webp" } });
    const bitmap = await createImageBitmap(await response.blob());
    const box = img.getBoundingClientRect();
    const result = {
      width: bitmap.width,
      required: Math.max(box.width, box.height * bitmap.width / bitmap.height) * devicePixelRatio,
      src: img.currentSrc,
    };
    bitmap.close();
    return result;
  });
  expect.soft(pixels.width, JSON.stringify(pixels)).toBeGreaterThanOrEqual(Math.floor(pixels.required) - 2);
}

async function expectTextContrast(page: Page, text: Locator, minimum: number) {
  await text.scrollIntoViewIfNeeded();
  const box = (await text.boundingBox())!;
  const foreground = await text.evaluate((element) => {
    const color = getComputedStyle(element).color.match(/[\d.]+/g)!.map(Number);
    (element as HTMLElement).style.visibility = "hidden";
    return color;
  });
  let screenshot: Buffer;
  try {
    // Hiding only the glyphs leaves the actual artwork and scrim behind the text.
    screenshot = await page.screenshot({ clip: box, animations: "disabled" });
  } finally {
    await text.evaluate((element) => (element as HTMLElement).style.removeProperty("visibility"));
  }
  const { data, info } = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const luminance = (rgb: number[]) => rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  const ratios: number[] = [];
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const background = [data[offset]!, data[offset + 1]!, data[offset + 2]!];
    const alpha = foreground[3] ?? 1;
    const ink = foreground.slice(0, 3).map((value, index) => value * alpha + background[index]! * (1 - alpha));
    const a = luminance(ink);
    const b = luminance(background);
    ratios.push((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
  }
  ratios.sort((a, b) => a - b);
  // Ignore isolated grain highlights, but require AA across 99% of the text box.
  expect.soft(ratios[Math.floor(ratios.length * 0.01)], (await text.textContent()) ?? undefined).toBeGreaterThanOrEqual(minimum);
}

for (const theme of ["dark", "light"] as const) {
  for (const width of [390, 1440]) {
    test.describe(`non-play artwork ${theme} ${width}`, () => {
      test.use({ viewport: { width, height: 900 }, deviceScaleFactor: 2, colorScheme: theme, contextOptions: { reducedMotion: "reduce" } });

      for (const family of ["werewolf", "mafia"] as const) {
        test(`${family} cycle supplies sharp cover pixels`, async ({ page }, info) => {
          const errors = await prepare(page, theme);
          await page.goto(`/${family}`);
          const cycle = page.locator(".night-timeline");
          await expect(cycle.locator("img")).toHaveCount(3);
          for (const image of await cycle.locator("img").all()) await expectCoverDensity(image);
          await cycle.screenshot({ path: info.outputPath("cycle.png") });
          await cycle.getByRole("link").click();
          await expect(page).toHaveURL(new RegExp(`/${family}/rules$`));
          expect(errors).toEqual([]);
        });

        test(`${family} rules retain readable art and phase selection`, async ({ page }, info) => {
          const errors = await prepare(page, theme);
          await page.goto(`/${family}/rules`);
          await page.evaluate(() => document.fonts.ready);
          await expect(page.locator("main h1")).toBeVisible();
          const cards = page.locator(".phase-node");
          await expect(cards).toHaveCount(6);
          for (const card of await cards.all()) {
            await card.scrollIntoViewIfNeeded();
            await expectDecodedImage(card.locator("img"));
          }
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: info.outputPath("rules-hero.png"), animations: "disabled" });
          const hero = page.locator(".rules-playbook-hero");
          await expectTextContrast(page, hero.locator("h1"), 3);
          await expectTextContrast(page, hero.locator("p:not(.section-kicker)"), 4.5);
          await page.locator(".phase-timeline").screenshot({ path: info.outputPath("rules-phases.png") });
          for (const card of await cards.all()) {
            await expectTextContrast(page, card.locator(".phase-node-label"), 3);
            await expectTextContrast(page, card.locator(".phase-node-short"), 4.5);
          }
          await cards.last().click();
          await expect(cards.last()).toHaveAttribute("aria-pressed", "true");
          await expect(page.locator("#phase-detail-panel h3")).toContainText(family === "mafia" ? "Присъда" : "Развръзка");
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
          expect(errors).toEqual([]);
        });
      }

      test("tutorial scenes keep artwork continuous and copy readable", async ({ page }, info) => {
        const errors = await prepare(page, theme);
        await page.goto("/tutorial?step=1");
        await page.evaluate(() => document.fonts.ready);
        const stage = page.locator(".tutorial-slide-stage");
        for (let step = 1; step <= 6; step++) {
          await expect(stage).toHaveAttribute("aria-label", new RegExp(`^Сцена ${step}:`));
          await expect(stage.locator("h1")).toBeVisible();
          await stage.screenshot({ path: info.outputPath(`tutorial-${step}.png`) });
          await expectTextContrast(page, stage.locator("h1"), 3);
          for (const paragraph of await stage.locator(".tutorial-slide-body p").all()) {
            await expectTextContrast(page, paragraph, 4.5);
          }
          if (width === 390 && [4, 5].includes(step)) {
            const covers = await stage.locator(".tutorial-slide").evaluate(async (element) => {
              const style = getComputedStyle(element);
              if (style.backgroundSize === "cover") return true;
              const image = new Image();
              image.src = style.backgroundImage.match(/url\(["']?([^"')]+)/)![1]!;
              await image.decode();
              const box = element.getBoundingClientRect();
              return box.width * parseFloat(style.backgroundSize) / 100 * image.naturalHeight / image.naturalWidth >= box.height;
            });
            expect.soft(covers, `scene ${step}: landscape zoom must cover the tall mobile stage`).toBe(true);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
          if (step < 6) await page.getByRole("button", { name: "Следваща сцена" }).click();
        }
        await expect(page.getByRole("link", { name: "Продължи към игра", exact: true })).toBeVisible();
        expect(errors).toEqual([]);
      });
    });
  }
}
