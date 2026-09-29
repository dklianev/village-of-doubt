import { expect, test, type Locator, type Page } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { fixtureLeaderboard, LEADERBOARD_FIXTURE_AS_OF } from "../app/leaderboard/leaderboard-fixture";

async function openLeaderboard(page: Page, theme: "dark" | "light", fixture = "fixture-full") {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
    localStorage.setItem("werewolf-theme", selectedTheme);
  }, theme);
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  await page.goto(`/leaderboard?visualLeaderboard=${fixture}`);
  await expect(page.getByRole("heading", { level: 1, name: "Вечерен брой" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator(".site-mobile-menu")).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
}

async function tabToRanking(page: Page, region: Locator) {
  await page.locator("body").evaluate((body) => {
    body.tabIndex = -1;
    body.focus();
    body.removeAttribute("tabindex");
  });
  for (let step = 0; step < 30; step++) {
    await page.keyboard.press("Tab");
    if (await region.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(region).toBeFocused();
  const focus = await region.evaluate((element) => {
    const style = getComputedStyle(element);
    return { visible: element.matches(":focus-visible"), width: parseFloat(style.outlineWidth), style: style.outlineStyle };
  });
  expect(focus.visible).toBe(true);
  expect(focus.width).toBeGreaterThan(0);
  expect(focus.style).not.toBe("none");
}

async function expectEditorialTextFits(page: Page) {
  const text = page.locator(".masthead-title, .masthead-meta, .headline-main-title, .headline-lede, .headline-runner");
  const measurements = await text.evaluateAll((elements) => elements.map((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const box = element.getBoundingClientRect();
    const rects = Array.from(range.getClientRects());
    let notClipped = true;
    // Display-font ascenders may extend beyond their line box without being clipped.
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const bounds = ancestor.getBoundingClientRect();
      if (["hidden", "clip"].includes(style.overflowY)) {
        notClipped &&= rects.every((rect) => rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1);
      }
    }
    return {
      text: element.textContent,
      fits: rects.every((rect) => rect.left >= box.left - 1 && rect.right <= box.right + 1),
      notClipped,
    };
  }));
  expect(measurements.length).toBeGreaterThan(0);
  for (const measurement of measurements) {
    expect(measurement.fits, measurement.text ?? "").toBe(true);
    expect(measurement.notClipped, measurement.text ?? "").toBe(true);
  }
}

async function paintedTextContrast(page: Page, selectors: string[]) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const runs = await page.locator(selectors.join(",")).evaluateAll((elements) => elements.flatMap((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const runs = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const style = getComputedStyle(node.parentElement!);
      runs.push({
        text: node.textContent.trim(),
        element: node.parentElement!.className || node.parentElement!.tagName,
        color: style.color.match(/[\d.]+/g)!.map(Number),
        threshold: parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5,
        rects: Array.from(range.getClientRects(), (rect) => ({
          left: rect.left + scrollX, right: rect.right + scrollX, top: rect.top + scrollY, bottom: rect.bottom + scrollY,
        })),
      });
    }
    return runs;
  }));
  const before = await page.screenshot({ fullPage: true, animations: "disabled", scale: "css" });
  // Hide ink, not elements: retain exactly the same layout, art, masks, and overlays.
  const hidden = await page.addStyleTag({ content: "main * { color: transparent !important; text-shadow: none !important; -webkit-text-stroke: 0 !important; }" });
  let after: Buffer;
  try {
    after = await page.screenshot({ fullPage: true, animations: "disabled", scale: "css" });
  } finally {
    await hidden.evaluate((node) => node.parentNode?.removeChild(node));
  }
  const { data: painted, info } = await sharp(before).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const background = await sharp(after).removeAlpha().raw().toBuffer();
  expect(background.length).toBe(painted.length);
  function luminance(channels: number[]) {
    const values = channels.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
  }
  return runs.filter((run) => run.rects.length > 0).map((run) => {
    let minimum = Infinity;
    for (const rect of run.rects) {
      for (let y = Math.max(0, Math.floor(rect.top)); y < Math.min(info.height, Math.ceil(rect.bottom)); y++) {
        for (let x = Math.max(0, Math.floor(rect.left)); x < Math.min(info.width, Math.ceil(rect.right)); x++) {
          const offset = (y * info.width + x) * info.channels;
          const paper = [background[offset]!, background[offset + 1]!, background[offset + 2]!];
          const changed = paper.reduce((sum, value, channel) => sum + Math.abs(value - painted[offset + channel]!), 0);
          if (changed <= 6) continue;
          const alpha = run.color[3] ?? 1;
          const foreground = luminance(run.color.slice(0, 3).map((value, channel) => value * alpha + paper[channel]! * (1 - alpha)));
          const backdrop = luminance(paper);
          minimum = Math.min(minimum, (Math.max(foreground, backdrop) + 0.05) / (Math.min(foreground, backdrop) + 0.05));
        }
      }
    }
    return { text: run.text, element: run.element, minimum, threshold: run.threshold };
  });
}

