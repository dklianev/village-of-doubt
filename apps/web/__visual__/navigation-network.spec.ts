import { expect, test, type Page } from "playwright/test";

test.use({ contextOptions: { reducedMotion: "reduce" } });

async function prepare(page: Page, theme = "light") {
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  await page.addInitScript((theme) => {
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
    localStorage.setItem("werewolf-theme", theme);
  }, theme);
  await page.addLocatorHandler(page.getByRole("button", { name: "Collapse Cache disabled badge" }), (badge) => badge.click());
}

for (const mode of ["more", "play", "mobile-navigation", "mobile-play"] as const) {
  test(`optional ${mode} chunk failure stays local and retries without reloading`, async ({ page, context }, testInfo) => {
    const mobile = mode.startsWith("mobile");
    const width = mode === "mobile-play" ? 320 : mobile ? 390 : 1440;
    await page.setViewportSize({ width, height: 900 });
    await prepare(page, mode.endsWith("play") ? "dark" : "light");
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const header = page.locator(".site-chrome:not([data-fallback])");
    const trigger = header.getByRole("button", { name: mode === "more" ? "Още страници" : mode === "mobile-navigation" ? "Отвори менюто" : "Играй", exact: true });
    await expect(trigger).toBeEnabled();
    let intercepted = 0;
    let fail = true;
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    // Identify the actual shared panel implementation, not its dev chunk hash.
    await page.route("**/_next/static/chunks/*.js", async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes("site-drawer-content") && fail) {
        intercepted++;
        await gate;
        await route.abort("failed");
      } else {
        await route.fulfill({ response });
      }
    });
    try {
      const documentMarker = await page.evaluate(() => {
        const marker = crypto.randomUUID();
        document.documentElement.dataset.navigationTest = marker;
        return marker;
      });
      await trigger.hover();
      await trigger.focus();
      await expect.poll(() => intercepted).toBeGreaterThan(0);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.locator(".site-navigation-fallback")).toHaveCount(0);
      await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked");
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-busy", "true");
      const fallback = page.locator(".site-navigation-fallback");
      await expect(fallback.getByRole("status")).toHaveText("Зареждаме менюто...");
      release();
      await expect(fallback.getByRole("alert")).toHaveText("Менюто не се зареди.");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(trigger).toHaveAttribute("aria-busy", "false");
      expect(pageErrors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: testInfo.outputPath(`${mode}-failure.png`) });

      const isPlay = mode.endsWith("play");
      const nativeLink = fallback.getByRole("link", { name: isPlay ? "Върколак" : "Въпроси", exact: true });
      const popupPromise = context.waitForEvent("page");
      await nativeLink.click({ modifiers: ["ControlOrMeta"] });
      const popup = await popupPromise;
      await expect(popup).toHaveURL(new RegExp(isPlay ? "/werewolf/create" : "/faq"));
      await popup.close();
      await expect(fallback).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(fallback).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(fallback.getByRole("alert")).toBeVisible();
      fail = false;
      await fallback.getByRole("button", { name: "Опитай отново" }).click();
      await expect(fallback).toHaveCount(0);
      if (mobile) {
        await expect(page.getByRole("dialog", { name: isPlay ? "Какво ще играем?" : "Навигация" })).toBeVisible();
      } else {
        await expect(page.locator(isPlay ? ".site-play-panel .site-play-choices" : ".nav-dropdown-overflow:not(.site-navigation-fallback)")).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.dataset.navigationTest)).toBe(documentMarker);
      expect(pageErrors).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked");
    } finally {
      release();
    }
  });
}

test("desktop modified More navigation keeps the disclosure open", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepare(page);
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Още страници" });
  await trigger.click();
  const links = page.locator(".nav-dropdown-overflow:not(.site-navigation-fallback)");
  const popupPromise = context.waitForEvent("page");
  await links.getByRole("link", { name: "Въпроси", exact: true }).click({ modifiers: ["ControlOrMeta"] });
  await (await popupPromise).close();
  await expect(links).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("actual service worker upgrades only owned caches and serves the brand offline", async ({ page, context }, testInfo) => {
  await prepare(page);
  await page.goto("/offline");
  const brandAssets = ["/brand/senkite-wordmark.svg", "/brand/senkite-mark.svg", "/brand/apple-touch-icon.png", "/brand/icon-192.png", "/brand/icon-512.png"];
  // Registration is normally disabled on localhost. Exercise the shipped worker explicitly.
  await page.evaluate(async () => {
    for (const name of ["werewolf-mafia-shell-v5", "werewolf-mafia-art-v4", "werewolf-mafia-art-v5", "unrelated-cache"]) {
      const cache = await caches.open(name);
      await cache.put("/navigation-test-sentinel", new Response(name));
    }
    await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain("/sw.js");
  const keys = await page.evaluate(() => caches.keys());
  expect(keys).toContain("werewolf-mafia-shell-v6");
  expect(keys).toContain("werewolf-mafia-art-v5");
  expect(keys).toContain("unrelated-cache");
  expect(keys).not.toContain("werewolf-mafia-shell-v5");
  expect(keys).not.toContain("werewolf-mafia-art-v4");
  expect(await page.evaluate(async () => (await (await caches.open("werewolf-mafia-art-v5")).match("/navigation-test-sentinel"))?.text())).toBe("werewolf-mafia-art-v5");
  for (const asset of brandAssets) {
    expect(await page.evaluate(async (url) => Boolean(await (await caches.open("werewolf-mafia-shell-v6")).match(url)), asset)).toBe(true);
  }

  await context.setOffline(true);
  try {
    // A new document cannot rely on the old page's loaded CSS mask or decoded images.
    const response = await page.goto("/navigation-network-offline-probe");
    expect(response?.fromServiceWorker()).toBe(true);
    await expect(page.getByRole("heading", { name: "Лампата свети, чакаме теб." })).toBeVisible();
    const wordmark = page.getByRole("img", { name: "Сенките", exact: true });
    await expect(wordmark).toBeVisible();
    await expect(wordmark).toHaveCSS("mask-image", /senkite-wordmark\.svg/);
    for (const asset of brandAssets) {
      const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === asset);
      const result = await page.evaluate(async (url) => {
        const response = await fetch(url, { cache: "no-store" });
        return { ok: response.ok, size: (await response.arrayBuffer()).byteLength };
      }, asset);
      expect(result.ok).toBe(true);
      expect(result.size).toBeGreaterThan(0);
      expect((await responsePromise).fromServiceWorker()).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath("offline-brand.png") });
  } finally {
    await context.setOffline(false);
  }
});
