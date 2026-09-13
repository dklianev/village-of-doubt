import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "playwright/test";

async function prepare(page: Page, theme: "light" | "dark", width: number) {
  await page.setViewportSize({ width, height: width === 320 ? 740 : width === 390 ? 844 : 900 });
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
    localStorage.setItem("werewolf-theme", selectedTheme);
  }, theme);
}

async function capture(page: Page, info: TestInfo, name: string) {
  const artifactDir = process.env.PRESENTATION_ARTIFACT_DIR;
  if (artifactDir) await mkdir(artifactDir, { recursive: true });
  const file = artifactDir ? path.join(artifactDir, `${name}.png`) : info.outputPath(`${name}.png`);
  await page.screenshot({ path: file, caret: "initial" });
  await info.attach(name, { path: file, contentType: "image/png" });
}

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && /game-art/.test(response.url())) errors.push(`Asset ${response.status()}: ${response.url()}`);
  });
  return errors;
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 1440]) {
    for (const route of ["", "werewolf", "mafia"]) {
      test(`@home-roles-audit ${route || "home"} continuous art ${theme} ${width}`, async ({ page }, info) => {
        await prepare(page, theme, width);
        const errors = watchErrors(page);
        await page.goto(`/${route}`);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator("main h1")).toContainText(route === "mafia" ? "Мафия" : "Върколак");
        expect(await page.title()).not.toBe("");
        expect(await page.evaluate(() => getComputedStyle(document.body, "::before").content)).toBe("none");
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const scene = page.locator(route ? ".game-home-hero__scene" : ".landing-hero-art");
        const bounds = await scene.boundingBox();
        expect(bounds!.x).toBeLessThanOrEqual(1);
        expect(bounds!.width).toBeGreaterThanOrEqual(width - 1);
        expect(await scene.evaluate((element) => getComputedStyle(element).maskImage)).toContain("linear-gradient");
        if (route) {
          const hero = page.locator(".game-home-hero");
          await expect(hero.getByRole("link", { name: "Създай стая", exact: true })).toHaveAttribute("href", `/${route}/create`);
          expect((await page.locator(".night-timeline").boundingBox())!.y).toBeLessThan(page.viewportSize()!.height);
        } else {
          const image = page.locator(".game-choice-card").first().locator("img").filter({ visible: true });
          await expect(image).toHaveCount(1);
          await image.scrollIntoViewIfNeeded();
          await image.evaluate((element) => (element as HTMLImageElement).decode());
          await expect(page.locator(".game-choice-card blockquote").first()).toHaveCSS("font-weight", "600");
          await expect(page.locator(".game-choice-description").first()).toHaveCSS("font-weight", "400");
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        }
        await capture(page, info, `${route || "home"}-${theme}-${width}`);
        await page.locator(route ? ".game-home-hero" : ".game-choice-card").first().getByRole("link", { name: "Роли", exact: true }).click();
        await page.waitForURL(`**/${route || "werewolf"}/roles`);
        await expect(page.locator(".role-codex-card").first()).toBeVisible();
        expect(errors).toEqual([]);
      });
    }

    for (const family of ["werewolf", "mafia"]) {
      test(`@home-roles-audit ${family} role discovery ${theme} ${width}`, async ({ page }, info) => {
        await prepare(page, theme, width);
        const errors = watchErrors(page);
        await page.goto(`/${family}/roles`);
        await page.evaluate(() => document.fonts.ready);
        const firstTitle = family === "mafia" ? "Гражданин" : "Селянин / Селянка";
        await expect(page.locator(".role-card-title").first()).toHaveText(firstTitle);
        const grid = await page.locator(".role-codex-grid").boundingBox();
        if (width < 760) expect(grid!.y).toBeLessThan(610);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await page.locator(".role-codex-card img").first().evaluate((element) => (element as HTMLImageElement).decode());
        await capture(page, info, `roles-${family}-${theme}-${width}`);
        // The dev server can serve HTML before the interactive client has hydrated.
        await page.waitForFunction(() => {
          const toggle = document.querySelector(".role-filters-toggle");
          if (!toggle) return false;
          const propsKey = Object.keys(toggle).find((key) => key.startsWith("__reactProps"));
          return propsKey && typeof (toggle as unknown as Record<string, { onClick?: unknown }>)[propsKey]?.onClick === "function";
        });
        if (width < 760) {
          await expect(page.getByRole("textbox", { name: "Търси роля" })).toBeVisible();
          await expect(page.getByRole("combobox", { name: "Подредба" })).toBeHidden();
          await page.getByRole("button", { name: "Филтри и подредба", exact: true }).focus();
          await page.keyboard.press("Enter");
        }
        await page.getByRole("group", { name: "Тип роли" }).getByRole("button", { name: "Нощни", exact: true }).click();
        await page.getByRole("group", { name: "Отбори" }).getByRole("button", { name: family === "mafia" ? "Мафия" : "Върколаци", exact: true }).click();
        await page.getByRole("combobox", { name: "Подредба" }).selectOption("night");
        if (width < 760) {
          await page.getByRole("button", { name: "Филтри и подредба, 3 активни" }).click();
          await expect(page.getByRole("combobox", { name: "Подредба" })).toBeHidden();
          await capture(page, info, `roles-active-${family}-${theme}-${width}`);
        }
        await page.getByRole("button", { name: "Изчисти филтрите" }).click();
        await expect(page.locator(".role-card-title").first()).toHaveText(firstTitle);
        await page.getByRole("textbox", { name: "Търси роля" }).fill(family === "mafia" ? "комисар" : "гадателка");
        await page.getByRole("heading", { name: family === "mafia" ? "Комисар" : "Гадателка", exact: true }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("textbox", { name: "Търси роля" })).toHaveValue(family === "mafia" ? "комисар" : "гадателка");
        expect(errors).toEqual([]);
      });
    }
  }
}
