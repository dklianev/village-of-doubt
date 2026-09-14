import { expect, type Locator } from "playwright/test";

export async function expectDecodedImage(image: Locator) {
  const state = await image.evaluate(async (element) => {
    const img = element as HTMLImageElement;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const outcome = await Promise.race([
      img.decode().then(() => "decoded", (error: Error) => `rejected: ${error.message}`),
      new Promise<string>((resolve) => { timeout = setTimeout(() => resolve("timeout"), 15_000); }),
    ]);
    clearTimeout(timeout);
    const style = getComputedStyle(img);
    return {
      outcome,
      src: img.getAttribute("src"),
      currentSrc: img.currentSrc,
      complete: img.complete,
      naturalSize: [img.naturalWidth, img.naturalHeight],
      box: img.getBoundingClientRect().toJSON(),
      display: style.display,
      visibility: style.visibility,
      parentDisplay: img.parentElement ? getComputedStyle(img.parentElement).display : null,
      theme: document.documentElement.dataset.theme,
    };
  });
  expect(state, "Visible artwork must decode; image state identifies stalled lazy requests").toMatchObject({ outcome: "decoded" });
}
