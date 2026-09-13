import AxeBuilder from "@axe-core/playwright";
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
  await page.emulateMedia({ colorScheme: theme === "light" ? "dark" : "light", reducedMotion: "reduce" });
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem("werewolf-theme", selectedTheme);
    localStorage.setItem("welcome-modal-shown", "1");
    localStorage.setItem("cookie-consent", "1");
  }, theme);
}

async function switchTheme(page: Page, theme: Theme, width: number) {
  const menu = width < 768 ? page.getByRole("button", { name: "Отвори менюто" }) : null;
  if (menu) {
    await menu.scrollIntoViewIfNeeded();
    await expect(menu).toBeEnabled();
    await menu.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Навигация" })).toBeVisible();
  }
  const toggle = page.getByRole("button", { name: /Смени на (светла|тъмна) тема/ }).filter({ visible: true });
  await toggle.scrollIntoViewIfNeeded();
  await expect(toggle).toBeEnabled();
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(toggle).toBeFocused();
  if (menu) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Навигация" })).toBeHidden();
    await expect(menu).toBeFocused();
  }
}

function overlaps(first: Box, second: Box) {
  return Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x) > 1
    && Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y) > 1;
}

async function expectDecodedArt(closing: Locator, theme: Theme, width: number) {
  const images = closing.locator(".landing-final-art img");
  await expect(images).toHaveCount(2);
  for (const image of await images.all()) {
    await expect(image).toHaveAttribute("alt", "");
    expect(await image.evaluate((element) => element.closest("picture") !== null)).toBe(true);
    expect(await image.evaluate((element) => element.closest('[aria-hidden="true"]') !== null)).toBe(true);
  }
  const image = images.filter({ visible: true });
  await expect(image).toHaveCount(1);
  await expect(closing.locator(`.landing-final-art--${theme === "light" ? "dark" : "light"}`)).toBeHidden();
  await expect.poll(() => image.evaluate((element) => {
    const image = element as HTMLImageElement;
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  })).toBe(true);
  await image.evaluate((element) => (element as HTMLImageElement).decode());
  const path = `/game-art/${width < 768 ? "mobile/" : ""}homepage/invitation-${theme === "light" ? "light-" : ""}v1.webp`;
  expect(await image.evaluate((element) => new URL((element as HTMLImageElement).currentSrc).pathname)).toBe(path);
  return path;
}

async function expectUnclippedFocus(link: Locator) {
  await link.focus();
  await expect(link).toBeFocused();
  const focus = await link.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const clipped: string[] = [];
    // The shared Pill focus ring extends four CSS pixels beyond its border box.
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const clip = ancestor.getBoundingClientRect();
      if (/hidden|clip/.test(style.overflowX) && (bounds.left - 4 < clip.left || bounds.right + 4 > clip.right)) {
        clipped.push(`${ancestor.className}: horizontal`);
      }
      if (/hidden|clip/.test(style.overflowY) && (bounds.top - 4 < clip.top || bounds.bottom + 4 > clip.bottom)) {
        clipped.push(`${ancestor.className}: vertical`);
      }
    }
    return { visible: element.matches(":focus-visible"), shadow: getComputedStyle(element).boxShadow, clipped };
  });
  expect(focus.visible).toBe(true);
  expect(focus.shadow).not.toBe("none");
  expect(focus.clipped, "focus ring must remain inside clipping ancestors").toEqual([]);
}

