import { expect, test, type Locator, type Page } from "playwright/test";
import { expectDecodedImage } from "./image-readiness";

test.use({ trace: "retain-on-failure" });

const viewports = [
  { width: 390 },
  { width: 820 },
  { width: 1080 },
  { width: 1920 },
];

async function prepare(page: Page, theme: "light" | "dark") {
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
    localStorage.setItem("werewolf-theme", selectedTheme);
  }, theme);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydrat|quality.*not configured/i.test(message.text())) errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && /game-art|\/_next\/image/.test(response.url())) {
      errors.push(`Image ${response.status()}: ${response.url()}`);
    }
  });
  return errors;
}

async function decodedPixels(image: Locator) {
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((node) => {
    const img = node as HTMLImageElement;
    return { selected: Boolean(img.currentSrc), src: img.getAttribute("src"), complete: img.complete,
      box: img.getBoundingClientRect().toJSON(), parentDisplay: getComputedStyle(img.parentElement!).display };
  })).toMatchObject({ selected: true });
  await expectDecodedImage(image);
  return image.evaluate(async (node) => {
    const element = node as HTMLImageElement;
    const currentSrc = element.currentSrc;
    // Match an image request; fetch's */* would negotiate a different fallback format.
    const response = await fetch(currentSrc, {
      headers: { Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.5" },
    });
    if (!response.ok) throw new Error(`Image ${response.status}: ${currentSrc}`);
    // Decode the response bytes: naturalWidth and the requested w can hide an undersized master.
    const bitmap = await createImageBitmap(await response.blob());
    const box = element.getBoundingClientRect();
    const result = {
      currentSrc,
      width: bitmap.width,
      height: bitmap.height,
      cssWidth: box.width,
      cssHeight: box.height,
      contentType: response.headers.get("content-type"),
    };
    bitmap.close();
    return result;
  });
}

function expectDensity(pixels: Awaited<ReturnType<typeof decodedPixels>>, dpr: number, nativeWidth: number) {
  // Cover can require more pixels than the element's width when it crops the sides.
  const coverWidth = Math.max(pixels.cssWidth, pixels.cssHeight * pixels.width / pixels.height);
  const required = Math.min(coverWidth * dpr, nativeWidth);
  expect(pixels.contentType).toContain("image/webp");
  expect(pixels.width, JSON.stringify(pixels)).toBeGreaterThanOrEqual(Math.floor(required) - 1);
  expect(pixels.width, "avoid oversized downloads at low DPR").toBeLessThanOrEqual(Math.ceil(Math.min(required * 1.55, nativeWidth)));
}

