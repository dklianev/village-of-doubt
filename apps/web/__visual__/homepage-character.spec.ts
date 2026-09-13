import { expect, test, type Locator, type Page } from "playwright/test";
import sharp from "sharp";

type Theme = "light" | "dark";
type Box = { x: number; y: number; width: number; height: number };

const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1920, height: 1080 },
] as const;

async function prepare(page: Page, theme: Theme) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem("werewolf-theme", selectedTheme);
    localStorage.setItem("welcome-modal-shown", "1");
    localStorage.setItem("cookie-consent", "1");
  }, theme);
}

function overlaps(first: Box, second: Box) {
  return Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x) > 1
    && Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y) > 1;
}

async function expectChoiceContrast(card: Locator, theme: Theme) {
  await card.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const selector = ".section-kicker, h2, blockquote, p, .game-choice-reference-links a";
  const lines = await card.evaluate((element, selector) => {
    const origin = element.getBoundingClientRect();
    return Array.from(element.querySelectorAll(selector)).flatMap((text) => {
      if (!text.getClientRects().length) return [];
      const range = document.createRange();
      range.selectNodeContents(text);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      context.fillStyle = getComputedStyle(text).color;
      context.fillRect(0, 0, 1, 1);
      const color = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
      return Array.from(range.getClientRects()).map(({ x, y, width, height }) => ({
        x: x - origin.x, y: y - origin.y, width, height, color,
        text: text.textContent, minimum: text.tagName === "H2" ? 3 : 4.5,
      }));
    });
  }, selector);
  // Preserve the illustration and scrim while sampling the pixels beneath the lettering.
  const hidden = await card.page().addStyleTag({
    content: `.game-choice-card :is(${selector}) { color: transparent !important; text-shadow: none !important; }
      nextjs-portal { visibility: hidden !important; }`,
  });
  let buffer: Buffer;
  try {
    buffer = await card.screenshot({ animations: "disabled", scale: "css" });
  } finally {
    await hidden.evaluate((element) => element.parentNode?.removeChild(element));
  }
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixel = (x: number, y: number) => {
    const offset = (y * info.width + x) * info.channels;
    return Array.from(data.subarray(offset, offset + 3));
  };
  const luminance = (rgb: number[]) => rgb.map((value) => value / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
  const ratio = (a: number[], b: number[]) => (Math.max(luminance(a), luminance(b)) + 0.05)
    / (Math.min(luminance(a), luminance(b)) + 0.05);
  for (const line of lines) {
    for (const fraction of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      const x = Math.floor(line.x + line.width * fraction);
      const y = Math.floor(line.y + line.height / 2);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(info.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(info.height);
      expect(ratio(line.color, pixel(x, y)), `${theme}: ${line.text}`).toBeGreaterThanOrEqual(line.minimum);
    }
  }
  if (theme === "light") {
    const x = Math.floor(info.width / 2);
    // Fractional element bounds can leave a couple of antialiased rows in the screenshot crop.
    expect(Math.max(...[1, 2, 3, 4].map((inset) => ratio(pixel(x, info.height - inset), pixel(x, info.height - 8)))), "light frame must remain distinct from the card surface")
      .toBeGreaterThan(1.4);
  }
}

async function expectReadableDeck(page: Page, width: number) {
  const introduction = page.getByRole("region", { name: "Първата ти игра" });
  await introduction.scrollIntoViewIfNeeded();
  await expect(introduction.getByRole("heading", { level: 2 })).toHaveText(/Познаваш хората\.\s*Не и ролите\./);
  const images = introduction.locator(".home-start-deck img");
  await expect(images).toHaveCount(3);
  await expect.poll(() => images.evaluateAll((elements) => elements.every((element) => {
    const image = element as HTMLImageElement;
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  }))).toBe(true);
  for (const image of await images.all()) {
    await expect(image).toBeVisible();
    await image.evaluate((element) => (element as HTMLImageElement).decode());
  }

  const geometry = await introduction.evaluate((section) => {
    const box = (element: Element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const blocks = Array.from(section.querySelectorAll("h2, h3, p, a"));
    const copy: { text: string; block: number; x: number; y: number; width: number; height: number }[] = [];
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    // Text-node line boxes avoid counting nested heading spans twice or treating whitespace as copy.
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent?.trim() || node.parentElement?.closest('[aria-hidden="true"]')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const block = blocks.indexOf(node.parentElement?.closest("h2, h3, p, a")!);
      for (const { x, y, width, height } of range.getClientRects()) {
        if (width > 0 && height > 0) copy.push({ text: node.textContent.trim(), block, x, y, width, height });
      }
    }
    return {
      section: box(section),
      deck: box(section.querySelector(".home-start-deck")!),
      images: Array.from(section.querySelectorAll(".home-start-deck img"), box),
      headings: Array.from(section.querySelectorAll<HTMLElement>("h2, h3"), (heading) => ({
        text: heading.textContent,
        clientWidth: heading.clientWidth,
        scrollWidth: heading.scrollWidth,
      })),
      copy,
    };
  });

  for (const bounds of [geometry.deck, ...geometry.images]) {
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    expect(bounds.x).toBeGreaterThanOrEqual(-1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
    expect(bounds.y).toBeGreaterThanOrEqual(geometry.section.y - 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(geometry.section.y + geometry.section.height + 1);
  }
  expect(geometry.images.some((image, index) => (
    geometry.images.slice(index + 1).some((other) => overlaps(image, other))
  )), "the role cards should still form an overlapping fan").toBe(true);
  for (const heading of geometry.headings) {
    expect(heading.scrollWidth, `heading overflow: ${heading.text}`).toBeLessThanOrEqual(heading.clientWidth + 1);
  }
  expect(geometry.copy.length).toBeGreaterThan(0);
  for (const [index, copy] of geometry.copy.entries()) {
    expect(copy.x, copy.text).toBeGreaterThanOrEqual(Math.max(0, geometry.section.x) - 1);
    expect(copy.x + copy.width, copy.text).toBeLessThanOrEqual(
      Math.min(width, geometry.section.x + geometry.section.width) + 1,
    );
    for (const image of geometry.images) {
      expect(overlaps(copy, image), `role card covers copy: ${copy.text}`).toBe(false);
    }
    for (const other of geometry.copy.slice(index + 1)) {
      // Display-font ascent/descent boxes can overlap across normal lines in the same text block.
      if (copy.block !== -1 && copy.block === other.block) continue;
      expect(overlaps(copy, other), `copy overlaps: ${copy.text} / ${other.text}`).toBe(false);
    }
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`homepage character keeps the role fan and copy separate in ${theme}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await prepare(page, theme);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const viewport of viewports) {
      await test.step(`${viewport.width}px`, async () => {
        await page.setViewportSize(viewport);
        await page.goto("/");
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        for (const family of ["werewolf", "mafia"] as const) {
          const version = family === "werewolf" ? "v7" : "v5";
          const art = page.locator(`.game-choice-${family} .game-choice-art img`).filter({ visible: true });
          await expect(art).toHaveCount(1);
          await art.scrollIntoViewIfNeeded();
          await art.evaluate((element) => (element as HTMLImageElement).decode());
          await expect(art).toHaveAttribute("alt", "");
          const source = await art.evaluate(async (element) => {
            const image = element as HTMLImageElement;
            // naturalWidth/Height are density-corrected integers, not the response's pixels.
            const response = await fetch(image.currentSrc, {
              headers: { Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.5" },
            });
            if (!response.ok) throw new Error(`Image ${response.status}: ${image.currentSrc}`);
            const bitmap = await createImageBitmap(await response.blob());
            const result = {
              url: image.currentSrc,
              width: bitmap.width,
              height: bitmap.height,
              targetWidth: image.getBoundingClientRect().width * devicePixelRatio,
            };
            bitmap.close();
            return result;
          });
          const selected = new URL(source.url);
          expect(selected.pathname).toBe("/_next/image");
          expect(selected.searchParams.get("url")).toBe(`/game-art/homepage/choice-${family}-${theme}-${version}.webp`);
          expect(selected.searchParams.get("q")).toBe("85");
          expect(Number(selected.searchParams.get("w"))).toBeGreaterThanOrEqual(source.targetWidth);
          const nativeHeight = family === "mafia" ? 1022 : 1024;
          await expect(art).toHaveAttribute("width", "1536");
          await expect(art).toHaveAttribute("height", String(nativeHeight));
          expect(source.width).toBe(Math.min(Number(selected.searchParams.get("w")), 1536));
          expect(source.height).toBe(Math.round(source.width * nativeHeight / 1536));
          await expectChoiceContrast(page.locator(`.game-choice-${family}`), theme);
        }
        await page.locator(".game-choice-grid").screenshot({
          path: info.outputPath(`choice-werewolf-v7-mafia-v5-${theme}-${viewport.width}.png`),
          animations: "disabled",
        });
        await expectReadableDeck(page, viewport.width);
        await page.getByRole("region", { name: "Първата ти игра" }).screenshot({
          path: info.outputPath(`home-start-${theme}-${viewport.width}.png`),
          animations: "disabled",
        });
      });
    }
    expect(errors).toEqual([]);
  });
}

for (const family of ["werewolf", "mafia"] as const) {
  const version = family === "werewolf" ? "v7" : "v5";
  test(`homepage ${family} roles stay public and keyboard reachable after a theme change`, async ({ page }) => {
    const width = family === "werewolf" ? 390 : 1920;
    const initialTheme = family === "werewolf" ? "light" : "dark";
    const nextTheme = initialTheme === "light" ? "dark" : "light";
    await page.setViewportSize({ width, height: 900 });
    await prepare(page, initialTheme);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    const menu = width < 768 ? page.getByRole("button", { name: "Отвори менюто" }) : null;
    if (menu) {
      await expect(menu).toBeEnabled();
      await menu.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog", { name: "Навигация" })).toBeVisible();
    }
    const toggle = page.getByRole("button", { name: /Смени на (светла|тъмна) тема/ }).filter({ visible: true });
    await expect(toggle).toBeEnabled();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-theme", nextTheme);
    await expect(toggle).toBeFocused();
    if (menu) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Навигация" })).toBeHidden();
      await expect(menu).toBeFocused();
    }
    await expectReadableDeck(page, width);

    const card = page.locator(`.game-choice-${family}`);
    const art = card.locator("img").filter({ visible: true });
    await expect(art).toHaveCount(1);
    await art.scrollIntoViewIfNeeded();
    await art.evaluate((element) => (element as HTMLImageElement).decode());
    const selected = new URL(await art.evaluate((element) => (element as HTMLImageElement).currentSrc));
    expect(selected.pathname).toBe("/_next/image");
    expect(selected.searchParams.get("url")).toBe(`/game-art/homepage/choice-${family}-${nextTheme}-${version}.webp`);
    const roles = card.getByRole("link", { name: "Роли", exact: true });
    await expect(roles).toHaveAttribute("href", `/${family}/roles`);
    await roles.focus();
    await expect(roles).toBeFocused();
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname === `/${family}/roles`);
    await expect(page.locator(".role-codex-card").first()).toBeVisible();
  });
}
