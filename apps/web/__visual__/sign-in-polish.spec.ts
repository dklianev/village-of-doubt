import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "playwright/test";

test.use({ serviceWorkers: "block" });

async function measureScene(page: Page) {
  return page.evaluate(() => ({
    scrollY,
    pageHeight: document.documentElement.scrollHeight,
    elements: [".sign-in-art", ".sign-in-panel", ".email-form-tabs", ".sign-in-foot", ".site-footer"]
      .map((selector) => {
        const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
        return { selector, x, y, width, height };
      }),
  }));
}

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [
    { width: 320, height: 740 }, { width: 375, height: 667 }, { width: 390, height: 844 },
    { width: 768, height: 1024 }, { width: 1024, height: 768 },
    { width: 800, height: 600 }, { width: 844, height: 390 },
    { width: 1440, height: 900 }, { width: 1920, height: 1080 },
  ]) {
    test.describe(`sign-in polish ${theme} ${viewport.width}`, () => {
      test.use({ viewport });
      test("keeps the form readable, accessible and usable in both modes", async ({ page, browserName }, testInfo) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.addInitScript((theme) => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("welcome-modal-shown", "1");
        }, theme);
        await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }));
        await page.goto("/sign-in");
        await expect(page.getByRole("heading", { name: "Влез в Сенките" })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const signInLayout = await measureScene(page);
        await page.getByRole("tab", { name: "Регистрация", exact: true }).click();
        expect(await measureScene(page)).toEqual(signInLayout);
        await page.getByRole("tab", { name: "Вход", exact: true }).click();
        expect(await measureScene(page)).toEqual(signInLayout);
        const passwordHelp = page.getByRole("link", { name: "Забравена парола?", exact: true });
        const helpBox = (await passwordHelp.boundingBox())!;
        expect(helpBox.width).toBeGreaterThanOrEqual(44);
        expect(helpBox.height).toBeGreaterThanOrEqual(44);
        await page.getByRole("textbox", { name: "Имейл", exact: true }).focus();
        await page.keyboard.press("Tab");
        if (browserName === "webkit") {
          // WebKit's default keyboard mode skips native anchors in its Tab sequence.
          await expect(page.getByLabel("Парола", { exact: true })).toBeFocused();
          await passwordHelp.focus();
        }
        await expect(passwordHelp).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(page.getByLabel("Парола", { exact: true })).toBeFocused();
        // Reset the scroll changed by keyboard focus before checking the initial scene.
        await page.evaluate(() => window.scrollTo(0, 0));
        const artwork = await page.locator(".sign-in-art").evaluate(async (element) => {
          const candidates = Array.from(getComputedStyle(element).backgroundImage.matchAll(/url\("([^"]+)"\)/g), (match) => match[1]!);
          const requested = new Set(performance.getEntriesByType("resource").map((entry) => entry.name));
          // Decode the image-set candidate the browser chose, including the WebP fallback.
          const url = candidates.find((candidate) => requested.has(candidate));
          if (!url) throw new Error("Missing requested sign-in artwork");
          const image = new Image();
          image.src = url;
          await image.decode();
          return { url, width: image.naturalWidth };
        });
        expect(artwork.url).toContain(`bg-sign-in-${theme}-v2.`);
        expect(artwork.width).toBeGreaterThanOrEqual(viewport.width <= 800 ? 960 : 1600);
        const scene = await page.locator(".sign-in-art").evaluate((element) => {
          const style = getComputedStyle(element);
          const art = element.getBoundingClientRect();
          const stage = element.parentElement!.getBoundingClientRect();
          return { width: art.width, x: art.x, stageWidth: stage.width, stageX: stage.x,
            size: style.backgroundSize, position: style.backgroundPosition, mask: style.maskImage };
        });
        expect(scene.width).toBe(scene.stageWidth);
        expect(scene.x).toBe(scene.stageX);
        expect(scene.size).toBe("cover");
        if (viewport.width <= 800) {
          expect(scene.position).toBe("100% 65%");
          expect(scene.mask).toContain("linear-gradient");
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const email = page.getByRole("textbox", { name: "Имейл", exact: true });
        const password = page.getByLabel("Парола", { exact: true });
        const passwordBox = (await password.boundingBox())!;
        const toggleBox = (await page.getByRole("button", { name: "Покажи паролата" }).boundingBox())!;
        expect(passwordBox.x + passwordBox.width).toBeLessThanOrEqual(toggleBox.x);
        expect(toggleBox.width).toBeGreaterThanOrEqual(44);
        expect(toggleBox.height).toBeGreaterThanOrEqual(44);
        if (viewport.width === 390) {
          expect((await email.boundingBox())!.width).toBeGreaterThanOrEqual(300);
          const submit = (await page.getByRole("button", { name: "Влез", exact: true }).boundingBox())!;
          expect(submit.y + submit.height).toBeLessThan(viewport.height);
        }
        const a11y = await new AxeBuilder({ page }).include("main").analyze();
        expect(a11y.violations).toEqual([]);
        await testInfo.attach("sign-in", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
        await page.getByRole("button", { name: "Влез", exact: true }).click();
        await expect(email).toBeFocused();
        await expect(page.locator("main").getByRole("alert")).toHaveText("Въведи имейл.");
        await password.fill("synthetic-password");
        await page.getByRole("button", { name: "Покажи паролата" }).click();
        await expect(password).toHaveAttribute("type", "text");
        await page.getByRole("button", { name: "Скрий паролата" }).click();
        await expect(password).toHaveAttribute("type", "password");
        await page.getByRole("tab", { name: "Регистрация" }).click();
        await expect(page.getByRole("heading", { name: "Създай профил" })).toBeVisible();
        await expect(page.getByRole("textbox", { name: "Име на масата" })).toBeVisible();
        await expect(password).toHaveAttribute("autocomplete", "new-password");
        await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await testInfo.attach("registration", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
        expect(errors).toEqual([]);
      });
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1024]) {
    test(`sign-in scene survives legacy route navigation ${theme} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addLocatorHandler(page.getByRole("button", { name: "Collapse Cache disabled badge" }), (badge) => badge.click());
      await page.addInitScript((theme) => {
        localStorage.setItem("werewolf-theme", theme);
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("welcome-modal-shown", "1");
      }, theme);
      await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }));
      for (const origin of ["/faq", "/friends?visualAuth=1"]) {
        await page.goto(origin);
        await expect(page.locator('header.site-chrome [data-auth-state="guest"]')).toHaveCount(1);
        await page.evaluate(() => document.fonts.ready);
        if (width < 1024) await page.getByRole("button", { name: "Отвори менюто", exact: true }).click();
        await page.getByRole("link", { name: "Влез", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Влез в Сенките" })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const geometry = await page.evaluate(() => {
          const shell = document.querySelector(".sign-in-shell")!;
          const stage = document.querySelector(".sign-in-stage")!;
          const panel = document.querySelector(".sign-in-panel")!.getBoundingClientRect();
          return { shellPadding: getComputedStyle(shell).padding,
            before: getComputedStyle(stage, "::before").content,
            stageWidth: stage.getBoundingClientRect().width,
            shellWidth: shell.getBoundingClientRect().width,
            leftGap: panel.left, rightGap: document.documentElement.clientWidth - panel.right };
        });
        expect(geometry.shellPadding, origin).toBe("0px");
        expect(geometry.before, origin).toBe("none");
        expect(geometry.stageWidth, origin).toBe(geometry.shellWidth);
        expect(geometry.leftGap, origin).toBeGreaterThanOrEqual(16);
        expect(geometry.rightGap, origin).toBeGreaterThanOrEqual(16);
        const before = await measureScene(page);
        await page.getByRole("tab", { name: "Регистрация", exact: true }).click();
        expect(await measureScene(page)).toEqual(before);
      }
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1440]) {
    test(`sign-in preserves scrolled layout with contextual headings ${theme} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 740 });
      await page.addInitScript((theme) => {
        localStorage.setItem("werewolf-theme", theme);
        localStorage.setItem("cookie-consent", "1");
      }, theme);
      await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }));
      for (const redirect of ["/mafia/create?mode=mafia_sport", "/werewolf/join/ABC234"]) {
        await page.goto(`/sign-in?redirect=${encodeURIComponent(redirect)}`);
        await expect(page.getByRole("tab", { name: "Регистрация", exact: true })).toBeVisible();
        await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 80); });
        const before = await measureScene(page);
        await page.getByRole("tab", { name: "Регистрация", exact: true }).click();
        expect(await measureScene(page)).toEqual(before);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await page.getByRole("tab", { name: "Вход", exact: true }).click();
        expect(await measureScene(page)).toEqual(before);
      }
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`sign-in errors and verification ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((theme) => {
      localStorage.setItem("werewolf-theme", theme);
      localStorage.setItem("cookie-consent", "1");
    }, theme);
    await page.route("**/api/auth/get-session", (route) => route.fulfill({ json: null }));
    await page.route("**/api/auth/sign-in/social", (route) => route.fulfill({ status: 503, json: { message: "Fixture unavailable" } }));
    await page.goto("/sign-in?redirect=%2Fmafia%2Fjoin%2FABC234");
    await page.getByRole("button", { name: "Продължи с Google" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("Не успяхме да отворим Google. Опитай отново.");
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    await page.route("**/api/auth/sign-up/email", async (route) => {
      const body = route.request().postDataJSON();
      expect(body.callbackURL).toBe("/verify-email?redirect=%2Fmafia%2Fjoin%2FABC234");
      await route.fulfill({ json: { token: null, user: { id: "fixture-user", email: "fixture@example.test", name: "Мила" } } });
    });
    await page.getByRole("tab", { name: "Регистрация" }).click();
    await page.getByRole("textbox", { name: "Име на масата" }).fill("Мила");
    await page.getByRole("textbox", { name: "Имейл", exact: true }).fill("fixture@example.test");
    await page.getByLabel("Парола", { exact: true }).fill("synthetic-password");
    await page.getByRole("button", { name: "Създай профил" }).click();
    await expect(page.getByRole("heading", { name: "Провери имейла си" })).toBeFocused();
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    await testInfo.attach("verification-pending", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    await page.getByRole("button", { name: "Към входа" }).click();
    await expect(page.getByRole("textbox", { name: "Имейл", exact: true })).toBeFocused();
    await expect(page.getByRole("link", { name: "Забравена парола?" })).toHaveAttribute("href", "/forgot-password?redirect=%2Fmafia%2Fjoin%2FABC234");
  });
}
