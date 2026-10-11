import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type TestInfo } from "playwright/test";
import sharp from "sharp";

type Family = "werewolf" | "mafia";
type Theme = "light" | "dark";
const families = ["werewolf", "mafia"] as const;
const themes = ["light", "dark"] as const;
const primaryLabel = (family: Family) => family === "werewolf" ? "Създай селото" : "Отвори масата";

for (const family of families) {
  test(`create redesign ${family}: 200% text remains inside the narrow workspace`, async ({ page }) => {
    await openCreate(page, family, "light", 320);
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await expectNoOverflow(page);
    const outside = await page.locator(".create-quick-surface").evaluate((root) =>
      [...root.querySelectorAll("button, h1, h2, p, legend, dt, dd, b, small")]
        .filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).clip === "auto")
        .filter((element) => { const box = element.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1; })
        .map((element) => element.textContent?.trim()));
    expect(outside).toEqual([]);
  });
}

async function openCreate(page: Page, family: Family, theme: Theme, width: number) {
  await page.setViewportSize({ width, height: width === 320 ? 740 : width < 768 ? 844 : 1000 });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.addInitScript((value) => {
    localStorage.setItem("werewolf-theme", value);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
  // visualAuth exercises a synthetic entry fixture, never real authentication or room creation.
  await page.goto(`/${family}/create?visualAuth=1`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".lobby-wizard[data-create-active]:not([inert])")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page).toHaveURL(new RegExp(`/${family}/create\\?visualAuth=1$`));
  await expect(page).toHaveTitle(family === "werewolf" ? /Върколак/ : /Мафия/);
  await expect(page.getByRole("heading", { name: family === "werewolf" ? "Стая за Върколак" : "Стая за Мафия", exact: true }))
    .toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => {})));
  });
}

async function screenshot(page: Page, info: TestInfo, name: string) {
  await settle(page);
  await page.screenshot({ path: info.outputPath(`${name}.png`), caret: "initial", animations: "disabled" });
}

async function expectNoOverflow(page: Page, surface = ".create-quick-surface") {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const clipped = await page.locator(surface).evaluate((root) => {
    const elements = [root, ...root.querySelectorAll("button, h1, h2, p, legend, dt, dd, b, small")];
    return elements.filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).clip === "auto"
      && element.scrollWidth > element.clientWidth + 1)
      .map((element) => ({ tag: element.tagName, text: element.textContent?.trim() }));
  });
  expect(clipped).toEqual([]);
}

async function expectRoster(page: Page, count: number) {
  const roster = page.locator(".create-role-portraits");
  const portraits = roster.locator(".create-role-portrait");
  await expect(portraits.first()).toBeVisible();
  await expect(roster.getByRole("button")).toHaveCount(await portraits.count());
  let total = 0;
  for (const portrait of await portraits.all()) {
    const name = (await portrait.locator("b").innerText()).trim();
    const badge = (await portrait.locator("small").innerText()).trim();
    expect(badge).toMatch(/^×\d+$/);
    const quantity = Number(badge.slice(1));
    total += quantity;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await expect(portrait).toHaveAccessibleName(new RegExp(`^${escaped}\\s*[,·:]?\\s*[×x]?\\s*${quantity}(?:\\D|$)`));
    await expect(portrait).toHaveAttribute("type", "button");
  }
  expect(total).toBe(count);
  await expect(page.locator(".create-roster-capacity")).toHaveText(`${count} места`);
  await expect(page.locator(".create-receipt dl > div").filter({ has: page.getByText("Играчи", { exact: true }) })
    .locator("dd")).toHaveText(String(count));
}

async function expectRedPrimary(button: Locator) {
  const paints = await button.evaluate((element) => {
    const style = getComputedStyle(element);
    const colors = style.backgroundImage === "none" ? [style.backgroundColor]
      : style.backgroundImage.match(/(?:rgba?|oklch|oklab|color|hsla?)\([^)]*\)|#[\da-f]{3,8}/gi) ?? [];
    const context = document.createElement("canvas").getContext("2d")!;
    return colors.map((color) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    });
  });
  // This checks hue only. Text contrast is evaluated by axe, not pixel sampling.
  expect(paints.length).toBeGreaterThan(0);
  for (const paint of paints) {
    expect(paint[3]).toBeGreaterThan(200);
    expect(paint[0]!).toBeGreaterThan(paint[1]! * 1.4);
    expect(paint[0]!).toBeGreaterThan(paint[2]! * 1.4);
  }
}

async function expectContrast(page: Page, selector: string, info: TestInfo, name: string) {
  await settle(page);
  const result = await new AxeBuilder({ page }).include(selector).withRules(["color-contrast"]).analyze();
  await info.attach(name, {
    body: JSON.stringify({ violations: result.violations, incomplete: result.incomplete, passes: result.passes }),
    contentType: "application/json",
  });
  expect(result.violations).toEqual([]);
}

