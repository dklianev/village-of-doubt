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

      const geometry = await page.evaluate(() => {
        const banner = document.querySelector<HTMLElement>("[data-cookie-banner]")?.getBoundingClientRect();
        const chrome = document.querySelector<HTMLElement>(".site-chrome")?.getBoundingClientRect();
        if (!banner || !chrome) {
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
          banner: { top: banner.top, bottom: banner.bottom, left: banner.left, right: banner.right },
          chromeBottom: chrome.bottom,
          collisions: visibleTargets.filter((element) => intersects(banner, element.getBoundingClientRect())).map(
            (element) => element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 80) || element.tagName,
          ),
        };
      });

      expect(geometry).not.toBeNull();
      expect(geometry?.banner.top).toBeGreaterThanOrEqual((geometry?.chromeBottom ?? 0) + 6);
      expect(geometry?.banner.top).toBeLessThanOrEqual((geometry?.chromeBottom ?? 0) + 24);
      expect(geometry?.banner.bottom).toBeLessThan(viewport.height * 0.45);
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

async function gateDeferredWidgets(page: Page) {
  await page.addInitScript(() => {
    const idleCallbacks: IdleRequestCallback[] = [];
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
  });
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