for (const width of [320, 390, 768, 1440] as const) {
  for (const theme of ["dark", "light"] as const) {
    test(`leaderboard readable ranking ${width} ${theme}`, async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await openLeaderboard(page, theme);
      await expect(page).toHaveTitle(/Вечерен брой/);
      const ranking = page.getByRole("table", { name: "Класиране" });
      const entries = fixtureLeaderboard(30);
      await expect(ranking.locator("tbody tr")).toHaveCount(30);
      await expect(ranking.getByRole("rowheader", { name: "Борис", exact: true })).toHaveCount(2);
      await expect(ranking.getByRole("rowheader")).toHaveText(entries.map((entry) => entry.displayName));
      await expect(page.locator(".headline-runner bdi")).toHaveText(entries.slice(1, 3).map((entry) => entry.displayName));
      await expect(page.locator(".headline-portrait, .headline-main img")).toHaveCount(0);
      await expect(ranking).toHaveAccessibleDescription(/Подредбата е по победи/);
      await expect(ranking.locator("caption")).toBeInViewport();
      await expect(ranking.locator("tbody tr").first()).toBeInViewport({ ratio: 1 });
      if (width === 1440) {
        const masthead = await page.locator(".masthead").boundingBox();
        const caption = await ranking.locator("caption").boundingBox();
        expect(caption!.y - masthead!.y).toBeLessThanOrEqual(600);
        await expect(page.locator(".masthead")).toHaveCSS("text-align", /^(left|start)$/);
      }
      await expect(page.locator(".masthead time")).toHaveAttribute("datetime", LEADERBOARD_FIXTURE_AS_OF.toISOString());
      await expect(page.locator(".masthead time")).toContainText(/17(?:\.09\.|\s+септември\s+)2026/);
      await expect(page.locator(".newspaper-page")).not.toContainText(/Брой №/);
      await expectEditorialTextFits(page);
      const headers = await ranking.getByRole("columnheader").evaluateAll((cells) => cells.map((cell) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        const text = range.getBoundingClientRect();
        const box = cell.getBoundingClientRect();
        const style = getComputedStyle(cell);
        return {
          label: cell.textContent,
          lines: range.getClientRects().length,
          fits: text.left >= box.left + parseFloat(style.paddingLeft) - 1
            && text.right <= box.right - parseFloat(style.paddingRight) + 1,
        };
      }));
      expect(headers).toHaveLength(5);
      for (const header of headers) {
        expect(header.lines, `${header.label} must stay on one line`).toBe(1);
        expect(header.fits, `${header.label} must fit its cell`).toBe(true);
      }
      const namesFit = await ranking.locator("tbody th").evaluateAll((cells) => cells.every((cell) => cell.scrollWidth <= cell.clientWidth));
      expect(namesFit).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByText("Runtime Error", { exact: true })).toHaveCount(0);
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      const accessibility = await new AxeBuilder({ page }).include("main").analyze();
      expect(accessibility.violations).toEqual([]);
      const unresolvedContrast = accessibility.incomplete.filter((rule) => rule.id === "color-contrast").flatMap((rule) => rule.nodes);
      const selectors = new Set(['th[aria-label="Място"]', ".masthead time", ".headline-runner-wins"]);
      for (const node of unresolvedContrast) {
        expect(node.target).toHaveLength(1);
        expect(typeof node.target[0]).toBe("string");
        selectors.add(node.target[0] as string);
      }
      const contrast = await paintedTextContrast(page, [...selectors]);
      await testInfo.attach("painted-contrast", { body: JSON.stringify(contrast), contentType: "application/json" });
      for (const result of contrast) {
        expect.soft(Number.isFinite(result.minimum), `Painted text was sampled: ${result.element}: ${result.text}`).toBe(true);
        expect.soft(result.minimum, `${result.element}: ${result.text}`).toBeGreaterThanOrEqual(result.threshold);
      }
      await tabToRanking(page, page.getByRole("region", { name: "Класиране на играчите" }));
      expect(errors).toEqual([]);
      await expect(page.getByText("Runtime Error", { exact: true })).toHaveCount(0);
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      const screenshot = testInfo.outputPath("leaderboard.png");
      await page.screenshot({ path: screenshot });
      await testInfo.attach("leaderboard", { path: screenshot, contentType: "image/png" });
    });
  }
}

