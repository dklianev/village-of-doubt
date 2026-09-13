import { expect, test, type Page } from "playwright/test";

const WIDTHS = [320, 640, 769, 820, 900, 1024] as const;

test.use({ storageState: { cookies: [], origins: [] }, contextOptions: { reducedMotion: "reduce" } });

for (const theme of ["dark", "light"] as const) {
  for (const width of WIDTHS) {
    test(`@homepage-chrome guest navigation and fresh cookies: ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
      await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem("werewolf-theme", selectedTheme);
        const callbacks = new Map<number, IdleRequestCallback>();
        let nextId = 0;
        window.requestIdleCallback = (callback) => {
          callbacks.set(++nextId, callback);
          return nextId;
        };
        window.cancelIdleCallback = (id) => { callbacks.delete(id); };
        window.__releaseHomepageWidgets = () => {
          const queued = [...callbacks.values()];
          callbacks.clear();
          for (const callback of queued) {
            callback({ didTimeout: false, timeRemaining: () => 50 });
          }
        };
      }, theme);

      await page.goto("/", { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const header = page.locator("header.site-chrome:not([data-fallback])");
      await expect(header.locator('[data-auth-state="guest"]')).toHaveCount(1);
      await assertHeaderContent(page);

      const before = await contentGeometry(page);
      const notice = page.getByRole("region", { name: "Бисквитки" });
      await expect(notice).toHaveCount(0);
      await expect.poll(async () => {
        await page.evaluate(() => window.__releaseHomepageWidgets?.());
        return notice.count();
      }).toBe(1);
      await expect(notice).toBeVisible();
      await expect(notice).toHaveCSS("position", "static");
      const banner = await notice.boundingBox();
      const chrome = await header.boundingBox();
      expect(banner).not.toBeNull();
      expect(chrome).not.toBeNull();
      const after = await contentGeometry(page);
      expect(before.headingTop).toBeGreaterThanOrEqual(chrome!.y + chrome!.height);
      expect(banner!.x).toBeGreaterThanOrEqual(0);
      expect(banner!.x + banner!.width).toBeLessThanOrEqual(width);
      expect(banner!.y).toBeGreaterThanOrEqual(chrome!.y + chrome!.height);
      expect(after.mainTop).toBeCloseTo(before.mainTop, 0);
      expect(after.mainBottom).toBeCloseTo(before.mainBottom, 0);
      expect(after.headingTop).toBeCloseTo(before.headingTop, 0);
      const scrollTop = await page.evaluate(() => scrollY);
      expect(banner!.y + scrollTop).toBeGreaterThanOrEqual(after.mainBottom);
      expect(banner!.y + scrollTop).toBeGreaterThanOrEqual(after.headingBottom);
      const footer = await page.locator(".site-footer").boundingBox();
      expect(footer).not.toBeNull();
      expect(banner!.y + banner!.height).toBeLessThanOrEqual(footer!.y);
      expect(await notice.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await expect(notice.getByRole("link", { name: "политиката за поверителност" })).toHaveAttribute("href", "/privacy");

      const dismiss = notice.getByRole("button", { name: "Разбрах" });
      const dismissBox = await dismiss.boundingBox();
      expect(dismissBox!.height).toBeGreaterThanOrEqual(44);
      await dismiss.click();
      await expect(notice).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.getItem("cookie-consent"))).toBe("1");
      const dismissed = await contentGeometry(page);
      expect(dismissed.mainTop).toBeCloseTo(before.mainTop, 0);
      expect(dismissed.headingTop).toBeCloseTo(before.headingTop, 0);
      await assertHeaderContent(page);

      if (width < 1024) {
        const opener = header.getByRole("button", { name: "Отвори менюто" });
        await opener.click();
        const drawer = page.getByRole("dialog", { name: "Навигация" });
        await expect(drawer).toBeVisible();
        await expect(drawer.getByRole("link", { name: "Влез", exact: true })).toHaveAttribute("href", "/sign-in");
        await expect(drawer.getByRole("link", { name: "Върколак", exact: true })).toHaveAttribute("href", "/werewolf");
        await expect(drawer.getByRole("link", { name: "Мафия", exact: true })).toHaveAttribute("href", "/mafia");
        await page.keyboard.press("Escape");
        await expect(drawer).toHaveCount(0);
        await expect(opener).toBeFocused();
      } else {
        await expect(header.getByRole("navigation", { name: "Основна навигация" })).toBeVisible();
        await expect(header.getByRole("link", { name: "Влез", exact: true })).toBeVisible();
      }

      await page.reload({ waitUntil: "load" });
      await expect(page.locator("header.site-chrome:not([data-fallback]) [data-auth-state='guest']")).toHaveCount(1);
      await page.evaluate(() => window.__releaseHomepageWidgets?.());
      await expect(notice).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.getItem("cookie-consent"))).toBe("1");
    });
  }
}

async function contentGeometry(page: Page) {
  return page.evaluate(() => {
    const main = document.getElementById("main-content");
    const heading = main?.querySelector("h1");
    if (!main || !heading) throw new Error("Missing homepage content or heading");
    return {
      mainTop: main.getBoundingClientRect().top + scrollY,
      mainBottom: main.getBoundingClientRect().bottom + scrollY,
      headingTop: heading.getBoundingClientRect().top + scrollY,
      headingBottom: heading.getBoundingClientRect().bottom + scrollY,
    };
  });
}

async function assertHeaderContent(page: Page) {
  const header = page.locator("header.site-chrome:not([data-fallback])");
  const play = header.locator("button.site-play-cta:visible");
  await expect(play).toHaveCount(1);
  await expect(play).toHaveText("Играй");
  await expect(play).toHaveAttribute("aria-expanded", "false");
  const playBox = await play.boundingBox();
  expect(playBox!.width).toBeGreaterThanOrEqual(44);
  expect(playBox!.height).toBeGreaterThanOrEqual(44);

  const violations = await header.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const failures: string[] = [];
    const visible = (node: Element) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const contains = (outer: DOMRect, inner: DOMRect) => inner.left >= outer.left - 1
      && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;

    for (const control of element.querySelectorAll<HTMLElement>("a, button")) {
      if (!visible(control)) continue;
      const box = control.getBoundingClientRect();
      const name = control.getAttribute("aria-label") || control.textContent?.trim() || control.tagName;
      if (!contains(bounds, box) || box.left < 0 || box.right > innerWidth) failures.push(`${name}: outside header`);
      if (control.scrollWidth > control.clientWidth + 1) failures.push(`${name}: clipped content`);
      const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const lineBox = node.parentElement!.getBoundingClientRect();
        for (const textBox of range.getClientRects()) {
          if (textBox.width === 0 || textBox.height === 0) continue;
          // Range height includes unused font ascent/descent, not just painted glyphs.
          const clippedHorizontally = textBox.left < box.left - 1 || textBox.right > box.right + 1;
          const clippedVertically = lineBox.top < box.top - 1 || lineBox.bottom > box.bottom + 1;
          if (clippedHorizontally || clippedVertically) failures.push(`${name}: clipped text (${node.textContent?.trim()})`);
        }
      }
    }

    const groups = [...element.children].filter(visible);
    for (let index = 1; index < groups.length; index++) {
      if (groups[index - 1]!.getBoundingClientRect().right > groups[index]!.getBoundingClientRect().left + 1) {
        failures.push("Header groups overlap");
      }
    }
    return failures;
  });
  expect(violations).toEqual([]);
}

declare global {
  interface Window {
    __releaseHomepageWidgets?: () => void;
  }
}