async function expectMastheadArt(page: Page, family: Family, theme: Theme) {
  const art = await page.locator(".create-masthead").evaluate(async (element) => {
    const style = getComputedStyle(element, "::before");
    const source = style.backgroundImage.match(/url\("([^"]+)"\)/)?.[1];
    if (!source) throw new Error("Create masthead has no background image");
    const image = new Image();
    image.src = source;
    await image.decode();
    return { path: new URL(source).pathname, width: image.naturalWidth, height: image.naturalHeight, backgroundSize: style.backgroundSize };
  });
  expect(art.path).toBe(`/game-art/create/masthead-${family}-${theme}-v1.webp`);
  expect([art.width, art.height]).toEqual([1152, 384]);
  // The larger scene can use native pixels, but must never upscale the bitmap.
  expect(art.backgroundSize).toMatch(/^auto \d+px$/);
  expect(parseFloat(art.backgroundSize.split(" ")[1]!)).toBeLessThanOrEqual(art.height);
  const masthead = (await page.locator(".create-masthead").boundingBox())!;
  expect(masthead.height).toBeLessThanOrEqual(320);
  await expect(page.locator(".create-count-panel")).toBeInViewport({ ratio: 1 });

  // Sample the composited art/mask, with only the text hidden for the capture.
  const luminance = (rgb: number[]) => {
    const linear = rgb.map((channel) => channel / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
  };
  for (const text of await page.locator(".create-title-prefix, .create-title-game, .create-quick-heading p").all()) {
    const foreground = await text.evaluate((element) => {
      const context = document.createElement("canvas").getContext("2d")!;
      context.fillStyle = getComputedStyle(element).color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    });
    const clip = await text.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const rect = range.getBoundingClientRect();
      return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height };
    });
    const { data, info } = await sharp(await page.screenshot({
      clip,
      animations: "disabled",
      style: ".create-quick-heading h1, .create-quick-heading h1 span, .create-quick-heading p { color: transparent !important; }",
    })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let minimum = Infinity;
    const fg = luminance(foreground);
    for (let offset = 0; offset < data.length; offset += info.channels) {
      const bg = luminance([...data.subarray(offset, offset + 3)]);
      minimum = Math.min(minimum, (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05));
    }
    expect(minimum, await text.textContent() ?? "masthead text").toBeGreaterThanOrEqual(4.5);
  }
}

async function expectFooterClearance(page: Page, width: number) {
  const footer = page.locator(".create-mobile-action");
  if (width >= 768) {
    await expect(footer).toBeHidden();
    return;
  }
  await expect(footer).toHaveCSS("position", "fixed");
  await expect(footer).toBeInViewport({ ratio: 1 });
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  const finalContent = page.locator(".create-code-note");
  await expect(finalContent).toBeInViewport({ ratio: 1 });
  const last = (await finalContent.boundingBox())!;
  const bar = (await footer.boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(bar.y + 1);
  await expect.poll(() => finalContent.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  })).toBe(true);
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}

for (const family of families) {
  for (const width of [320, 360, 361, 390, 768, 1440, 1920]) {
    test(`create redesign ${family} ${width}: light and dark layout, roster and primary action`, async ({ browser }, info) => {
      test.setTimeout(90_000);
      // Fresh contexts avoid theme init scripts or draft state leaking between variants.
      for (const theme of themes) {
        await test.step(theme, async () => {
          const context = await browser.newContext({ baseURL: info.project.use.baseURL! });
          const page = await context.newPage();
          const errors = trackErrors(page);
          try {
            await openCreate(page, family, theme, width);
            await expectMastheadArt(page, family, theme);
            await expect(page.locator(".create-ready-mark")).toHaveText("Съставът е готов");
            await expect(page.getByText("Готови за игра", { exact: true })).toHaveCount(0);
            await expectRoster(page, family === "werewolf" ? 12 : 10);
            await expectNoOverflow(page);
            const primary = page.getByRole("button", { name: primaryLabel(family), exact: true });
            await expect(primary).toHaveCount(1);
            await expect(primary).toBeEnabled();
            await expectRedPrimary(primary);
            await screenshot(page, info, `${family}-${theme}-${width}-entry`);
            if (width === 390) {
              await expectContrast(page, ".create-quick-surface", info, `${family}-${theme}-quick-contrast`);
            }
            await expectFooterClearance(page, width);
            if (width === 320) await screenshot(page, info, `${family}-${theme}-320-footer`);
            await expect(page.getByText("Runtime Error", { exact: true })).toHaveCount(0);
            expect(errors).toEqual([]);
          } finally {
            await context.close();
          }
        });
      }
    });
  }
}

