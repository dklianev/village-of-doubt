import { expect, test as base, type Locator, type Page } from "playwright/test";
import { expectDecodedImage } from "./image-readiness";

const test = base.extend<{ runtimeHealth: void }>({
  runtimeHealth: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await use();
    expect(errors, "Archive interactions must not produce runtime or console errors").toEqual([]);
  }, { auto: true }],
});

test.use({ serviceWorkers: "block" });

async function prepare(page: Page, theme: "light" | "dark", width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  await page.addInitScript((value) => {
    localStorage.setItem("werewolf-theme", value);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
}

function archive(page: Page) {
  return page.getByRole("region", { name: "Списък с дела", exact: true });
}

async function replayHrefs(rows: Locator) {
  return rows.getByRole("link", { name: /^Отвори дело №/ }).evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")!),
  );
}

function replayId(href: string) {
  return new URL(href, "http://localhost").pathname.split("/")[2]!;
}

async function expectSelection(page: Page, expected: Record<string, string | null>) {
  await expect.poll(() => {
    const params = new URL(page.url()).searchParams;
    return Object.fromEntries(Object.keys(expected).map((key) => [key, params.get(key)]));
  }).toEqual(expected);
}

async function ledgerGeometry(page: Page) {
  return archive(page).evaluate((region) => {
    const wall = region.getBoundingClientRect();
    return {
      width: wall.width,
      height: wall.height,
      rows: [...region.querySelectorAll("article")].map((row) => {
        const box = row.getBoundingClientRect();
        return { left: box.left - wall.left, top: box.top - wall.top, width: box.width, height: box.height };
      }),
    };
  });
}

async function expectReadableWrappedFilters(page: Page) {
  const form = page.getByRole("form", { name: "Филтри на архива" });
  const geometry = await form.evaluate((element) => {
    const box = (node: Element) => node.getBoundingClientRect().toJSON();
    const context = document.createElement("canvas").getContext("2d")!;
    return {
      form: box(element),
      controls: [...element.querySelectorAll("label, select, button, a")].map(box),
      fields: [...element.querySelectorAll("select")].map((select) => {
        const style = getComputedStyle(select);
        context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        // Native option nodes have no useful text rect; measure with the closed select's font.
        const available = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const range = document.createRange();
        range.selectNodeContents(select.labels![0]!);
        return {
          label: box(select.labels![0]!),
          labelText: range.getBoundingClientRect().toJSON(),
          select: box(select),
          field: box(select.parentElement!),
          fontSize: parseFloat(style.fontSize),
          available,
          options: [...select.options].map((option) => ({ text: option.text, width: context.measureText(option.text).width })),
        };
      }),
    };
  });
  for (const field of geometry.fields) {
    expect(field.label.bottom, "At 200%, each label wraps above its native select").toBeLessThanOrEqual(field.select.top + 1);
    expect(Math.abs(field.field.width - geometry.form.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(field.select.left - field.field.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(field.select.width - field.field.width), "Wrapped selects use the full field width").toBeLessThanOrEqual(2);
    expect(field.labelText.left).toBeGreaterThanOrEqual(field.field.left - 1);
    expect(field.labelText.right).toBeLessThanOrEqual(field.field.right + 1);
    expect(field.fontSize, "Text enlargement must not be compensated by shrinking the select font").toBeGreaterThanOrEqual(28);
    for (const option of field.options) {
      expect(option.width, `Selected text must fit without clipping: ${option.text}`).toBeLessThanOrEqual(field.available + 1);
    }
  }
  for (const [index, control] of geometry.controls.entries()) {
    expect(control.left).toBeGreaterThanOrEqual(geometry.form.left - 1);
    expect(control.right).toBeLessThanOrEqual(geometry.form.right + 1);
    for (const other of geometry.controls.slice(index + 1)) {
      const overlaps = control.left < other.right - 1 && control.right > other.left + 1
        && control.top < other.bottom - 1 && control.bottom > other.top + 1;
      expect(overlaps, "Filter labels, selects, submit and reset must not overlap").toBe(false);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 1440]) {
    test(`ledger geometry survives client leaderboard navigation and back ${theme} ${width}`, async ({ page }) => {
      await prepare(page, theme, width);
      let fixtureRequests = 0;
      // Keep the real Next Link navigation and loading CSS, but never request the database-backed route.
      await page.route((url) => url.pathname === "/leaderboard", async (route) => {
        const url = new URL(route.request().url());
        url.searchParams.set("visualLeaderboard", "fixture");
        fixtureRequests++;
        await route.continue({ url: url.toString() });
      });
      await page.goto("/history?visualHistory=fixture");
      await expect(archive(page).getByRole("article")).toHaveCount(8);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.evaluate(() => document.fonts.ready);
      const before = await ledgerGeometry(page);
      const identities = await replayHrefs(archive(page).getByRole("article"));
      for (const [index, row] of before.rows.entries()) {
        expect(Math.abs(row.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(row.width - before.width)).toBeLessThanOrEqual(2);
        if (index > 0) {
          const previous = before.rows[index - 1]!;
          expect(row.top - previous.top - previous.height).toBeGreaterThanOrEqual(-1);
          expect(row.top - previous.top - previous.height).toBeLessThanOrEqual(2);
        }
      }
      const documentMarker = await page.evaluate(() => {
        const marker = crypto.randomUUID();
        document.documentElement.dataset.ledgerNavigation = marker;
        return marker;
      });
      const documentRequests: string[] = [];
      page.on("request", (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests.push(request.url());
      });
      const chrome = page.locator(".site-chrome:not([data-fallback])");
      await chrome.getByRole("button", { name: width <= 390 ? "Отвори менюто" : "Още страници", exact: true }).click();
      const navigation = width <= 390
        ? page.getByRole("dialog", { name: "Навигация", exact: true })
        : page.locator(".nav-dropdown-overflow:not(.site-navigation-fallback)");
      await navigation.getByRole("link", { name: "Класация", exact: true }).click();
      await expect(page).toHaveURL(/\/leaderboard(?:\?|$)/);
      await expect(page.getByRole("table", { name: "Класиране", exact: true })).toBeVisible();
      expect(fixtureRequests).toBeGreaterThan(0);
      await expect(page.locator("html")).toHaveAttribute("data-ledger-navigation", documentMarker);
      await page.goBack();
      await expect(page).toHaveURL(/\/history\?visualHistory=fixture$/);
      await expect.poll(() => replayHrefs(archive(page).getByRole("article"))).toEqual(identities);
      await page.evaluate(() => document.fonts.ready);
      await expect.poll(() => ledgerGeometry(page), {
        message: "Client-loaded route CSS must preserve full-width continuous ledger rows, including mobile gaps",
      }).toEqual(before);
      await expect(page.locator("html")).toHaveAttribute("data-ledger-navigation", documentMarker);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(documentRequests, "Both the navbar click and Back must stay in the same client document").toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }

  for (const width of [320, 390]) {
    test(`ledger filters wrap with readable native values and keyboard controls at 200% ${theme} ${width}`, async ({ page }, testInfo) => {
      await prepare(page, theme, width);
      await page.goto("/history?visualHistory=fixture");
      await expect(archive(page).getByRole("article")).toHaveCount(8);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await expect(page.locator("html")).toHaveCSS("font-size", "32px");
      await page.evaluate(() => document.fonts.ready);
      await expectReadableWrappedFilters(page);

      await page.getByRole("form", { name: "Филтри на архива" }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`history-filters-${theme}-${width}-200.png`), animations: "disabled" });

      const family = page.getByLabel("Игра", { exact: true });
      const outcome = page.getByLabel("Победител", { exact: true });
      await expect(family).toHaveJSProperty("tagName", "SELECT");
      await expect(outcome).toHaveJSProperty("tagName", "SELECT");
      await family.focus();
      await page.keyboard.press("Home");
      await page.keyboard.press("ArrowDown");
      await expect(family).toHaveValue("werewolves");
      await page.keyboard.press("Tab");
      await expect(outcome).toBeFocused();
      await page.keyboard.press("Home");
      await page.keyboard.press("ArrowDown");
      await expect(outcome).toHaveValue("village");
      await expectReadableWrappedFilters(page);
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Покажи", exact: true })).toBeFocused();
      await page.keyboard.press("Enter");
      await expectSelection(page, { family: "werewolves", outcome: "village", visualHistory: "fixture" });
      await expect(family).toHaveValue("werewolves");
      await expect(outcome).toHaveValue("village");
      await expect(archive(page).getByRole("article").first()).toBeVisible();
      await expect(archive(page).locator("article[data-family=mafia]")).toHaveCount(0);
      await expectReadableWrappedFilters(page);

      const reset = page.getByRole("link", { name: "Изчисти", exact: true });
      await reset.focus();
      await expect(reset).toBeFocused();
      await page.keyboard.press("Enter");
      await expectSelection(page, { family: null, outcome: null, visualHistory: "fixture" });
      await expect(family).toHaveValue("all");
      await expect(outcome).toHaveValue("all");
      await expect(archive(page).getByRole("article")).toHaveCount(8);
      await expect(reset).toHaveCount(0);
      await expect(page.locator("html")).toHaveCSS("font-size", "32px");
      await expectReadableWrappedFilters(page);
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 1440]) {
    test(`ledger rows and decorative thumbnails ${theme} ${width}`, async ({ page }, info) => {
      await prepare(page, theme, width);
      await page.goto("/history?visualHistory=fixture");
      await expect(page).toHaveURL(/\/history\?visualHistory=fixture$/);
      await expect(page.getByRole("heading", { level: 1, name: "Архив на масата", exact: true })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const rows = archive(page).getByRole("article");
      await expect(rows).toHaveCount(8);
      await expect(page.getByText("8 дела на тази страница", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Игра", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Победител", { exact: true })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Страници на архива" })).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);

      const names: string[] = [];
      const familyImages = new Map<string, Set<string>>();
      for (const row of await rows.all()) {
        const link = row.getByRole("link");
        await expect(link).toHaveCount(1);
        await expect(link).toHaveAccessibleName(/^Отвори дело №\d+$/);
        const name = await link.getAttribute("aria-label");
        expect(name).not.toBeNull();
        await expect(link).toHaveAccessibleName(name!);
        names.push(name!);
        await expect(link).toHaveAttribute("href", /^\/history\/[\da-f-]+\/replay\?visualReplay=fixture$/);

        const thumbnail = row.locator("img");
        await expect(thumbnail).toHaveCount(1);
        await thumbnail.scrollIntoViewIfNeeded();
        await expect(thumbnail).toBeVisible();
        await expect(thumbnail).toHaveAttribute("alt", "");
        await expect(row.getByRole("img"), "Family thumbnails are decorative, not extra announced content").toHaveCount(0);
        await expectDecodedImage(thumbnail);
        const image = await thumbnail.evaluate((element: HTMLImageElement) => ({
          complete: element.complete,
          naturalWidth: element.naturalWidth,
          naturalHeight: element.naturalHeight,
          src: element.currentSrc,
          box: element.getBoundingClientRect().toJSON(),
        }));
        expect(image.complete).toBe(true);
        expect(image.naturalWidth).toBeGreaterThan(0);
        expect(image.naturalHeight).toBeGreaterThan(0);
        expect(image.box.width).toBeGreaterThanOrEqual(32);
        expect(image.box.height).toBeGreaterThanOrEqual(32);
        const thumbnailLimit = width <= 640 ? 64 : 144;
        expect(image.box.width).toBeLessThanOrEqual(thumbnailLimit);
        expect(image.box.height).toBeLessThanOrEqual(thumbnailLimit);
        const rowBox = (await row.boundingBox())!;
        expect(image.box.width).toBeLessThanOrEqual(rowBox.width * 0.4);
        expect(image.box.left).toBeGreaterThanOrEqual(rowBox.x);
        expect(image.box.right).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
        expect(image.box.top).toBeGreaterThanOrEqual(rowBox.y);
        expect(image.box.bottom).toBeLessThanOrEqual(rowBox.y + rowBox.height + 1);
        const family = (await row.getAttribute("data-family"))!;
        const sources = familyImages.get(family) ?? new Set<string>();
        sources.add(image.src);
        familyImages.set(family, sources);
      }
      expect(new Set(names).size, "Every record needs a unique replay accessible name").toBe(8);
      expect(new Set(await replayHrefs(rows)).size).toBe(8);
      expect([...familyImages.keys()].sort()).toEqual(["mafia", "werewolves"]);
      expect([...familyImages.get("mafia")!].every((src) => !familyImages.get("werewolves")!.has(src)),
        "The two game families must not silently use the same thumbnail").toBe(true);

      const geometry = await rows.evaluateAll((elements) => elements.map((row) => {
        const box = row.getBoundingClientRect();
        const thumbnail = row.querySelector("img")!.getBoundingClientRect();
        // Inspect text ranges as well as the page: overflow:hidden can conceal broken wrapping.
        const clippedText: string[] = [];
        const overlappingText: string[] = [];
        const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (!node.textContent?.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          if ([...range.getClientRects()].some((rect) => rect.width > 0 && (
            rect.left < box.left - 1 || rect.right > box.right + 1
            || rect.top < box.top - 1 || rect.bottom > box.bottom + 1
          ))) clippedText.push(node.textContent);
          if ([...range.getClientRects()].some((rect) => rect.width > 0
            && rect.left < thumbnail.right - 1 && rect.right > thumbnail.left + 1
            && rect.top < thumbnail.bottom - 1 && rect.bottom > thumbnail.top + 1
          )) overlappingText.push(node.textContent);
        }
        return { box: box.toJSON(), clippedText, overlappingText, scrollWidth: row.scrollWidth, clientWidth: row.clientWidth };
      }));
      const region = (await archive(page).boundingBox())!;
      for (const [index, row] of geometry.entries()) {
        expect(row.clippedText, `Clipped text in row ${index + 1}`).toEqual([]);
        expect(row.overlappingText, `Thumbnail overlaps text in row ${index + 1}`).toEqual([]);
        expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1);
        expect(Math.abs(row.box.x - region.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(row.box.width - region.width)).toBeLessThanOrEqual(2);
        if (index > 0) {
          const gap = row.box.top - geometry[index - 1]!.box.bottom;
          expect(gap, "Records form consecutive rows, not a card grid").toBeGreaterThanOrEqual(-1);
          expect(gap, "Archive rows share a continuous surface").toBeLessThanOrEqual(2);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.getByText("Runtime Error", { exact: true })).toHaveCount(0);
      await info.attach(`ledger-${theme}-${width}`, {
        body: await page.screenshot({ fullPage: true, animations: "disabled" }),
        contentType: "image/png",
      });
    });
  }
}

// Existing history-archive.spec.ts owns the empty/unavailable states and general axe checks.
// This exercises filtered pagination and row identity, including native browser restoration.
for (const { width, theme } of [{ width: 320, theme: "dark" }, { width: 1440, theme: "light" }] as const) {
  test(`ledger preserves filtered record identities across paging and back ${width}`, async ({ page }) => {
    await prepare(page, theme, width);
    await page.goto("/history?visualHistory=paginated");
    const rows = archive(page).getByRole("article");
    await expect(rows).toHaveCount(12);
    await page.getByLabel("Игра", { exact: true }).selectOption("mafia");
    await page.getByRole("button", { name: "Покажи", exact: true }).click();
    await expectSelection(page, { family: "mafia", outcome: "all", before: null, after: null, visualHistory: "paginated" });
    await expect(rows).toHaveCount(12);
    await expect(archive(page).locator("article[data-family=werewolves]")).toHaveCount(0);
    const firstPage = await replayHrefs(rows);
    const older = page.getByRole("link", { name: "По-стари дела", exact: true });
    const newer = page.getByRole("link", { name: "По-нови дела", exact: true });
    await older.click();
    await expectSelection(page, { family: "mafia", before: replayId(firstPage.at(-1)!), after: null });
    await expect(rows).toHaveCount(6);
    await expect(page.getByText("6 дела на тази страница", { exact: true })).toBeVisible();
    const secondPage = await replayHrefs(rows);
    expect(secondPage.every((href) => !firstPage.includes(href))).toBe(true);
    await expect(older).toHaveCount(0);
    await newer.click();
    await expectSelection(page, { family: "mafia", after: replayId(secondPage[0]!), before: null });
    await expect.poll(() => replayHrefs(rows)).toEqual(firstPage);
    await expect(newer).toHaveCount(0);
    await older.click();
    await expect.poll(() => replayHrefs(rows)).toEqual(secondPage);
    const secondPageUrl = page.url();

    await page.getByLabel("Победител", { exact: true }).selectOption("mafia");
    await page.getByRole("button", { name: "Покажи", exact: true }).click();
    await expectSelection(page, { family: "mafia", outcome: "mafia", before: null, after: null, visualHistory: "paginated" });
    await expect(rows).toHaveCount(5);
    await expect(page.getByText("5 дела на тази страница", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Страници на архива" })).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(secondPageUrl);
    await expect(page.getByLabel("Игра", { exact: true })).toHaveValue("mafia");
    await expect(page.getByLabel("Победител", { exact: true })).toHaveValue("all");
    await expect.poll(() => replayHrefs(rows)).toEqual(secondPage);

    await rows.first().getByRole("link").click();
    await expect(page).toHaveURL(new URL(secondPage[0]!, secondPageUrl).href);
    await expect(page.getByRole("heading", { name: "Ходът на вечерта", exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(secondPageUrl);
    await expect.poll(() => replayHrefs(rows)).toEqual(secondPage);
    await expect(page.getByLabel("Игра", { exact: true })).toHaveValue("mafia");
    await page.getByRole("link", { name: "Изчисти", exact: true }).click();
    await expectSelection(page, { family: null, outcome: null, before: null, after: null, visualHistory: "paginated" });
    await expect(page.getByLabel("Игра", { exact: true })).toHaveValue("all");
    await expect(page.getByLabel("Победител", { exact: true })).toHaveValue("all");
    await expect(rows).toHaveCount(12);
    await expect(older).toBeVisible();
    await expect(newer).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
