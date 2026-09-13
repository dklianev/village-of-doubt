import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

async function prepare(page: Page, theme: "dark" | "light", width = 390) {
  await page.setViewportSize({ width, height: width >= 1920 ? 1080 : 844 });
  await page.addInitScript((value) => {
    localStorage.setItem("werewolf-theme", value);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
}

for (const family of ["werewolf", "mafia"] as const) {
  for (const theme of ["dark", "light"] as const) {
    for (const width of [320, 390, 820, 1920]) {
      test(`family entrance ${family} ${theme} ${width}`, async ({ page }, info) => {
        await prepare(page, theme, width);
        await page.emulateMedia({ colorScheme: theme });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(`/${family}`);
        await page.evaluate(() => document.fonts.ready);
        const main = page.locator("main.game-home-shell:visible");
        const hero = main.locator(".game-home-hero");
        for (const name of ["Създай стая", "Имам код"]) {
          const action = hero.getByRole("link", { name, exact: true });
          await expect(action).toBeInViewport();
          expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
        await expect(hero.locator(".game-home-hero__facts")).toContainText(family === "mafia" ? "4–24" : "6–30");
        expect((await main.locator(".night-timeline").boundingBox())!.y).toBeLessThan(page.viewportSize()!.height);
        await expect(main.locator(".night-phase h3")).toHaveText(["Нощ", "Обсъждане", "Гласуване"]);
        await expect(main.locator(".role-spotlight__link")).toHaveCount(4);

        for (const image of await main.locator("img").all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate((element) => (element as HTMLImageElement).decode());
        }
        const portraits = await main.locator(".role-spotlight__art").evaluateAll((elements) =>
          elements.map((element) => {
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, ratio: rect.width / rect.height };
          }),
        );
        for (const [index, rect] of portraits.entries()) {
          expect(rect.ratio).toBeCloseTo(2 / 3, 1);
          for (const other of portraits.slice(index + 1)) {
            expect(rect.right <= other.x || other.right <= rect.x || rect.bottom <= other.y || other.bottom <= rect.y).toBe(true);
          }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const clipped = await main.locator("h1,h2,h3,p,.ds-pill").evaluateAll((elements) => elements
          .filter((element) => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2)
          .map((element) => element.textContent));
        expect(clipped).toEqual([]);
        const stats = main.locator(".family-stats-unavailable, .quickstart-mini-card").first();
        await expect(stats).toBeVisible();
        await expect(stats).toHaveCSS("background-image", "none");
        await expect(stats).toHaveCSS("box-shadow", "none");
        await expect(stats).toHaveCSS("outline-style", "none");
        if (width === 390) {
          const results = await new AxeBuilder({ page }).include("main.game-home-shell").analyze();
          expect(results.violations).toEqual([]);
          expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(4200);
        }
        await page.evaluate(() => scrollTo(0, 0));
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        await page.screenshot({ path: info.outputPath("family-home.png"), fullPage: true });
        expect(errors).toEqual([]);
      });
    }

    test(`family hero ${family} uses saved ${theme} theme instead of the OS`, async ({ page }) => {
      await prepare(page, theme);
      await page.emulateMedia({ colorScheme: theme === "dark" ? "light" : "dark" });
      await page.goto(`/${family}`, { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const heroes = await page.evaluate(() => performance.getEntriesByType("resource")
        .map((entry) => new URL(entry.name).pathname)
        .filter((name) => /\/bg-hero-[^/]+\.(?:avif|webp)/.test(name)));
      expect(heroes).toHaveLength(1);
      expect(heroes[0]!.includes("light")).toBe(theme === "light");
    });
  }

  test(`family entrance ${family} supports role discovery and guest join`, async ({ page }) => {
    await prepare(page, "dark");
    await page.goto(`/${family}`);
    const role = family === "mafia" ? "commissioner" : "seer";
    const name = family === "mafia" ? "Комисар" : "Гадателка";
    const trigger = page.locator(`.role-spotlight__link[data-role="${role}"]`);
    await trigger.scrollIntoViewIfNeeded();
    const scrollPosition = await page.evaluate(() => scrollY);
    await trigger.click();
    await expect(page).toHaveURL(new RegExp(`/${family}$`));
    const dialog = page.getByRole("dialog", { name, exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(scrollPosition, 0);
    await expect(page.locator(".game-home-hero")).toBeVisible();
    await page.locator(".game-home-hero").getByRole("link", { name: "Имам код", exact: true }).click();
    await page.waitForURL(/\/sign-in\?/);
    expect(new URL(page.url()).searchParams.get("redirect")).toBe(`/${family}/join`);
    await expect(page.getByRole("heading", { level: 1, name: "Вход в играта" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1920]) {
    test(`variant dossiers stay local and accessible ${theme} ${width}`, async ({ page }, info) => {
      await prepare(page, theme, width);
      await page.goto("/werewolf");
      for (const role of ["cupid", "vampire"]) {
        const trigger = page.locator(`.variant-chip button[data-role="${role}"]`);
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(page).toHaveURL(/\/werewolf$/);
        await expect(dialog).toContainText(role === "cupid" ? "Купидон" : "Вампир");
        expect(await dialog.evaluate((element) => element.closest("[inert]") === null)).toBe(true);
        await dialog.locator("img").evaluate((element) => (element as HTMLImageElement).decode());
        expect(await dialog.locator(".role-codex-detail-panel").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        const results = await new AxeBuilder({ page }).include(".role-codex-detail").analyze();
        expect(results.violations).toEqual([]);
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        await page.screenshot({ path: info.outputPath(`${role}.png`) });
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
      }
    });
  }
}

test("sport Mafia keeps its format through the guest authentication gate", async ({ page }) => {
  await prepare(page, "light");
  await page.goto("/mafia");
  await page.locator(".sport-mafia-callout").getByRole("link", { name: "Създай маса", exact: true }).click();
  await page.waitForURL(/\/sign-in\?/);
  expect(new URL(page.url()).searchParams.get("redirect")).toBe("/mafia/create?mode=mafia_sport");
  await expect(page.getByRole("heading", { level: 1, name: "Стани стопанин" })).toBeVisible();
});

test("cached family navigation preserves unique section labels", async ({ page }) => {
  await prepare(page, "light", 1440);
  await page.goto("/werewolf");
  await page.getByRole("navigation", { name: "Основна навигация" }).getByRole("link", { name: "Мафия", exact: true }).click();
  await expect(page.locator("main.game-home-shell:visible")).toHaveAttribute("data-family", "mafia");
  const references = await page.locator("main.game-home-shell [aria-labelledby]").evaluateAll((elements) => elements
    .flatMap((element) => element.getAttribute("aria-labelledby")!.split(/\s+/)));
  expect(new Set(references).size).toBe(references.length);
  await expect(page.getByRole("region", { name: "Нощта има свидетели. Всеки разказва различно." })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("region", { name: "Селото заспива. Подозрението остава." })).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`landing and family reading surfaces do not clip controls ${theme}`, async ({ page }) => {
    await prepare(page, theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["/", "/werewolf", "/mafia"]) {
        await page.goto(route);
        const surfaces = page.locator(route === "/"
          ? "main:visible .home-start"
          : "main:visible .role-spotlight, main:visible .variants-chips, main:visible .sport-mafia-callout");
        expect(await surfaces.count()).toBeGreaterThan(0);
        for (const surface of await surfaces.all()) {
          await surface.scrollIntoViewIfNeeded();
          const clippedAncestors = await surface.evaluate((element) => {
            const clipped: string[] = [];
            for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
              const style = getComputedStyle(ancestor);
              if (style.contentVisibility !== "visible" || /\b(paint|strict|content)\b/.test(style.contain)) {
                clipped.push(ancestor.className || ancestor.tagName);
              }
            }
            return clipped;
          });
          expect(clippedAncestors, `${route} at ${width}px`).toEqual([]);
        }
      }
    }
  });
}