for (const theme of ["light", "dark"] as const) {
  for (const dpr of [1, 2, 3]) {
    for (const viewport of viewports) {
      test.describe(`${theme} ${viewport.width}px DPR ${dpr}`, () => {
        // Each test gets a fresh context; cached large candidates cannot mask selection regressions.
        test.use({ viewport: { width: viewport.width, height: 1000 }, deviceScaleFactor: dpr, colorScheme: theme });

        for (const family of ["werewolf", "mafia"]) {
          test(`${family} grid, dossier and phase board receive real responsive pixels`, async ({ page }, info) => {
            const errors = await prepare(page, theme);
            await page.goto(`/${family}/roles`);
            await page.evaluate(() => document.fonts.ready);
            await expect(page.locator("main h1")).toContainText(family === "mafia" ? "Мафия" : "Върколак");
            const grid = page.locator(".role-codex-card img").first();
            const gridPixels = await decodedPixels(grid);
            const slot = (await grid.locator("..").boundingBox())!;
            expect(Math.abs(gridPixels.cssWidth - slot.width)).toBeLessThan(1);
            expect(gridPixels.cssWidth / gridPixels.cssHeight).toBeCloseTo(2 / 3, 2);
            expectDensity(gridPixels, dpr, 1024);
            const original = new URL(gridPixels.currentSrc).searchParams.get("url");
            expect(original).toMatch(/\/role-.*\.webp\?v=3$/);
            expect(original).not.toContain("/thumbs/");
            expect(new URL(gridPixels.currentSrc).searchParams.get("q")).toBe("85");

            await page.locator(".role-codex-card-button").first().click();
            await expect(page.getByRole("dialog")).toBeVisible();
            const detailPixels = await decodedPixels(page.getByRole("dialog").locator("img"));
            expect(detailPixels.cssWidth).toBeCloseTo(viewport.width < 760 ? Math.min(210, viewport.width * 0.58) : 300, 0);
            expectDensity(detailPixels, dpr, 1024);
            expect(new URL(detailPixels.currentSrc).searchParams.get("url")).toBe(original);
            await info.attach("decoded-pixels", { body: JSON.stringify({ grid: gridPixels, detail: detailPixels }), contentType: "application/json" });
            if (dpr === 2 && [390, 1920].includes(viewport.width)) {
              await info.attach("dossier", { body: await page.screenshot(), contentType: "image/png" });
            }
            await page.keyboard.press("Escape");
            await expect(page.getByRole("dialog")).toHaveCount(0);

            await page.goto(`/${family}/rules`);
            await page.evaluate(() => document.fonts.ready);
            const phase = page.locator(".phase-node").first();
            await phase.scrollIntoViewIfNeeded();
            const phasePixels = await decodedPixels(phase.locator("img"));
            expectDensity(phasePixels, dpr, 1120);
            expect(phasePixels.width / phasePixels.height).toBeCloseTo(1.4, 2);
            expect(new URL(phasePixels.currentSrc).searchParams.get("url")).toMatch(/\/phase-board\/v1\/.*-1120\.webp$/);
            expect(new URL(phasePixels.currentSrc).searchParams.get("q")).toBe("85");
            await info.attach("phase-decoded-pixels", { body: JSON.stringify(phasePixels), contentType: "application/json" });
            await page.locator(".phase-node").nth(1).click();
            await expect(page.locator(".phase-node").nth(1)).toHaveAttribute("aria-pressed", "true");
            expect(errors).toEqual([]);
          });
        }
      });
    }

    for (const width of [...viewports.map((viewport) => viewport.width), 640]) {
      test.describe(`${theme} ${width}px DPR ${dpr}`, () => {
        test.use({ viewport: { width, height: 1000 }, deviceScaleFactor: dpr, colorScheme: theme });
        test("homepage preserves the selected scenes without fetching the hidden theme", async ({ page }, info) => {
          const errors = await prepare(page, theme);
          const requests: string[] = [];
          page.on("request", (request) => {
            if (/choice-(werewolf|mafia)-/.test(request.url())) requests.push(request.url());
          });
          await page.goto("/");
          await page.evaluate(() => document.fonts.ready);
          await expect(page.locator("main h1")).toBeVisible();
          for (const family of ["werewolf", "mafia"]) {
            const card = page.locator(`.game-choice-${family}`);
            const image = card.locator(`.game-choice-art--${theme} img`);
            const pixels = await decodedPixels(image);
            expectDensity(pixels, dpr, 1536);
            if (width === 640) {
              expect(Math.abs(pixels.cssWidth - 602)).toBeLessThan(1);
              if (dpr === 2) expect(pixels.width).toBeGreaterThanOrEqual(1204);
              if (dpr === 3) expect(pixels.width).toBe(1536);
            }
            const version = family === "werewolf" ? "v7" : "v5";
            expect(new URL(pixels.currentSrc).searchParams.get("url")).toBe(
              `/game-art/homepage/choice-${family}-${theme}-${version}.webp`,
            );
            expect(new URL(pixels.currentSrc).searchParams.get("q")).toBe("85");
            const titleBox = (await card.getByRole("heading", { level: 2 }).boundingBox())!;
            const artBox = (await image.boundingBox())!;
            expect(titleBox.y).toBeGreaterThanOrEqual(artBox.y + artBox.height - 1);
            await info.attach(`${family}-decoded-pixels`, { body: JSON.stringify(pixels), contentType: "application/json" });
          }
          expect(requests.length).toBeGreaterThanOrEqual(2);
          const hidden = theme === "dark" ? "light" : "dark";
          expect(requests.filter((url) => new RegExp(`choice-(werewolf|mafia)-${hidden}-`).test(url))).toEqual([]);
          if (dpr === 2 && [390, 640, 1920].includes(width)) {
            await info.attach("homepage", { body: await page.screenshot(), contentType: "image/png" });
          }
          await page.locator(".game-choice-werewolf").getByRole("link", { name: "Роли", exact: true }).click();
          await expect(page).toHaveURL(/\/werewolf\/roles$/);
          expect(errors).toEqual([]);
        });
      });
    }
  }
}
