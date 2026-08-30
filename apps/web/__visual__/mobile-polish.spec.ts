import { expect, test } from "playwright/test";

async function openCreateDetails(page: import("playwright/test").Page) {
  await page.goto("/werewolf/create?visualAuth=1", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByRole("button", { name: "Настрой детайлите" }).click();
  await page.waitForTimeout(360);
  return page.getByRole("dialog", { name: "Настрой детайлите" });
}

for (const viewport of [
  { name: "compact", width: 320, height: 568 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test(`create workspace owns the ${viewport.name} viewport and locks the page`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const dialog = await openCreateDetails(page);
    await expect(dialog).toBeVisible();

    const geometry = await dialog.evaluate((element) => {
      const rectangle = element.getBoundingClientRect();
      const rootStyle = getComputedStyle(document.documentElement);
      const bodyStyle = getComputedStyle(document.body);
      return {
        top: rectangle.top,
        left: rectangle.left,
        width: rectangle.width,
        height: rectangle.height,
        rootOverflow: rootStyle.overflow,
        bodyOverflow: bodyStyle.overflow,
      };
    });

    expect(geometry.top).toBeLessThanOrEqual(1);
    expect(geometry.left).toBeLessThanOrEqual(1);
    expect(geometry.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(geometry.height).toBeGreaterThanOrEqual(viewport.height - 1);
    expect(geometry.rootOverflow).toBe("hidden");
    expect(geometry.bodyOverflow).toBe("hidden");

    const pageScrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(80);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScrollBefore);
  });

  test(`create preset roles stay readable and horizontally browsable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const dialog = await openCreateDetails(page);
    const gallery = dialog.locator('.role-carousel[data-layout="workspace"][data-readonly="true"]');
    const cards = gallery.locator(".role-tile-large");
    await expect(cards.first()).toBeVisible();

    const cardWidth = await cards.first().evaluate((element) => element.getBoundingClientRect().width);
    const galleryGeometry = await gallery.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: getComputedStyle(element).overflowX,
    }));

    expect(cardWidth).toBeGreaterThanOrEqual(150);
    expect(galleryGeometry.overflowX).toBe("auto");
    expect(galleryGeometry.scrollWidth).toBeGreaterThan(galleryGeometry.clientWidth + 40);
  });
}

test("tutorial puts the lesson before secondary mobile chrome", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tutorial?step=1", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const progress = page.locator(".tutorial-progress");
  const stage = page.locator(".tutorial-slide-stage");
  const navigation = page.locator(".tutorial-nav");
  await expect(stage).toBeVisible();

  const [progressBox, stageBox, navigationBox] = await Promise.all([
    progress.boundingBox(),
    stage.boundingBox(),
    navigation.boundingBox(),
  ]);

  expect(progressBox).not.toBeNull();
  expect(stageBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(progressBox!.height).toBeLessThanOrEqual(72);
  expect(stageBox!.y).toBeLessThanOrEqual(230);
  expect(navigationBox!.height).toBeLessThanOrEqual(72);
  await expect(page.getByRole("link", { name: "Продължи към игра" })).toHaveCount(0);
});

test("tutorial offers the game handoff on the final scene", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tutorial?step=6", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: "Продължи към игра" })).toBeVisible();
});

test("friends brings the working ledger into the first mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/friends?visualAuth=1", { waitUntil: "domcontentloaded" });
  const board = page.locator(".friends-board");
  await expect(board).toBeVisible();
  const box = await board.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThanOrEqual(420);
});

test("achievements reveals progress before the mobile fold", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/achievements?visualAuth=1&visualAchievements=fixture", { waitUntil: "domcontentloaded" });
  const progress = page.locator(".achievement-wreath");
  await expect(progress).toBeVisible();
  const box = await progress.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThanOrEqual(460);
});

test("compact chrome uses an intentional short wordmark and full touch targets", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const wordmark = page.locator(".site-chrome > .site-brand .site-brand-wordmark");
  await expect(wordmark).toBeVisible();
  const wordmarkGeometry = await wordmark.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    visibleText: [...element.children]
      .filter((child) => getComputedStyle(child).display !== "none")
      .map((child) => child.textContent?.trim())
      .filter(Boolean),
  }));
  expect(wordmarkGeometry.scrollWidth).toBeLessThanOrEqual(wordmarkGeometry.clientWidth + 1);
  expect(wordmarkGeometry.visibleText).toEqual(["Върколак"]);

  for (const control of [
    page.getByRole("button", { name: "Отвори менюто" }),
    page.getByRole("banner").getByRole("link", { name: "Играй", exact: true }),
  ]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test("audited mobile controls keep a 44px interaction target", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/offline", { waitUntil: "domcontentloaded" });
  const retry = await page.getByRole("button", { name: "Опитай отново" }).boundingBox();
  expect(retry).not.toBeNull();
  expect(retry!.width).toBeGreaterThanOrEqual(44);
  expect(retry!.height).toBeGreaterThanOrEqual(44);

  await page.goto("/faq", { waitUntil: "domcontentloaded" });
  const faqFilter = await page.getByRole("button", { name: "Всички", exact: true }).boundingBox();
  expect(faqFilter).not.toBeNull();
  expect(faqFilter!.height).toBeGreaterThanOrEqual(44);

  const dialog = await openCreateDetails(page);
  await dialog.getByRole("button", { name: "Настрой ръчно", exact: true }).click();
  const increment = dialog.getByRole("button", { name: /Добави/ }).first();
  const incrementBox = await increment.boundingBox();
  expect(incrementBox).not.toBeNull();
  expect(incrementBox!.width).toBeGreaterThanOrEqual(44);
  expect(incrementBox!.height).toBeGreaterThanOrEqual(44);
});

test("mobile play table is visible before its first measured layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const NativeResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class DelayedResizeObserver extends NativeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          window.setTimeout(() => callback(entries, observer), 1_200);
        });
      }
    };
  });

  await page.goto(
    "/play/VISUAL?visualGame=1&phase=night&family=werewolves&players=8&role=seer",
    { waitUntil: "domcontentloaded" },
  );

  const stage = page.locator(".play-stage");
  const table = page.locator("[data-table-scene]");
  await expect(stage).toBeVisible();
  await expect(stage).not.toHaveAttribute("data-layout-ready", "true", { timeout: 700 });
  await expect(table).toBeVisible();
  expect(Number(await table.evaluate((element) => getComputedStyle(element).opacity))).toBeGreaterThan(0.95);
});

test("compact night-action dock does not cover a visible seat target", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(
    "/play/VISUAL?visualGame=1&phase=night&family=werewolves&players=8&role=seer",
    { waitUntil: "domcontentloaded" },
  );

  const dock = page.locator('[data-play-command-surface][data-expanded="false"]');
  const seats = page.locator("[data-seat-user-id]");
  await expect(dock).toBeVisible();
  await expect(seats.first()).toBeVisible();

  const dockBox = await dock.boundingBox();
  expect(dockBox).not.toBeNull();
  const coveredSeats = await seats.evaluateAll((elements, dockTop) =>
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      const overlapsDock = rect.top < dockTop && rect.bottom > dockTop && rect.bottom > 0;
      return overlapsDock ? [element.getAttribute("data-seat-user-id")] : [];
    }),
    dockBox!.y,
  );

  expect(coveredSeats).toEqual([]);
});

test("compact system and account states stay inside 320px without splitting normal words", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });

  await page.goto("/missing-audit-route", { waitUntil: "domcontentloaded" });
  const notFound = page.locator(".not-found-card");
  await expect(notFound).toBeVisible();
  const notFoundBox = await notFound.boundingBox();
  expect(notFoundBox).not.toBeNull();
  expect(notFoundBox!.x).toBeGreaterThanOrEqual(0);
  expect(notFoundBox!.x + notFoundBox!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.goto("/leaderboard?visualLeaderboard=unavailable", { waitUntil: "domcontentloaded" });
  const unavailableHeading = page.getByRole("heading", { name: "Данните за броя не пристигнаха" });
  const unavailableBox = await unavailableHeading.boundingBox();
  expect(unavailableBox).not.toBeNull();
  expect(unavailableBox!.x + unavailableBox!.width).toBeLessThanOrEqual(320);

  await page.goto("/account?visualAuth=1", { waitUntil: "domcontentloaded" });
  const accountName = page.getByRole("heading", { level: 1, name: "Визуален играч" });
  await expect(accountName).toBeVisible();
  const firstWordLineCount = await accountName.evaluate((element) => {
    const text = element.firstChild;
    if (!text) return 0;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, "Визуален".length);
    return range.getClientRects().length;
  });
  expect(firstWordLineCount).toBe(1);
});

test("desktop play stage reserves its final height while measurement is pending", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const NativeResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class DelayedResizeObserver extends NativeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          window.setTimeout(() => callback(entries, observer), 1_200);
        });
      }
    };
  });

  await page.goto(
    "/play/VISUAL?visualGame=1&phase=night&family=werewolves&players=8&role=seer",
    { waitUntil: "domcontentloaded" },
  );

  const stage = page.locator(".play-stage");
  await expect(stage).not.toHaveAttribute("data-layout-ready", "true", { timeout: 700 });
  const pendingHeight = (await stage.boundingBox())?.height ?? 0;
  expect(pendingHeight).toBeGreaterThanOrEqual(459);

  await expect(stage).toHaveAttribute("data-layout-ready", "true", { timeout: 3_000 });
  const measuredHeight = (await stage.boundingBox())?.height ?? 0;
  expect(Math.abs(measuredHeight - pendingHeight)).toBeLessThanOrEqual(1);
});
