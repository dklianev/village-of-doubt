import path from "node:path";
import sharp from "sharp";
import { expect, test, type Locator } from "playwright/test";

async function expectSharpCover(image: Locator) {
  await image.scrollIntoViewIfNeeded();
  const actual = await image.evaluate(async (element) => {
    const img = element as HTMLImageElement;
    await img.decode();
    const bitmap = await createImageBitmap(await (await fetch(img.currentSrc)).blob());
    const rect = img.getBoundingClientRect();
    const result = {
      src: new URL(img.currentSrc).searchParams.get("url"),
      pixels: bitmap.width,
      width: rect.width,
      height: rect.height,
      dpr: devicePixelRatio,
    };
    bitmap.close();
    return result;
  });
  expect(actual.src).toMatch(/^\/game-art\//);
  const sourcePath = new URL(actual.src!, "https://assets.test").pathname;
  const source = await sharp(path.join(process.cwd(), "apps/web/public", sourcePath)).metadata();
  const needed = Math.min(source.width!, Math.max(actual.width, actual.height * source.width! / source.height!) * actual.dpr);
  expect(actual.pixels, `${actual.src}: ${actual.pixels}px for ${Math.ceil(needed)}px cover`).toBeGreaterThanOrEqual(Math.floor(needed) - 2);
}

for (const width of [390, 1440]) {
  for (const family of ["werewolf", "mafia"] as const) {
    test(`role art retains cover detail ${family} ${width} DPR2`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
      await context.addInitScript(() => {
        localStorage.setItem("werewolf-theme", "dark");
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("welcome-modal-shown", "1");
      });
      const page = await context.newPage();
      try {
        await page.goto(`/${family}`);
        for (const img of await page.locator(".variant-chip img, .role-spotlight img").all()) await expectSharpCover(img);
        await page.goto(`/${family}/roles`);
        const roles = family === "mafia" ? ["commissioner", "vigilante", "lovers"] : ["seer", "investigator", "healer"];
        for (const role of roles) {
          const card = page.locator(`.role-codex-card.role-${role}`);
          await expectSharpCover(card.locator("img"));
          await expect(card.locator("img")).toHaveCSS("filter", "none");
          await card.locator("button").click();
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible();
          await expectSharpCover(dialog.locator("img"));
          await page.keyboard.press("Escape");
          await expect(dialog).toHaveCount(0);
        }
      } finally {
        await context.close();
      }
    });
  }
}
