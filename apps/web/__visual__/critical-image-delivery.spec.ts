import { expect, test } from "playwright/test";
import sharp from "sharp";
import { resolve } from "node:path";

const profiles = [
  { width: 390, deviceScaleFactor: 1.75 },
  { width: 390, deviceScaleFactor: 3 },
  { width: 1440, deviceScaleFactor: 1 },
];

for (const profile of profiles) {
  test.describe(`critical image delivery ${profile.width} ${profile.deviceScaleFactor}x`, () => {
    test.use({ viewport: { width: profile.width, height: 900 }, deviceScaleFactor: profile.deviceScaleFactor });
    for (const theme of ["light", "dark"] as const) {
      test(`keeps the crop sharp and downloads one matching candidate in ${theme}`, async ({ page }, info) => {
        await page.emulateMedia({ colorScheme: theme === "light" ? "dark" : "light", reducedMotion: "reduce" });
        await page.addInitScript((theme) => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("welcome-modal-shown", "1");
        }, theme);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        for (const [route, selector] of [
          ["/werewolf", ".game-home-hero__art"],
          ["/mafia", ".game-home-hero__art"],
          ["/werewolf/rules", ".rules-hero-art"],
          ["/mafia/rules", ".rules-hero-art"],
          ["/tutorial", ".tutorial-slide-art"],
          ["/faq", ".faq-hearth-banner"],
          ["/sign-in", ".sign-in-art"],
        ]) {
          const images = new Set<string>();
          const onResponse = (response: import("playwright/test").Response) => {
            const pathname = new URL(response.url()).pathname;
            if (pathname.startsWith("/game-art/")) {
              expect(response.status(), pathname).toBeLessThan(400);
              images.add(pathname);
            }
          };
          page.on("response", onResponse);
          await page.goto(route!);
          await expect(page.locator(`${selector}:visible`)).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          const painted = await page.locator(`${selector}:visible`).evaluate((element) => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return { width: box.width, height: box.height, background: style.backgroundImage };
          });
          const candidates = [...painted.background.matchAll(/url\("[^"?]*\/game-art\/([^"?]+)(?:\?[^" ]*)?"\)/g)]
            .map((match) => `/game-art/${match[1]}`);
          const avif = candidates.find((candidate) => candidate.endsWith(".avif"))!;
          await expect.poll(() => images.has(avif), { message: `${route}: selected AVIF must load` }).toBe(true);
          const metadata = await sharp(resolve(import.meta.dirname, "../public", avif.slice(1))).metadata();
          const familyHero = /rules|werewolf$|mafia$/.test(route!);
          const nativePortrait = profile.width <= 480 && profile.deviceScaleFactor > 1.75 && familyHero;
          if (nativePortrait) expect(avif).not.toContain("-864");
          const requiredWidth = Math.max(painted.width, painted.height * metadata.width / metadata.height) * profile.deviceScaleFactor;
          // Native artwork is the ceiling; never reduce delivery below the original resolution cap.
          const reference = avif.replace("-864.avif", ".avif")
            .replace(/\/mobile\/tutorial-(day|night)-scene-960\.avif$/, "/tutorial-$1-scene.avif")
            .replace("/mobile/legal/", "/legal/").replace(/\.avif$/, ".webp");
          const { width: cap } = await sharp(resolve(import.meta.dirname, "../public", reference.slice(1))).metadata();
          expect(metadata.width, `${route}: enough pixels for the actual cover crop`).toBeGreaterThanOrEqual(Math.floor(Math.min(requiredWidth, cap)) - 1);
          expect(candidates.filter((candidate) => images.has(candidate)), `${route}: do not download both formats`).toEqual([avif]);
          if (familyHero) {
            expect([...images].filter((path) => /\/(?:werewolf|mafia)\/bg-hero-/.test(path)), `${route}: saved theme overrides the OS without an extra hero download`).toEqual([avif]);
          } else if (route === "/tutorial") {
            expect([...images].filter((path) => /\/tutorial-(?:day|night)-scene/.test(path)), `${route}: preload and CSS must agree on the scene resolution`).toEqual([avif]);
          } else if (route === "/faq") {
            expect([...images].filter((path) => /\/faq-hearth-banner\./.test(path)), `${route}: preload and CSS must agree on the banner resolution`).toEqual([avif]);
          } else if (route === "/sign-in") {
            expect([...images].filter((path) => /\/auth\/bg-sign-in-/.test(path)), `${route}: preload only the selected theme and resolution`).toEqual([avif]);
          }
          await page.screenshot({ path: info.outputPath(`${route!.replaceAll("/", "_")}-${theme}.png`), animations: "disabled" });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          page.off("response", onResponse);
        }
        expect(errors).toEqual([]);
      });
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`client navigation discovers only the selected ${theme} family artwork`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.emulateMedia({ colorScheme: theme === "light" ? "dark" : "light" });
    await page.addInitScript((value) => {
      localStorage.setItem("werewolf-theme", value);
      localStorage.setItem("cookie-consent", "1");
    }, theme);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/werewolf/rules");
    await expect(page.locator('.site-chrome:not([data-fallback])')).toBeVisible();
    const loaded = new Set<string>();
    page.on("response", (response) => {
      const path = new URL(response.url()).pathname;
      if (/\/mafia\/bg-hero-/.test(path)) loaded.add(path);
    });
    await page.getByRole("link", { name: "Правила за Мафия", exact: true }).click();
    await expect(page).toHaveURL(/\/mafia\/rules$/);
    const expected = `/game-art/mobile/mafia/bg-hero-${theme === "light" ? "light-v1" : "v3"}-864.avif`;
    await expect.poll(() => [...loaded]).toEqual([expected]);
    await expect(page.locator(".rules-hero-art:visible")).toHaveCSS("background-image", new RegExp(expected));
    expect(errors).toEqual([]);
  });
}

for (const family of ["werewolf", "mafia"]) {
  test(`${family} spotlight keeps its space and loads portraits on approach`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    const frames = new Set<string>();
    page.on("response", (response) => {
      const path = new URL(response.url()).pathname;
      if (path.startsWith("/game-art/frames/")) frames.add(path);
    });
    await page.addInitScript(() => {
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
    });
    await page.goto(`/${family}`);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.site-chrome:not([data-fallback])')).toBeVisible();
    const portraits = page.locator(".role-spotlight__art");
    await expect(portraits).toHaveCount(4);
    await expect(portraits.locator("img")).toHaveCount(0);
    expect([...frames]).toEqual([]);
    await expect(page.locator(".variant-chip__art img")).toHaveCount(0);
    const before = await portraits.first().boundingBox();
    expect(before!.width / before!.height).toBeCloseTo(2 / 3, 2);
    await portraits.first().scrollIntoViewIfNeeded();
    const image = portraits.first().locator("img");
    await expect(image).toBeVisible();
    await image.evaluate((element) => (element as HTMLImageElement).decode());
    await expect.poll(() => [...frames]).toEqual([
      `/game-art/frames/frame-${family === "mafia" ? "mafia" : "werewolves"}-v1.webp`,
    ]);
    const after = await portraits.first().boundingBox();
    expect(after!.width).toBe(before!.width);
    expect(after!.height).toBe(before!.height);
    await page.locator(".role-spotlight__link").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const variants = page.locator(".variant-chip__art");
    for (const art of await variants.all()) {
      const reserved = await art.boundingBox();
      await art.scrollIntoViewIfNeeded();
      await expect(art.locator("img")).toBeVisible();
      await art.locator("img").evaluate((element) => (element as HTMLImageElement).decode());
      const loaded = await art.boundingBox();
      expect(loaded!.width).toBe(reserved!.width);
      expect(loaded!.height).toBe(reserved!.height);
    }
  });
}