for (const fixture of ["fixture", "fixture-single", "fixture-three", "empty", "unavailable"] as const) {
  test(`leaderboard ${fixture} compact state`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await openLeaderboard(page, "light", fixture);
    if (fixture === "empty" || fixture === "unavailable") {
      await expect(page.locator(`[data-state="${fixture}"]`)).toBeVisible();
      await expect(page.getByRole("table")).toHaveCount(0);
      await expect(page.locator(".headline-runner, .newspaper-page time")).toHaveCount(0);
      const actions = await page.locator(".empty-cta").boundingBox();
      expect(actions!.y + actions!.height).toBeLessThan(750);
      await expect(page.locator("main").getByRole("alert")).toHaveCount(fixture === "unavailable" ? 1 : 0);
    } else {
      const count = fixture === "fixture-single" ? 1 : fixture === "fixture-three" ? 3 : 18;
      await expect(page.locator("tbody tr")).toHaveCount(count);
      await expect(page.locator(".headline-runner")).toHaveCount(Math.min(2, count - 1));
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const width of [320, 390, 768, 1440] as const) {
  for (const theme of ["dark", "light"] as const) {
    test(`leaderboard enlarged text remains readable and keyboard-scrollable ${width} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openLeaderboard(page, theme);
      const originalSize = await page.locator(".headline-lede").evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
      await page.evaluate(() => {
        const size = parseFloat(getComputedStyle(document.documentElement).fontSize);
        document.documentElement.style.fontSize = `${size * 2}px`;
        // Synthetic stress data only; component tests prove the same names arrive intact via props.
        const names = ["АлександърБезИнтервалиЗаПроверка".repeat(3), "ليلى 42", "אביב 17"];
        document.querySelectorAll(".headline-main bdi").forEach((node, index) => { node.textContent = names[index]!; });
        document.querySelectorAll("tbody th bdi").forEach((node, index) => {
          if (index < names.length) node.textContent = names[index]!;
        });
      });
      expect(await page.locator(".headline-lede").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(originalSize * 1.9);
      await expectEditorialTextFits(page);
      const region = page.getByRole("region", { name: "Класиране на играчите" });
      const ranking = region.getByRole("table", { name: "Класиране" });
      await expect(ranking.locator("tbody tr")).toHaveCount(30);
      const cells = await ranking.locator("th, td").evaluateAll((elements) => elements.map((cell) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        const text = range.getBoundingClientRect();
        const box = cell.getBoundingClientRect();
        return { fits: text.left >= box.left - 1 && text.right <= box.right + 1, width: box.width };
      }));
      expect(cells.every((cell) => cell.fits && cell.width > 0)).toBe(true);
      expect(await ranking.getByRole("columnheader", { name: "Играч", exact: true }).evaluate((cell) => cell.clientWidth)).toBeGreaterThanOrEqual(136);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const overflows = await region.evaluate((element) => element.scrollWidth > element.clientWidth);
      if (width < 1440) expect(overflows).toBe(true);
      await tabToRanking(page, region);
      if (overflows) {
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      }
      const rate = ranking.locator("tbody tr").first().locator("td").last();
      await rate.scrollIntoViewIfNeeded();
      const rateBox = await rate.boundingBox();
      const regionBox = await region.boundingBox();
      expect(rateBox!.x + rateBox!.width).toBeLessThanOrEqual(regionBox!.x + regionBox!.width + 1);
      await expect(rate).toContainText("%");
    });
  }
}

test("leaderboard retry requests the route again and recovers after a synthetic outage", async ({ page }) => {
  await openLeaderboard(page, "dark", "unavailable");
  let retried = false;
  await page.route(/\/leaderboard(?:\?_rsc=[^&]*)?$/, async (route) => {
    retried = true;
    const url = new URL(route.request().url());
    url.searchParams.set("visualLeaderboard", "fixture-single");
    const response = await route.fetch({ url: url.toString() });
    await route.fulfill({ response });
  });
  const retry = page.getByRole("link", { name: "Опитай отново" });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("table", { name: "Класиране" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  expect(retried).toBe(true);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});
