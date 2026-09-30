import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "playwright/test";

test.use({ contextOptions: { reducedMotion: "reduce", serviceWorkers: "block" } });

const viewports = [
  { width: 320, textScale: 100 }, { width: 390, textScale: 100 },
  { width: 768, textScale: 100 }, { width: 1440, textScale: 100 },
  { width: 320, textScale: 200 },
] as const;
const catalogIds = ["first_blood", "jester_win", "guardian_save", "hunter_revenge", "silent_civilian", "perfect_record", "maniac_endgame"];
const ownedIds = ["first_blood", "jester_win", "hunter_revenge", "maniac_endgame"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function prepare(page: Page, theme: "light" | "dark") {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydration|hydrating|didn't match|uncaught|unhandled/i.test(message.text())) errors.push(message.text());
  });
  await page.addInitScript((value) => {
    localStorage.setItem("werewolf-theme", value);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  return errors;
}

async function openCollection(page: Page, state: "fixture" | "empty" | "unavailable", textScale: number) {
  await page.goto(`/achievements?visualAuth=1&visualAchievements=${state}`);
  await page.addStyleTag({ content: `html { font-size: ${textScale}% !important; }` });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("main h1")).toHaveText("Легенди от масата");
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const overflow = await page.locator(".achievement-shell").evaluate((root) => {
    const bounds = root.getBoundingClientRect();
    return [...root.querySelectorAll<HTMLElement>("h1, h2, h3, p, button, a, time")].flatMap((node) => {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      return rect.left < bounds.left - 1 || rect.right > bounds.right + 1
        || (node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1)
        ? [node.textContent?.trim()] : [];
    });
  });
  expect(overflow, "Achievement text and controls stay inside the page without clipping").toEqual([]);
}

async function expectDecodedImages(page: Page, count: number) {
  const images = page.locator(".achievement-feature-art img, .achievement-plaque-art img");
  await expect(images).toHaveCount(count);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    await image.evaluate((node) => (node as HTMLImageElement).decode());
    const decoded = await image.evaluate((node) => {
      const image = node as HTMLImageElement;
      const source = new URL(image.currentSrc);
      return {
        complete: image.complete, width: image.naturalWidth, height: image.naturalHeight,
        path: new URL(source.searchParams.get("url") ?? source.href, location.origin).pathname,
        id: image.closest("article")!.getAttribute("data-achievement-id"),
        companion: image.classList.contains("achievement-feature-companion"),
      };
    });
    expect(decoded.complete).toBe(true);
    expect(decoded.width).toBeGreaterThan(0);
    expect(decoded.height).toBeGreaterThan(0);
    expect(decoded.width / decoded.height).toBeCloseTo(1.5, 1);
    const artId = decoded.companion ? (decoded.id === "jester_win" ? "hunter_revenge" : "jester_win") : decoded.id;
    expect(decoded.path).toBe(`/game-art/achievements/relics/${artId}.webp`);
    await expect(image).toHaveAttribute("alt", "");
    await expect(image).toHaveAttribute("width", "960");
    await expect(image).toHaveAttribute("height", "640");
    const box = (await image.boundingBox())!;
    expect(box.width).toBeGreaterThan(40);
    expect(box.height).toBeGreaterThan(40);
  }
}

async function expectVisibleFocus(target: Locator) {
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport({ ratio: 1 });
  const focus = await target.evaluate((node) => {
    const style = getComputedStyle(node);
    const bounds = node.getBoundingClientRect();
    const extent = parseFloat(style.outlineWidth) + Math.max(0, parseFloat(style.outlineOffset));
    const clipped: string[] = [];
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const parentStyle = getComputedStyle(parent);
      const box = parent.getBoundingClientRect();
      if (/hidden|clip|auto|scroll/.test(parentStyle.overflowX)
        && (bounds.left - extent < box.left - 1 || bounds.right + extent > box.right + 1)) clipped.push("horizontal");
      if (/hidden|clip|auto|scroll/.test(parentStyle.overflowY)
        && (bounds.top - extent < box.top - 1 || bounds.bottom + extent > box.bottom + 1)) clipped.push("vertical");
    }
    return {
      visible: node.matches(":focus-visible"), width: parseFloat(style.outlineWidth),
      style: style.outlineStyle, color: style.outlineColor, clipped,
      unobscured: node.contains(document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)),
    };
  });
  expect(focus.visible).toBe(true);
  expect(focus.width).toBeGreaterThanOrEqual(2);
  expect(focus.style).not.toMatch(/none|hidden/);
  expect(focus.color).not.toBe("rgba(0, 0, 0, 0)");
  expect(focus.clipped).toEqual([]);
  expect(focus.unobscured).toBe(true);
}

