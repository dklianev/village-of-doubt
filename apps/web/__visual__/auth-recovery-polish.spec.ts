import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "playwright/test";

test.use({ serviceWorkers: "block" });

async function prepare(page: Page, theme: "light" | "dark") {
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
    localStorage.setItem("tutorial-completed", "1");
  }, theme);
  await page.addLocatorHandler(page.getByRole("button", { name: "Collapse Cache disabled badge" }), (badge) => badge.click());
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const art = document.querySelector("[data-recovery-art]")!;
    const panel = document.querySelector(".recovery-panel")!;
    const artBox = art.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    return {
      art: { x: artBox.x, y: artBox.y + scrollY, width: artBox.width, height: artBox.height },
      panel: { x: panelBox.x, y: panelBox.y + scrollY, width: panelBox.width },
      background: getComputedStyle(art).backgroundPosition,
    };
  });
}

const scenes = [
  { name: "forgot-password", query: "", heading: "Забравена парола" },
  { name: "reset-password", query: "?token=synthetic-audit-token", heading: "Нова парола" },
  { name: "verify-email", query: "?error=TOKEN_EXPIRED", heading: "Невалиден линк" },
] as const;

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [
    { width: 320, height: 740 }, { width: 390, height: 844 },
    { width: 768, height: 1024 }, { width: 844, height: 390 },
    { width: 1024, height: 768 }, { width: 1440, height: 900 },
  ]) {
    test.describe(`recovery artwork ${theme} ${viewport.width}`, () => {
      test.use({ viewport });
      test("all three scenes stay readable, framed and accessible", async ({ page }, testInfo) => {
        await prepare(page, theme);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        for (const scene of scenes) {
          await page.goto(`/${scene.name}${scene.query}`);
          await expect(page.locator("main h1")).toHaveText(scene.heading);
          await page.evaluate(() => document.fonts.ready);
          const artwork = await page.locator("[data-recovery-art]").evaluate(async (element) => {
            const candidates = Array.from(getComputedStyle(element).backgroundImage.matchAll(/url\("([^"]+)"\)/g), (match) => match[1]!);
            const requested = new Set(performance.getEntriesByType("resource").map((entry) => entry.name));
            const url = candidates.find((candidate) => requested.has(candidate));
            if (!url) throw new Error("Recovery artwork was not requested");
            const image = new Image();
            image.src = url;
            await image.decode();
            return { url, width: image.naturalWidth, size: getComputedStyle(element).backgroundSize };
          });
          expect(artwork.url).toContain(`bg-${scene.name}-${theme}-v2.`);
          expect(artwork.width).toBeGreaterThanOrEqual(viewport.width <= 800 ? 960 : 1440);
          expect(artwork.size).toBe("cover");
          expect(artwork.url.includes("/mobile/")).toBe(viewport.width <= 800);
          const dimensions = await page.locator(".recovery-panel").evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return { left: rect.left, right: document.documentElement.clientWidth - rect.right,
              border: style.borderLeftWidth, radius: style.borderRadius,
              padding: parseFloat(style.paddingLeft), innerWidth: element.clientWidth, scrollWidth: element.scrollWidth };
          });
          expect(dimensions.left).toBeGreaterThanOrEqual(16);
          expect(dimensions.right).toBeGreaterThanOrEqual(16);
          expect(dimensions.border).toBe("1px");
          expect(dimensions.radius).toBe("8px");
          expect(dimensions.padding).toBeGreaterThanOrEqual(16);
          expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
          await testInfo.attach(scene.name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
        }
        expect(errors).toEqual([]);
      });
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`verification retries connection failures and preserves the invitation ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page, theme);
    let attempts = 0;
    await page.route("**/api/auth/verify-email**", async (route) => {
      attempts += 1;
      await route.fulfill(attempts === 1
        ? { status: 503, json: { message: "Synthetic connection failure" } }
        : { json: { status: true } });
    });
    await page.goto("/verify-email?token=synthetic-token&redirect=%2Fmafia%2Fjoin%2FABC234");
    await expect(page.locator("main h1")).toHaveText("Проверката не завърши");
    await expect(page.getByRole("textbox", { name: "Имейл" })).toHaveCount(0);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    await page.evaluate(() => document.fonts.ready);
    const before = await geometry(page);
    await page.getByRole("button", { name: "Опитай отново", exact: true }).click();
    await expect(page.locator("main h1")).toHaveText("Имейлът е потвърден.");
    expect(attempts).toBe(2);
    expect(await geometry(page)).toEqual(before);
    await expect(page.getByRole("link", { name: "Продължи", exact: true })).toHaveAttribute("href", "/mafia/join/ABC234");
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    await testInfo.attach("verified", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  });

  test(`expired verification can request a new link without losing its destination ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await prepare(page, theme);
    let requests = 0;
    await page.route("**/api/auth/send-verification-email", async (route) => {
      requests += 1;
      expect(route.request().postDataJSON()).toEqual({
        email: "review@example.test", callbackURL: "/verify-email?redirect=%2Fwerewolf%2Fjoin%2FABC234",
      });
      await route.fulfill({ json: { status: true } });
    });
    await page.goto("/verify-email?error=TOKEN_EXPIRED&redirect=%2Fwerewolf%2Fjoin%2FABC234");
    await page.getByRole("textbox", { name: "Имейл", exact: true }).fill("review@example.test");
    await page.getByRole("button", { name: "Изпрати нов линк", exact: true }).click();
    await expect(page.locator("main").getByRole("status")).toContainText("Ако имейлът очаква потвърждение");
    await expect(page.getByRole("button", { name: /Изпрати нов линк/ })).toBeDisabled();
    expect(requests).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  });
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`recovery success keeps the artwork stationary ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      await prepare(page, theme);
      await page.route("**/api/auth/request-password-reset", (route) => route.fulfill({ json: { status: true } }));
      await page.goto("/forgot-password?redirect=%2Fmafia%2Fjoin%2FABC234");
      await expect(page.locator("main h1")).toHaveText("Забравена парола");
      await page.evaluate(() => document.fonts.ready);
      const forgotGeometry = await geometry(page);
      await page.getByRole("textbox", { name: "Имейл", exact: true }).fill("review@example.test");
      await page.getByRole("button", { name: "Изпрати линк", exact: true }).click();
      await expect(page.locator("main").getByRole("status")).toContainText(/Ако има/);
      expect(await geometry(page)).toEqual(forgotGeometry);
      await expect(page.getByRole("link", { name: "Към входа", exact: true })).toHaveAttribute("href", "/sign-in?redirect=%2Fmafia%2Fjoin%2FABC234");
      expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
      await testInfo.attach("forgot-sent", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

      await page.route("**/api/auth/reset-password", (route) => route.fulfill({ json: { status: true } }));
      await page.goto("/reset-password?token=synthetic-token&redirect=%2Fmafia%2Fjoin%2FABC234");
      await expect(page.locator("main h1")).toHaveText("Нова парола");
      await page.evaluate(() => document.fonts.ready);
      const resetGeometry = await geometry(page);
      await page.locator('input[autocomplete="new-password"]').nth(0).fill("synthetic-password");
      await page.locator('input[autocomplete="new-password"]').nth(1).fill("synthetic-password");
      await page.getByRole("button", { name: "Запази паролата", exact: true }).click();
      await expect(page.locator("main h1")).toContainText(/Паролата/);
      expect(await geometry(page)).toEqual(resetGeometry);
      await expect(page.getByRole("link", { name: "Към входа", exact: true })).toHaveAttribute("href", "/sign-in?redirect=%2Fmafia%2Fjoin%2FABC234");
      expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
      await testInfo.attach("reset-success", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    });
  }
}