for (const family of families) {
  test(`create redesign ${family}: controls, details and role previews preserve the draft`, async ({ page }, info) => {
    test.setTimeout(90_000);
    const theme = family === "werewolf" ? "light" : "dark";
    const width = family === "werewolf" ? 320 : 390;
    const errors = trackErrors(page);
    await openCreate(page, family, theme, width);
    const url = page.url();
    const initialCount = family === "werewolf" ? 12 : 10;
    const slider = page.getByRole("slider", { name: "Брой играчи", exact: true });
    await expect(slider).toHaveValue(String(initialCount));
    await page.getByRole("button", { name: "Увеличи броя играчи", exact: true }).click();
    await expect(slider).toHaveValue(String(initialCount + 1));
    await page.getByRole("button", { name: "Намали броя играчи", exact: true }).click();
    await expect(slider).toHaveValue(String(initialCount));
    await slider.press("ArrowRight");
    await expect(slider).toHaveValue(String(initialCount + 1));

    await page.getByRole("button", { name: "На живо", exact: true }).click();
    await expect(page.getByRole("button", { name: "На живо", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".create-receipt")).toContainText("Без писмен разговор");
    const preset = page.getByRole("button", { name: family === "werewolf" ? /Първа нощ/ : /Спортна маса/ });
    await preset.click();
    await expect(preset).toHaveAttribute("aria-pressed", "true");
    const count = family === "werewolf" ? 13 : 10;
    if (family === "mafia") {
      await expect(page.getByText("Точно 10 играчи", { exact: true })).toBeVisible();
      await expect(slider).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^(Увеличи|Намали) броя играчи$/ })).toHaveCount(0);
    } else {
      await expect(slider).toHaveValue("13");
    }
    await expectRoster(page, count);
    await page.getByRole("button", { name: "Онлайн", exact: true }).click();
    await expect(page.getByRole("button", { name: "Онлайн", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".create-receipt")).toContainText("Вграден разговор");

    const details = page.getByRole("button", { name: "Настрой детайлите", exact: true });
    const workspace = page.getByRole("dialog", { name: "Настрой детайлите", exact: true });
    await details.click();
    await expect(workspace).toBeVisible();
    await workspace.getByRole("tab", { name: "Име на стаята", exact: true }).click();
    const roomName = "Вечер за тестовата компания";
    await workspace.getByRole("textbox", { name: "Име на стаята", exact: true }).fill(roomName);
    await workspace.getByRole("button", { name: "Готово", exact: true }).click();
    await expect(workspace).toBeHidden();
    await expect(details).toBeFocused();
    await expect(page.locator(".create-receipt-heading strong")).toHaveText(roomName);

    const before = await page.locator(".create-role-portraits").innerText();
    const trigger = page.locator("button.create-role-portrait").first();
    const roleName = (await trigger.locator("b").innerText()).trim();
    await trigger.click();
    const preview = page.getByRole("dialog", { name: roleName, exact: true });
    await expect(preview).toBeVisible();
    await expect(preview.getByRole("heading", { name: roleName, exact: true })).toBeVisible();
    await expect(preview.locator(".role-art-frame")).toHaveAttribute("data-frame-family", family === "werewolf" ? "werewolves" : "mafia");
    await expect.poll(() => preview.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(page).toHaveURL(url);
    await expectNoOverflow(page, ".ds-sheet:has(.create-roster-detail)");
    await screenshot(page, info, `${family}-${theme}-${width}-role-preview`);
    await expectContrast(page, ".ds-sheet:has(.create-roster-detail)", info, `${family}-role-preview-contrast`);
    await page.keyboard.press("Escape");
    await expect(preview).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator(".create-role-portraits")).toHaveText(before, { useInnerText: true });
    await expect(page.locator(".create-receipt-heading strong")).toHaveText(roomName);
    await expect(preset).toHaveAttribute("aria-pressed", "true");
    await expectRoster(page, count);

    await trigger.press("Enter");
    await expect(preview).toBeVisible();
    await preview.getByRole("button", { name: "Затвори ролята", exact: true }).first().click();
    await expect(preview).toBeHidden();
    await expect(trigger).toBeFocused();
    const footerDetails = page.getByRole("button", { name: "Редактирай настройките", exact: true });
    await footerDetails.click();
    await expect(workspace.getByRole("textbox", { name: "Име на стаята", exact: true })).toHaveValue(roomName);
    await page.keyboard.press("Escape");
    await expect(workspace).toBeHidden();
    await expect(footerDetails).toBeFocused();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("button", { name: "Онлайн", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expectRoster(page, count);
    await expectFooterClearance(page, width);
    expect(errors).toEqual([]);
  });
}