async function expectActionTargets(closing: Locator) {
  const invitation = closing.locator(".landing-final-invitation");
  const frame = () => invitation.evaluate((element) => ({
    border: getComputedStyle(element, "::before").borderColor,
    width: element.getBoundingClientRect().width,
    height: element.getBoundingClientRect().height,
  }));
  await closing.scrollIntoViewIfNeeded();
  await closing.page().mouse.move(0, 0);
  const resting = await frame();
  await invitation.hover();
  await expect.poll(async () => (await frame()).border, "hover should emphasize the invitation edge").not.toBe(resting.border);
  await closing.page().mouse.move(0, 0);
  await expect.poll(async () => (await frame()).border).toBe(resting.border);
  for (const link of await closing.getByRole("link").all()) {
    await link.scrollIntoViewIfNeeded();
    const hits = await link.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const x = bounds.x + bounds.width / 2;
      return [-21.5, 0, 21.5].map((offset) => {
        const y = bounds.y + bounds.height / 2 + offset;
        return { x, y, hitsLink: element.contains(document.elementFromPoint(x, y)) };
      });
    });
    expect(hits.every((point) => point.hitsLink), `44px CTA hit area: ${JSON.stringify(hits)}`).toBe(true);
    await expectUnclippedFocus(link);
    await expect.poll(async () => (await frame()).border, "keyboard focus should emphasize the invitation edge").not.toBe(resting.border);
    const focused = await frame();
    expect({ width: focused.width, height: focused.height }, "frame interaction must not resize the invitation")
      .toEqual({ width: resting.width, height: resting.height });
  }
}

async function expectSecondaryContrast(closing: Locator) {
  const secondary = closing.getByRole("link", { name: "Играй Мафия" });
  const foreground = await secondary.evaluate((element) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    context.fillStyle = getComputedStyle(element).color;
    context.fillRect(0, 0, 1, 1);
    return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
  });
  const luminance = (rgb: number[]) => {
    const linear = rgb.map((value) => value / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
  };
  // Axe cannot resolve this image-backed button's contrast; sample its rendered padding instead.
  const { data, info } = await sharp(await secondary.screenshot({ animations: "disabled" }))
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const samples = [
    [Math.floor(info.width / 2), 5],
    [Math.floor(info.width / 2), info.height - 6],
    [6, Math.floor(info.height / 2)],
  ] as const;
  const ratios = samples.map(([x, y]) => {
    const offset = (y * info.width + x) * info.channels;
    const background = luminance(Array.from(data.subarray(offset, offset + 3)));
    const text = luminance(foreground);
    return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
  });
  expect(Math.min(...ratios), "secondary invitation label contrast").toBeGreaterThanOrEqual(4.5);
  return { foreground, ratios };
}

