import { expect, test, type Page } from "playwright/test";

test.use({
  launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] },
  contextOptions: { reducedMotion: "reduce" },
});

async function prepare(page: Page, theme: "light" | "dark") {
  // Collapse only the dev-only cache badge; runtime error overlays remain visible.
  await page.addLocatorHandler(page.getByRole("button", { name: "Collapse Cache disabled badge" }), (badge) => badge.click());
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
    localStorage.setItem("last-family", "mafia");
  }, theme);
}

async function geometry(page: Page) {
  return page.evaluate(() => ({
    scrollY,
    boxes: [".site-chrome", ".site-brand", "#main-content"].map((selector) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  }));
}

function stationary(actual: Awaited<ReturnType<typeof geometry>>, before: Awaited<ReturnType<typeof geometry>>) {
  expect(actual.scrollY).toBe(before.scrollY);
  actual.boxes.forEach((box, index) => {
    for (const dimension of ["x", "y", "width", "height"] as const) {
      expect(box[dimension], `Layout changed: ${index} ${dimension}`).toBeCloseTo(before.boxes[index]![dimension], 0);
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`Senkite choices, focus and scroll stability: ${width} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await prepare(page, theme);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const header = page.locator(".site-chrome:not([data-fallback])");
      const brand = header.getByRole("link", { name: "Сенките, начало" });
      await expect(brand).toBeVisible();
      await expect(brand.getByRole("img", { name: "Сенките" })).toHaveCSS("mask-image", /senkite-wordmark\.svg/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page).toHaveTitle(/Сенките/);
      const play = header.getByRole("button", { name: "Играй", exact: true });
      await expect(play).toBeEnabled();
      await page.evaluate(() => scrollTo(0, 180));
      const before = await geometry(page);
      expect(before.scrollY).toBeGreaterThan(0);
      expect(before.boxes[0]!.y).toBe(0);

      await play.click();
      const choices = page.getByRole("navigation", { name: "Нова игра" });
      await expect(choices).toBeVisible();
      await expect(choices.getByRole("link", { name: "Върколак", exact: true })).toHaveAttribute("href", "/werewolf/create");
      await expect(choices.getByRole("link", { name: "Мафия", exact: true })).toHaveAttribute("href", "/mafia/create");
      if (width < 1024) {
        await expect(page.getByRole("dialog", { name: "Какво ще играем?" })).toBeVisible();
        await expect(choices.getByRole("link", { name: "Имам код" })).toHaveAttribute("href", "/join");
        await expect(page.locator("body")).toHaveAttribute("data-scroll-locked");
      } else {
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(header.getByRole("link", { name: "Имам код" })).toHaveAttribute("href", "/join");
        await page.keyboard.press("Tab");
        await expect(choices.getByRole("link", { name: "Върколак", exact: true })).toBeFocused();
      }
      stationary(await geometry(page), before);
      await page.keyboard.press("Escape");
      await expect(choices).toHaveCount(0);
      await expect(play).toBeFocused();
      await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked");
      stationary(await geometry(page), before);

      if (width < 1024) {
        const opener = header.getByRole("button", { name: "Отвори менюто" });
        await opener.click();
        const dialog = page.getByRole("dialog", { name: "Навигация" });
        await expect(dialog.getByRole("link", { name: "Класация", exact: true })).toHaveAttribute("href", "/leaderboard");
        await dialog.getByRole("button", { name: theme === "light" ? "Смени на тъмна тема" : "Смени на светла тема" }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme === "light" ? "dark" : "light");
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(opener).toBeFocused();
      } else {
        const more = header.getByRole("button", { name: "Още страници" });
        await more.click();
        const links = header.getByRole("navigation", { name: "Още страници" });
        for (const name of ["Класация", "Приятели", "Постижения"]) {
          await expect(links.getByRole("link", { name, exact: true })).toBeVisible();
        }
        await header.getByRole("link", { name: "Имам код" }).focus();
        await expect(links).toHaveCount(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect(errors).toEqual([]);
    });
  }
}

test("modified navigation preserves the original drawer and Escape focus", async ({ page, context }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await prepare(page, "dark");
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Отвори менюто" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Навигация" });
  const popup = context.waitForEvent("page");
  await dialog.getByRole("link", { name: "Начало", exact: true }).click({ modifiers: ["ControlOrMeta"] });
  await (await popup).close();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  await opener.click();
  await dialog.getByRole("link", { name: "Мафия", exact: true }).click();
  await expect(page).toHaveURL(/\/mafia$/);
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("last-family"))).toBe("mafia");
});

test("wordmark remains visible in system high contrast", async ({ page }) => {
  await prepare(page, "light");
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/");
  const wordmark = page.getByRole("img", { name: "Сенките", exact: true });
  await expect(wordmark).toBeVisible();
  const colors = await wordmark.evaluate((element) => ({
    foreground: getComputedStyle(element).backgroundColor,
    background: getComputedStyle(element.closest("header")!).backgroundColor,
    adjustment: getComputedStyle(element).forcedColorAdjust,
  }));
  expect(colors.adjustment).toBe("none");
  expect(colors.foreground).not.toBe(colors.background);
});

for (const width of [390, 1024]) {
  test(`authenticated navigation and lazy sign-out preserve focus: ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await prepare(page, "light");
    const name = "Александра Константинополска";
    await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: { user: { id: "visual-navbar-user", name } } }));
    await page.goto("/");
    const header = page.locator(".site-chrome:not([data-fallback])");
    await expect(header.locator('[data-auth-state="authenticated"]')).toHaveCount(1);
    const opener = width < 1024
      ? header.getByRole("button", { name: "Отвори менюто" })
      : header.getByRole("button", { name: `Меню на ${name}` });
    await opener.click();
    const logout = page.getByRole("button", { name: "Изход", exact: true });
    await logout.click();
    const confirmation = page.getByRole("dialog", { name: "Излизаш ли от масата?" });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole("button", { name: "Излизам", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(confirmation).toHaveCount(0);
    await expect(width < 1024 ? logout : opener).toBeFocused();
    if (width < 1024) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Навигация" })).toHaveCount(0);
      await expect(opener).toBeFocused();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

for (const family of ["werewolves", "mafia"] as const) {
  for (const width of [390, 1440]) {
    test(`room navigation stays quiet: ${family} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await prepare(page, "dark");
      await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=voting&players=12&voteTally=full`);
      const header = page.locator('.site-chrome[data-room="true"]');
      await expect(header).toBeVisible();
      await expect(header.getByRole("button", { name: "Играй", exact: true })).toHaveCount(0);
      await expect(header.getByRole("link", { name: "Имам код" })).toHaveCount(0);
      const sound = header.getByRole("button", { name: "Включи звука" });
      await sound.click();
      await expect(header.getByRole("button", { name: "Изключи звука" })).toBeVisible();
      if (width < 1024) {
        await header.getByRole("button", { name: "Отвори менюто" }).click();
        const dialog = page.getByRole("dialog", { name: "Навигация" });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("link", { name: "Имам код" })).toHaveCount(0);
      }
    });
  }
}
