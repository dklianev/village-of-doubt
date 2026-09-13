import { expect, test, type Locator } from "playwright/test";
import sharp from "sharp";

async function unobscuredArt(image: Locator) {
  await image.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  await image.evaluate(async (element) => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await (element as HTMLImageElement).decode();
  });
  const screenshot = await image.screenshot({ animations: "disabled", scale: "css" });
  // Use the browser's own rasterization at the same fractional position, without foreground layers.
  await image.evaluate(async (element) => {
    const original = element as HTMLImageElement;
    const box = original.getBoundingClientRect();
    const reference = new Image();
    reference.dataset.artReference = "";
    reference.src = original.currentSrc;
    Object.assign(reference.style, {
      position: "fixed", left: `${box.x}px`, top: `${box.y}px`,
      width: `${box.width}px`, height: `${box.height}px`, maxWidth: "none",
      objectFit: "cover", objectPosition: getComputedStyle(original).objectPosition,
      zIndex: "2147483647", pointerEvents: "none",
    });
    document.body.append(reference);
    await reference.decode();
  });
  const reference = image.page().locator("[data-art-reference]");
  let expected: Buffer;
  try {
    expected = await reference.screenshot({ animations: "disabled", scale: "css" });
  } finally {
    await reference.evaluate((element) => element.remove());
  }
  // Ignore subpixel texture resampling; broad scrims still change these local pixel averages.
  const actual = await sharp(screenshot).blur(1).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const source = await sharp(expected).blur(1).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  expect([actual.info.width, actual.info.height]).toEqual([source.info.width, source.info.height]);
  let matching = 0;
  let samples = 0;
  // Skip the top label and the short bottom fade; the scene itself must remain intact.
  for (let y = Math.ceil(actual.info.height * 0.3); y < actual.info.height * 0.78; y += 8) {
    for (let x = Math.ceil(actual.info.width * 0.08); x < actual.info.width * 0.92; x += 8) {
      const a = (y * actual.info.width + x) * actual.info.channels;
      const b = (y * source.info.width + x) * source.info.channels;
      const difference = Math.max(...[0, 1, 2].map((channel) => Math.abs(actual.data[a + channel]! - source.data[b + channel]!)));
      if (difference <= 20) matching++;
      samples++;
    }
  }
  return { ratio: matching / samples, screenshot };
}

for (const theme of ["light", "dark"] as const) {
  test(`homepage ${theme} scenes remain visible, not merely loaded behind the text`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.addInitScript((selected) => {
      localStorage.setItem("werewolf-theme", selected);
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("welcome-modal-shown", "1");
    }, theme);
    await page.setViewportSize({ width: 980, height: 1080 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: "nextjs-portal { visibility: hidden !important; }" });
    for (const width of [980, 320, 390, 640, 641, 768, 820, 1024, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      for (const card of await page.locator(".game-choice-card").all()) {
        const image = card.locator("img").filter({ visible: true });
        const family = await card.getAttribute("data-family");
        const result = await unobscuredArt(image);
        await info.attach(`${theme}-${family}-${width}`, { body: result.screenshot, contentType: "image/png" });
        expect(result.ratio, `${theme} ${family} ${width}: the illustration is covered by foreground layers`).toBeGreaterThanOrEqual(0.9);
        const artBox = (await image.boundingBox())!;
        const titleBox = (await card.getByRole("heading", { level: 2 }).boundingBox())!;
        expect(artBox.height).toBeGreaterThanOrEqual(180);
        expect(titleBox.y, "the title must follow the scene, not cover its middle").toBeGreaterThanOrEqual(artBox.y + artBox.height - 1);
      }
    }
  });
}