async function expectReadableInvitation(closing: Locator, width: number) {
  const invitation = closing.locator(".landing-final-invitation");
  for (const corner of ["top-left", "top-right", "bottom-left", "bottom-right"]) {
    await expect(invitation).toHaveCSS(`border-${corner}-radius`, "8px");
  }
  await expect(invitation).toHaveCSS("overflow-x", "clip");
  await expect(invitation).toHaveCSS("overflow-y", "clip");
  const geometry = await closing.evaluate((section) => {
    const box = (element: Element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const blocks = Array.from(section.querySelectorAll<HTMLElement>("h2, p, a"));
    const copy: { text: string; block: number; x: number; y: number; width: number; height: number }[] = [];
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent?.trim() || node.parentElement?.closest('[aria-hidden="true"]')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const block = blocks.indexOf(node.parentElement?.closest<HTMLElement>("h2, p, a")!);
      for (const { x, y, width, height } of range.getClientRects()) {
        if (width > 0 && height > 0) copy.push({ text: node.textContent.trim(), block, x, y, width, height });
      }
    }
    const activeImage = Array.from(section.querySelectorAll<HTMLImageElement>(".landing-final-art img"))
      .find((image) => image.getClientRects().length > 0 && getComputedStyle(image).visibility !== "hidden")!;
    return {
      section: box(section),
      invitation: box(section.querySelector(".landing-final-invitation")!),
      art: box(activeImage.closest(".landing-final-art")!),
      image: box(activeImage),
      blocks: blocks.map((element) => ({
        ...box(element),
        text: element.textContent,
        isLink: element.tagName === "A",
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
      links: Array.from(section.querySelectorAll("a"), box),
      copy,
    };
  });

  for (const bounds of [geometry.section, geometry.invitation, geometry.art, geometry.image, ...geometry.links]) {
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    expect(bounds.x).toBeGreaterThanOrEqual(-1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
  }
  if (width < 768) {
    expect(geometry.section.x, "mobile rounded corners need a visible left gutter").toBeGreaterThanOrEqual(8);
    expect(width - geometry.section.x - geometry.section.width, "mobile rounded corners need a visible right gutter").toBeGreaterThanOrEqual(8);
  }
  for (const [name, bounds] of [["invitation", geometry.invitation], ["art", geometry.art]] as const) {
    expect(bounds.x, `${name} escapes region left`).toBeGreaterThanOrEqual(geometry.section.x - 1);
    expect(bounds.x + bounds.width, `${name} escapes region right`).toBeLessThanOrEqual(geometry.section.x + geometry.section.width + 1);
    expect(bounds.y, `${name} escapes region top`).toBeGreaterThanOrEqual(geometry.section.y - 1);
    expect(bounds.y + bounds.height, `${name} escapes region bottom`).toBeLessThanOrEqual(geometry.section.y + geometry.section.height + 1);
  }
  expect(geometry.image.x).toBeLessThanOrEqual(geometry.section.x + 1);
  expect(geometry.image.x + geometry.image.width).toBeGreaterThanOrEqual(geometry.section.x + geometry.section.width - 1);
  if (width >= 768) {
    expect(geometry.image.y).toBeLessThanOrEqual(geometry.section.y + 1);
    expect(geometry.image.y + geometry.image.height).toBeGreaterThanOrEqual(geometry.section.y + geometry.section.height - 1);
  }
  for (const block of geometry.blocks) {
    expect(block.scrollWidth, `copy overflows its container: ${block.text}`).toBeLessThanOrEqual(block.clientWidth + 1);
  }
  for (const [index, link] of geometry.links.entries()) {
    expect(link.height).toBeGreaterThanOrEqual(46);
    expect(link.y).toBeGreaterThanOrEqual(geometry.section.y - 1);
    expect(link.y + link.height).toBeLessThanOrEqual(geometry.section.y + geometry.section.height + 1);
    for (const other of geometry.links.slice(index + 1)) {
      expect(overlaps(link, other), "closing actions overlap").toBe(false);
    }
  }
  expect(geometry.copy.length).toBeGreaterThan(0);
  for (const [index, copy] of geometry.copy.entries()) {
    const bounds = geometry.blocks[copy.block] ?? geometry.section;
    expect(copy.x, copy.text).toBeGreaterThanOrEqual(Math.max(0, bounds.x) - 1);
    expect(copy.x + copy.width, copy.text).toBeLessThanOrEqual(Math.min(width, bounds.x + bounds.width) + 1);
    expect(copy.y, copy.text).toBeGreaterThanOrEqual(geometry.section.y - 1);
    expect(copy.y + copy.height, copy.text).toBeLessThanOrEqual(geometry.section.y + geometry.section.height + 1);
    if (geometry.blocks[copy.block]?.isLink) {
      expect(copy.y, `button label escapes top: ${copy.text}`).toBeGreaterThanOrEqual(bounds.y - 1);
      expect(copy.y + copy.height, `button label escapes bottom: ${copy.text}`).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
    } else {
      for (const link of geometry.links) {
        expect(overlaps(copy, link), `button covers copy: ${copy.text}`).toBe(false);
      }
    }
    for (const other of geometry.copy.slice(index + 1)) {
      // Font ascent/descent ranges can overlap across normal lines within a single text block.
      if (copy.block !== -1 && copy.block === other.block) continue;
      expect(overlaps(copy, other), `copy overlaps: ${copy.text} / ${other.text}`).toBe(false);
    }
    // Desktop art intentionally sits behind the copy; mobile reserves a separate top strip.
    if (width < 768) expect(overlaps(copy, geometry.image), `mobile art covers: ${copy.text}`).toBe(false);
  }
  return geometry;
}

for (const theme of ["light", "dark"] as const) {
  test(`homepage invitation stays readable and accessible in ${theme}`, async ({ context }, info) => {
    test.setTimeout(120_000);
    for (const viewport of viewports) {
      await test.step(`${viewport.width}px`, async () => {
        const page = await context.newPage();
        try {
          await prepare(page, theme);
          await page.setViewportSize(viewport);
          const errors: string[] = [];
          const requestedArt: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("console", (message) => {
            if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text());
          });
          page.on("request", (request) => {
            const path = new URL(request.url()).pathname;
            if (request.resourceType() === "image" && /\/invitation(?:-light)?-v1\.webp$/.test(path)) requestedArt.push(path);
          });
          await page.goto("/");
          await page.evaluate(() => document.fonts.ready);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await expect(page.locator(".home-activity-note, .landing-stats-row")).toHaveCount(0);
          const closing = page.getByRole("region", { name: "Готов ли си да седнеш на масата" });
          await expect(closing.getByRole("heading", { level: 2, name: "Кого ще поканиш?" })).toBeVisible();
          await closing.scrollIntoViewIfNeeded();
          const expectedArt = await expectDecodedArt(closing, theme, viewport.width);
          await closing.screenshot({ path: info.outputPath(`invitation-${theme}-${viewport.width}.png`), animations: "disabled" });
          const geometry = await expectReadableInvitation(closing, viewport.width);
          const footerBounds = await page.getByRole("contentinfo").boundingBox();
          expect(footerBounds!.y).toBeGreaterThanOrEqual(geometry.section.y + geometry.section.height - 1);
          await expect(closing.getByRole("link")).toHaveCount(2);
          await expect(closing.getByRole("link", { name: "Играй Върколак" })).toHaveAttribute("href", "/werewolf/create");
          await expect(closing.getByRole("link", { name: "Играй Мафия" })).toHaveAttribute("href", "/mafia/create");
          const accessibility = await new AxeBuilder({ page })
            .include(".landing-final-cta")
            .withTags(["wcag2a", "wcag2aa"])
            .analyze();
          expect(accessibility.violations).toEqual([]);
          const contrast = await expectSecondaryContrast(closing);
          await info.attach(`secondary-contrast-${theme}-${viewport.width}`, {
            body: JSON.stringify(contrast), contentType: "application/json",
          });
          await expectActionTargets(closing);
          expect([...new Set(requestedArt)], "only the selected theme and viewport art should load").toEqual([expectedArt]);
          if (viewport.width === 320 || viewport.width === 1920) {
            const switchedTheme = theme === "light" ? "dark" : "light";
            const requestsBeforeSwitch = requestedArt.length;
            await switchTheme(page, switchedTheme, viewport.width);
            await closing.scrollIntoViewIfNeeded();
            const switchedArt = await expectDecodedArt(closing, switchedTheme, viewport.width);
            await expectReadableInvitation(closing, viewport.width);
            const switchedContrast = await expectSecondaryContrast(closing);
            await info.attach(`secondary-contrast-switched-${switchedTheme}-${viewport.width}`, {
              body: JSON.stringify(switchedContrast), contentType: "application/json",
            });
            await closing.screenshot({
              path: info.outputPath(`invitation-switched-${theme}-to-${switchedTheme}-${viewport.width}.png`),
              animations: "disabled",
            });
            await expectActionTargets(closing);
            expect([...new Set(requestedArt.slice(requestsBeforeSwitch))], "theme toggle loads only the newly visible invitation").toEqual([switchedArt]);
            expect([...new Set(requestedArt)]).toEqual([expectedArt, switchedArt]);
          }
          expect(errors).toEqual([]);
        } finally {
          await page.close();
        }
      });
    }
  });
}

for (const family of ["werewolf", "mafia"] as const) {
  test(`homepage invitation takes keyboard guests to ${family} creation through sign-in`, async ({ page }) => {
    await page.setViewportSize({ width: family === "werewolf" ? 320 : 1920, height: 900 });
    await prepare(page, family === "werewolf" ? "light" : "dark");
    await page.goto("/");
    const closing = page.getByRole("region", { name: "Готов ли си да седнеш на масата" });
    await closing.scrollIntoViewIfNeeded();
    const werewolf = closing.getByRole("link", { name: "Играй Върколак" });
    const mafia = closing.getByRole("link", { name: "Играй Мафия" });
    await werewolf.focus();
    await expect(werewolf).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(mafia).toBeFocused();
    if (family === "werewolf") {
      await page.keyboard.press("Shift+Tab");
      await expect(werewolf).toBeFocused();
    }
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname === "/sign-in");
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(`/${family}/create`);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(closing).toBeHidden();
  });
}