async function expectGallery(page: Page, filter: "all" | "unlocked" | "locked", featuredId: string) {
  const expected = catalogIds.filter((id) => id !== featuredId
    && (filter === "all" || ownedIds.includes(id) === (filter === "unlocked")));
  const gallery = page.locator(".plaque-wall .achievement-plaque");
  await expect(gallery).toHaveCount(expected.length);
  expect(await gallery.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-achievement-id")))).toEqual(expected);
  await expect(page.locator(`.achievement-shell [data-achievement-id="${featuredId}"]`)).toHaveCount(1);
  await expect(page.locator(".achievement-feature")).toHaveAttribute("data-achievement-id", featuredId);
  await expect(page.locator(".achievement-progress")).toHaveText("4 от 7 отключени");
  await expect(page.getByRole("status")).toHaveText(`Показани: ${expected.length} от 6 останали отличия`);
  await expect(page.locator('.achievement-filters [aria-pressed="true"]')).toHaveCount(1);
  for (const button of await page.locator(".achievement-filters button").all()) {
    const resultsId = await button.getAttribute("aria-controls");
    expect(await button.evaluate((_, id) => Boolean(id && document.getElementById(id)), resultsId)).toBe(true);
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const labelLines = await button.evaluate(node => {
      const label = [...node.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim());
      if (!label) return 0;
      const range = document.createRange();
      range.selectNodeContents(label);
      return range.getClientRects().length;
    });
    expect(labelLines, "Filter labels stay whole instead of breaking individual words").toBe(1);
  }
  await expectNoOverflow(page);
}

async function expectSafeReplays(page: Page) {
  const links = page.locator(".achievement-shell .achievement-replay-link");
  await expect(links).toHaveCount(3);
  for (const link of await links.all()) {
    const href = (await link.getAttribute("href"))!;
    const url = new URL(href, page.url());
    expect(url.origin).toBe(new URL(page.url()).origin);
    const match = /^\/history\/([^/]+)\/replay$/.exec(url.pathname);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(uuid);
    expect(url.search).toBe("?visualReplay=fixture");
    expect(url.hash).toBe("");
    await expect(link).toHaveAttribute("aria-label", /^Виж играта: .+/);
    await expect(link.locator("xpath=ancestor::article")).toHaveAttribute("data-locked", "false");
  }
  await expect(page.locator('[data-achievement-id="first_blood"] .achievement-replay-link')).toHaveCount(0);
  await expect(page.locator('[data-achievement-id="first_blood"] .achievement-replay-unavailable')).toHaveText("Записът не е достъпен");
  await expect(page.locator('[data-locked="true"] .achievement-replay-link')).toHaveCount(0);
}

for (const theme of ["light", "dark"] as const) {
  for (const { width, textScale } of viewports) {
    test(`achievement relics ${theme} ${width} text ${textScale}%: artwork, filters and keyboard`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const errors = await prepare(page, theme);
      await openCollection(page, "fixture", textScale);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const feature = page.locator('.achievement-feature[data-locked="false"]');
      await expect(feature).toHaveCount(1);
      const featuredId = (await feature.getAttribute("data-achievement-id"))!;
      expect(ownedIds).toContain(featuredId);
      await expect(page.locator('.achievement-plaque[data-locked="false"]')).toHaveCount(3);
      await expect(page.locator('.achievement-plaque[data-locked="true"]')).toHaveCount(3);
      await expect(feature.getByRole("heading", { level: 2 })).toBeVisible();
      await expect(page.locator(".plaque-wall h3")).toHaveCount(6);
      const dates = await page.locator(".achievement-shell article time").evaluateAll((nodes) => nodes.map((node) => Date.parse(node.getAttribute("datetime")!)));
      expect(dates).toHaveLength(4);
      expect(dates.every(Number.isFinite)).toBe(true);
      expect(Date.parse((await feature.locator("time").getAttribute("datetime"))!)).toBe(Math.max(...dates));
      await expectDecodedImages(page, 8);
      await expectGallery(page, "all", featuredId);
      await expectSafeReplays(page);
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: info.outputPath("relics-all.png"), fullPage: true, animations: "disabled", style: "nextjs-portal { display: none; }" });
      if (width === 390) expect((await new AxeBuilder({ page }).include(".achievement-shell").analyze()).violations).toEqual([]);

      const filters = page.getByRole("group", { name: "Филтър за останалите отличия" });
      const all = filters.getByRole("button", { name: "Всички (6)", exact: true });
      const unlocked = filters.getByRole("button", { name: "Отключени (3)", exact: true });
      const locked = filters.getByRole("button", { name: "Заключени (3)", exact: true });
      await feature.getByRole("link", { name: /^Виж играта:/ }).focus();
      await page.keyboard.press("Tab");
      await expectVisibleFocus(all);
      await expect(all).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press("Tab");
      await expectVisibleFocus(unlocked);
      await page.keyboard.press("Enter");
      await expect(unlocked).toHaveAttribute("aria-pressed", "true");
      await expectGallery(page, "unlocked", featuredId);
      await expectVisibleFocus(unlocked);
      if (width === 390) expect((await new AxeBuilder({ page }).include(".achievement-shell").analyze()).violations).toEqual([]);
      await page.keyboard.press("Tab");
      await expectVisibleFocus(locked);
      await page.keyboard.press("Space");
      await expect(locked).toHaveAttribute("aria-pressed", "true");
      await expectGallery(page, "locked", featuredId);
      await expectVisibleFocus(locked);
      if (width === 390) expect((await new AxeBuilder({ page }).include(".achievement-shell").analyze()).violations).toEqual([]);
      await page.screenshot({ path: info.outputPath("relics-locked-focus.png"), animations: "disabled", style: "nextjs-portal { display: none; }" });
      await all.click();
      await expect(all).toHaveAttribute("aria-pressed", "true");
      await expectGallery(page, "all", featuredId);
      expect(errors).toEqual([]);
    });

    test(`achievement relics ${theme} ${width} text ${textScale}%: empty and unavailable stay distinct`, async ({ page, browserName }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const errors = await prepare(page, theme);
      await openCollection(page, "empty", textScale);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator(".achievement-progress")).toHaveText("0 от 7 отключени");
      await expect(page.locator(".achievement-feature")).toHaveCount(0);
      await expect(page.locator('.achievement-plaque[data-locked="true"]')).toHaveCount(7);
      await expect(page.locator(".achievement-shell").getByRole("alert")).toHaveCount(0);
      const invitation = page.getByRole("link", { name: "Избери игра", exact: true });
      await expect(invitation).toHaveAttribute("href", "/");
      await expect(invitation).toBeVisible();
      await expect(page.locator(".achievement-replay-link")).toHaveCount(0);
      await expectDecodedImages(page, 7);
      await expectNoOverflow(page);
      if (width === 390) expect((await new AxeBuilder({ page }).include(".achievement-shell").analyze()).violations).toEqual([]);
      await page.getByRole("button", { name: "Отключени (0)", exact: true }).click();
      await expect(page.getByRole("button", { name: "Отключени (0)", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByText("Няма отключени отличия.", { exact: true })).toBeVisible();
      await expect(page.getByRole("status")).toHaveText("Показани: 0 от 7 отличия");
      await expect(page.locator(".achievement-plaque")).toHaveCount(0);
      await expect(invitation).toBeVisible();
      await expectNoOverflow(page);
      if (width === 390) expect((await new AxeBuilder({ page }).include(".achievement-shell").analyze()).violations).toEqual([]);
      await page.getByRole("button", { name: "Заключени (7)", exact: true }).click();
      await expect(page.locator('.achievement-plaque[data-locked="true"]')).toHaveCount(7);
      await expect(page.getByRole("status")).toHaveText("Показани: 7 от 7 отличия");
      await page.getByRole("button", { name: "Всички (7)", exact: true }).click();
      await expect(page.getByRole("button", { name: "Всички (7)", exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: info.outputPath("relics-empty.png"), animations: "disabled", style: "nextjs-portal { display: none; }" });

      await openCollection(page, "unavailable", textScale);
      await expect(page.locator(".achievement-shell").getByRole("alert")).toContainText("Не успяхме да заредим легендите");
      await expect(page.locator(".achievement-progress, .achievement-feature, .achievement-plaque, .achievement-filters")).toHaveCount(0);
      await expect(page.locator(".achievement-empty-note")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Избери игра", exact: true })).toHaveCount(0);
      const retry = page.getByRole("link", { name: "Опитай отново", exact: true });
      await expect(retry).toHaveAttribute("href", "/achievements");
      await retry.focus();
      await page.keyboard.press("Tab");
      const archive = page.getByRole("link", { name: "Виж записаните игри", exact: true });
      // This WebKit port skips native links in its default Tab traversal; retain focus-ring checks.
      if (browserName === "webkit") await archive.focus();
      await expectVisibleFocus(archive);
      await page.keyboard.press("Shift+Tab");
      if (browserName === "webkit") await retry.focus();
      await expectVisibleFocus(retry);
      await expectNoOverflow(page);
      if (width === 390) expect((await new AxeBuilder({ page }).include(".achievement-shell").analyze()).violations).toEqual([]);
      await page.screenshot({ path: info.outputPath("relics-unavailable.png"), animations: "disabled", style: "nextjs-portal { display: none; }" });
      expect(errors).toEqual([]);
    });
  }

  test(`achievement relics ${theme}: featured replay and empty invitation reach their destinations`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = await prepare(page, theme);
    await openCollection(page, "fixture", 100);
    const replay = page.locator(".achievement-feature .achievement-replay-link");
    const href = (await replay.getAttribute("href"))!;
    await expectSafeReplays(page);
    await replay.click();
    await expect(page).toHaveURL(new URL(href, page.url()).href);
    // The replay now leads with its outcome; the case number sits in the kicker above it.
    await expect(page.locator("[data-replay-shell] > header")).toContainText(/Дело №\d+/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^\S.+\.$/);
    await expect(page.locator("[data-replay-chapter]:not([hidden]) [data-replay-phase]").first()).toBeVisible();
    await openCollection(page, "empty", 100);
    await page.getByRole("link", { name: "Избери игра", exact: true }).click();
    await expect(page).toHaveURL(new URL("/", page.url()).href);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Върколак или Мафия");
    expect(errors).toEqual([]);
  });
}
