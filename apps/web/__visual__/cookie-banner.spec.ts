import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

const ROUTES = [
  { name: "вход", path: "/sign-in" },
  { name: "създаване", path: "/create?visualAuth=1" },
  { name: "досие", path: "/account?visualAuth=1" },
  { name: "правила-върколак", path: "/werewolf/rules" },
  { name: "правила-мафия", path: "/mafia/rules" },
] as const;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const viewport of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`@cookie-geometry ${viewport.name} ${route.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gateDeferredWidgets(page);
      await page.goto(route.path, { waitUntil: "load" });
      const before = await anchorGeometry(page);
      const notice = page.locator("[data-cookie-banner]");
      await expect.poll(async () => {
        await page.evaluate(() => window.__releaseDeferredCallbacks?.());
        return notice.count();
      }).toBe(1);
      await expect(notice).toBeVisible();
      const after = await anchorGeometry(page);
      expect(after.mainTop).toBeCloseTo(before.mainTop, 1);
      expect(after.headingTop).toBeCloseTo(before.headingTop, 1);

      // The notice is deferred: it follows the page content instead of floating over it.
      await notice.scrollIntoViewIfNeeded();
      await expectNoticeBounds(page);
      const geometry = await page.evaluate(() => {
        const bannerElement = document.querySelector<HTMLElement>("[data-cookie-banner]");
        const banner = bannerElement?.getBoundingClientRect();
        const main = document.getElementById("main-content")?.getBoundingClientRect();
        if (!bannerElement || !banner || !main) {
          return null;
        }

        const intersects = (a: DOMRect, b: DOMRect) => (
          a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
        );
        const visibleTargets = Array.from(document.querySelectorAll<HTMLElement>(
          "main h1, main a, main button, main input, main select, main textarea, main [role='button']",
        )).filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0
            && rect.bottom > 0 && rect.top < innerHeight;
        });

        return {
          position: getComputedStyle(bannerElement).position,
          bannerTop: banner.top + scrollY,
          mainBottom: main.bottom + scrollY,
          banner: { left: banner.left, right: banner.right },
          collisions: visibleTargets.filter((element) => intersects(banner, element.getBoundingClientRect())).map(
            (element) => element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 80) || element.tagName,
          ),
        };
      });

      expect(geometry).not.toBeNull();
      expect(geometry?.position).toBe("static");
      expect(geometry?.bannerTop).toBeGreaterThanOrEqual((geometry?.mainBottom ?? 0) - 1);
      expect(geometry?.banner.left).toBeGreaterThanOrEqual(0);
      expect(geometry?.banner.right).toBeLessThanOrEqual(viewport.width);
      expect(geometry?.collisions).toEqual([]);

      const accessibility = await new AxeBuilder({ page })
        .include("[data-cookie-banner]")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(accessibility.violations).toEqual([]);

      await page.getByRole("button", { name: "Разбрах" }).click();
      await expect(notice).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => localStorage.getItem("cookie-consent"))).toBe("1");
    });
  }
}

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [320, 390, 768]) {
      test(`@cookie-geometry play dock to home ${family} ${theme} ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
        await gateDeferredWidgets(page, theme);
        await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
        const role = family === "mafia" ? "commissioner" : "seer";
        await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=night&players=8&role=${role}`);
        await expect(page.locator(".site-chrome")).toHaveAttribute("data-room", "true");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.locator(".play-stage")).toHaveAttribute("data-layout-ready", "true");
        const dock = page.locator("[data-play-command-surface]");
        await expect(dock).toHaveAttribute("data-compact", "true");
        await expect(dock).toHaveAttribute("data-expanded", "false");
        const notice = page.locator("[data-cookie-banner]");
        await expect.poll(async () => {
          await page.evaluate(() => window.__releaseDeferredCallbacks?.());
          return notice.count();
        }).toBe(1);
        await expect(notice).toBeVisible();
        await expect(notice).toHaveCSS("position", "fixed");
        await page.evaluate(() => document.fonts.ready);

        const banner = await expectNoticeBounds(page);
        if (width <= 760) {
          expect(banner.x).toBeCloseTo(12, 1);
          expect(banner.x + banner.width).toBeCloseTo(width - 12, 1);
        }
        const dockBounds = await dock.boundingBox();
        expect(dockBounds).not.toBeNull();
        expect(banner.y + banner.height).toBeLessThanOrEqual(dockBounds!.y);

        await dock.getByRole("button", { name: "Покажи личния ход", exact: true }).click();
        await expect(dock).toHaveAttribute("data-expanded", "true");
        await expect(notice).toHaveCSS("visibility", "hidden");
        await dock.getByRole("button", { name: "Скрий личния ход", exact: true }).click();
        await expect(dock).toHaveAttribute("data-expanded", "false");
        await expect(notice).toBeVisible();
        await expectNoticeBounds(page);
        await dock.getByRole("button", { name: "Покажи личния ход", exact: true }).click();
        await expect(dock).toHaveAttribute("data-expanded", "true");
        await expect(notice).toHaveCSS("visibility", "hidden");

        const documentMarker = await page.evaluate(() => {
          const marker = crypto.randomUUID();
          document.documentElement.dataset.cookieNavigation = marker;
          return marker;
        });
        await page.getByRole("link", { name: "Сенките, начало", exact: true }).click();
        await expect(page).toHaveURL("/");
        await expect(page.locator("html")).toHaveAttribute("data-cookie-navigation", documentMarker);
        await expect(page.locator(".site-chrome")).toHaveAttribute("data-route", "/");
        await expect(page.locator(".site-chrome")).not.toHaveAttribute("data-room");
        await expect(page.locator("main.landing-shell")).toBeVisible();
        // Cache Components retains the expanded dock. It must not hide the active page's notice.
        await expect(dock).toBeAttached();
        await expect(dock).toHaveAttribute("data-expanded", "true");
        await expect(dock).toBeHidden();
        await expect(notice).toHaveCount(1);
        await expect(notice).toBeVisible();
        await expect(notice).toHaveCSS("position", "static");
        await notice.scrollIntoViewIfNeeded();
        await expectNoticeBounds(page);
        expect(await notice.evaluate((element) => element.getBoundingClientRect().top
          >= document.getElementById("main-content")!.getBoundingClientRect().bottom - 1)).toBe(true);
        expect(await page.evaluate(() => localStorage.getItem("cookie-consent"))).toBeNull();
        await notice.getByRole("button", { name: "Разбрах", exact: true }).click();
        await expect(notice).toHaveCount(0);
        expect(await page.evaluate(() => localStorage.getItem("cookie-consent"))).toBe("1");
      });
    }
  }
}

async function expectNoticeBounds(page: Page) {
  const notice = page.locator("[data-cookie-banner]");
  const banner = await notice.boundingBox();
  const button = await notice.getByRole("button", { name: "Разбрах", exact: true }).boundingBox();
  const viewport = page.viewportSize()!;
  expect(banner).not.toBeNull();
  expect(button).not.toBeNull();
  expect(banner!.width).toBeGreaterThan(0);
  expect(banner!.height).toBeGreaterThan(0);
  expect(banner!.x).toBeGreaterThanOrEqual(0);
  expect(banner!.y).toBeGreaterThanOrEqual(0);
  expect(banner!.x + banner!.width).toBeLessThanOrEqual(viewport.width);
  expect(banner!.y + banner!.height).toBeLessThanOrEqual(viewport.height);
  expect(button!.width).toBeGreaterThanOrEqual(44);
  expect(button!.height).toBeGreaterThanOrEqual(44);
  expect(button!.x).toBeGreaterThanOrEqual(banner!.x);
  expect(button!.y).toBeGreaterThanOrEqual(banner!.y);
  expect(button!.x + button!.width).toBeLessThanOrEqual(banner!.x + banner!.width);
  expect(button!.y + button!.height).toBeLessThanOrEqual(banner!.y + banner!.height);
  return banner!;
}

async function gateDeferredWidgets(page: Page, theme = "dark") {
  await page.addInitScript((selectedTheme) => {
    const idleCallbacks: IdleRequestCallback[] = [];
    localStorage.setItem("werewolf-theme", selectedTheme);
    localStorage.removeItem("cookie-consent");
    localStorage.setItem("welcome-modal-shown", "1");
    localStorage.setItem("tutorial-completed", "1");
    window.requestIdleCallback = (callback: IdleRequestCallback) => {
      idleCallbacks.push(callback);
      window.__releaseDeferredCallbacks = () => {
        for (const queuedCallback of idleCallbacks.splice(0)) {
          queuedCallback({ didTimeout: false, timeRemaining: () => 50 });
        }
      };
      return idleCallbacks.length;
    };
    window.cancelIdleCallback = () => {};
  }, theme);
}

async function anchorGeometry(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector("main")?.getBoundingClientRect();
    const heading = document.querySelector("main h1")?.getBoundingClientRect();
    if (!main || !heading) {
      throw new Error("Липсва основна геометрия на страницата.");
    }
    return { mainTop: main.top, headingTop: heading.top };
  });
}

declare global {
  interface Window {
    __releaseDeferredCallbacks?: () => void;
  }
}
