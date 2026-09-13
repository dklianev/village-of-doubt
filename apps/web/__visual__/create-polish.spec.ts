import { expect, test, type Page } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const theme of ["light", "dark"] as const) {
  test(`create loading contrasts with the page base before hydration in ${theme}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });
    const page = await context.newPage();
    try {
      await page.goto(`${testInfo.project.use.baseURL}/werewolf/create?visualAuth=1`);
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      const loading = page.locator(".create-loading");
      await expect(loading.getByRole("heading", { name: "Зареждане на стаята..." })).toBeVisible();
      expect(await loading.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      const ratios = await loading.locator("h1, p").evaluateAll((elements) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d")!;
        const luminance = (color: string) => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((channel) => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          });
          return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
        };
        const background = luminance(getComputedStyle(document.documentElement).backgroundColor);
        return elements.map((element) => {
          const foreground = luminance(getComputedStyle(element).color);
          return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
        });
      });
      for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
      await page.screenshot({ path: testInfo.outputPath(`create-loading-${theme}.png`), caret: "initial" });
    } finally {
      await context.close();
    }
  });
}

async function openCreate(page: Page, family = "werewolf", theme = "dark") {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((value) => {
    localStorage.setItem("werewolf-theme", value);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
  await page.goto(`/${family}/create?visualAuth=1`);
  await expect(page.locator(".lobby-wizard:not([inert])")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const family of ["werewolf", "mafia"]) {
  for (const theme of ["light", "dark"]) {
    test(`create polish ${family} ${theme}: core decisions fit the first mobile screen`, async ({ page }) => {
      await openCreate(page, family, theme);
      await expect(page.getByRole("slider", { name: "Брой играчи" })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole("button", { name: "Настрой детайлите", exact: true })).toBeInViewport({ ratio: 1 });
      const size = await page.getByRole("button", { name: "Увеличи броя играчи" }).boundingBox();
      expect(size!.width).toBeGreaterThanOrEqual(44);
      expect(size!.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}

test("create polish: the main roster includes both factions and every occupied seat", async ({ page }) => {
  await openCreate(page);
  const roster = page.locator(".create-role-portraits");
  await expect(roster.getByText("Върколак", { exact: true })).toBeVisible();
  await expect(roster.getByText("×3", { exact: true })).toBeVisible();
  const counts = await roster.locator(".create-role-portrait small").allTextContents();
  expect(counts.reduce((sum, value) => sum + Number(value.replace("×", "")), 0)).toBe(12);
});

test("create polish: mobile role editing is vertical and keeps the heading visible", async ({ page }) => {
  await openCreate(page);
  await page.getByRole("button", { name: "Настрой детайлите", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Настрой детайлите" });
  await dialog.getByRole("button", { name: "Настрой ръчно", exact: true }).click();
  await expect.poll(async () => dialog.evaluate((element) => {
    const heading = element.querySelector("#step-roles-title")!.getBoundingClientRect();
    const panel = element.querySelector(".create-customization-panel")!.getBoundingClientRect();
    return heading.top >= panel.top;
  })).toBe(true);
  const gallery = dialog.getByRole("region", { name: "Избор на роли" });
  expect(await gallery.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await expect(dialog.getByRole("textbox", { name: "Търси роля", exact: true })).toBeVisible();
  await dialog.getByRole("textbox", { name: "Търси роля", exact: true }).fill("Лечител");
  await dialog.getByRole("button", { name: "Добави Лечител", exact: true }).click();
  await expect(dialog.getByText("12 от 12 места", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Лечител замени Селянин / Селянка.", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Готово", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Настрой детайлите", exact: true })).toBeFocused();
});

test("create polish: room name is labelled truthfully and survives closing details", async ({ page }) => {
  await openCreate(page, "mafia");
  await page.getByRole("button", { name: "Настрой детайлите", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Име на стаята", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Име на стаята", exact: true }).fill("Нашата вечер");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Настрой детайлите", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: "Име на стаята", exact: true })).toHaveValue("Нашата вечер");
});

test("create polish: a mobile role opens locally and Escape returns to its catalogue", async ({ page }) => {
  await openCreate(page);
  await page.getByRole("button", { name: "Настрой детайлите", exact: true }).click();
  const workspace = page.getByRole("dialog", { name: "Настрой детайлите" });
  await workspace.getByRole("button", { name: "Настрой ръчно", exact: true }).click();
  await workspace.getByRole("textbox", { name: "Търси роля", exact: true }).fill("Лечител");
  const tile = workspace.locator(".role-tile-large-body").first();
  await tile.click();
  const detail = page.getByRole("dialog", { name: "Лечител", exact: true });
  await expect(detail).toBeVisible();
  const portrait = detail.locator(".role-art-frame");
  await expect(portrait).toHaveAttribute("data-frame-family", "werewolves");
  const bounds = (await portrait.boundingBox())!;
  expect(bounds.width / bounds.height).toBeCloseTo(2 / 3, 2);
  expect(await portrait.evaluate((node) => getComputedStyle(node, "::after").backgroundImage)).toContain("frame-werewolves-v1.webp");
  await expect(portrait.locator("img")).toHaveCSS("object-fit", "contain");
  await expect(page).toHaveURL(/\/werewolf\/create/);
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await expect(workspace).toBeVisible();
  await expect(tile).toBeFocused();
});

test("create polish: capacity stays visible at the end of the mobile catalogue", async ({ page }) => {
  await openCreate(page);
  await page.getByRole("button", { name: "Настрой детайлите", exact: true }).click();
  const workspace = page.getByRole("dialog", { name: "Настрой детайлите" });
  await workspace.getByRole("button", { name: "Настрой ръчно", exact: true }).click();
  await expect(workspace.getByRole("button", { name: "Запази шаблон", exact: true })).toBeInViewport({ ratio: 1 });
  await workspace.locator(".role-tile-large").last().scrollIntoViewIfNeeded();
  await expect(workspace.getByText("12 от 12 места", { exact: true })).toBeInViewport({ ratio: 1 });
  await expect(workspace.getByRole("button", { name: "Готово", exact: true })).toBeInViewport({ ratio: 1 });
});

test("create polish: both details triggers retain their own return focus", async ({ page }) => {
  await openCreate(page);
  for (const name of ["Редактирай настройките", "Настрой детайлите"]) {
    const trigger = page.getByRole("button", { name, exact: true });
    await trigger.click();
    const workspace = page.getByRole("dialog", { name: "Настрой детайлите" });
    await expect(workspace).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(workspace).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});

test("create polish: invalid capacity stays local and manual optional roles lead to the editor", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openCreate(page);
  await page.getByRole("button", { name: "Настрой детайлите", exact: true }).click();
  const workspace = page.getByRole("dialog", { name: "Настрой детайлите" });
  await workspace.getByRole("button", { name: "Настрой ръчно", exact: true }).click();
  await workspace.getByRole("tab", { name: "Правила и комуникация", exact: true }).click();
  await workspace.getByText("Покажи още настройки", { exact: true }).click();
  const capacity = workspace.getByRole("spinbutton", { name: "Максимум играчи", exact: true });
  await capacity.fill("31");
  await expect(capacity).toHaveAttribute("aria-invalid", "true");
  await expect(workspace.getByText("Въведи цяло число от 12 до 30.", { exact: true })).toBeVisible();
  await capacity.press("Tab");
  await expect(capacity).toHaveValue("30");
  await expect(workspace.getByRole("checkbox", { name: "Добави Шут с лична победа" })).toBeDisabled();
  await workspace.getByRole("button", { name: "Редактирай ролите", exact: true }).click();
  await expect(workspace.getByRole("tab", { name: "Роли", exact: true })).toBeFocused();
  await expect(workspace.getByRole("heading", { name: "Избери ролите", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("create polish: saved roles survive preset changes and adapt to one more player", async ({ page }) => {
  await openCreate(page);
  await page.getByRole("button", { name: "Настрой детайлите", exact: true }).click();
  const workspace = page.getByRole("dialog", { name: "Настрой детайлите" });
  await workspace.getByRole("button", { name: "Настрой ръчно", exact: true }).click();
  await workspace.getByRole("textbox", { name: "Търси роля", exact: true }).fill("Лечител");
  await workspace.getByRole("button", { name: "Добави Лечител", exact: true }).click();
  await workspace.getByRole("button", { name: "Запази шаблон", exact: true }).click();
  await workspace.getByRole("button", { name: "Класическа игра", exact: true }).click();
  await workspace.getByRole("button", { name: "Готово", exact: true }).click();
  await page.getByRole("button", { name: "Увеличи броя играчи", exact: true }).click();
  await page.getByRole("button", { name: "Настрой детайлите", exact: true }).click();
  await workspace.getByRole("button", { name: "Настрой ръчно", exact: true }).click();
  await expect(workspace.getByRole("button", { name: "Отмени последната промяна", exact: true })).toBeDisabled();
  const previousRoster = await workspace.locator(".create-selected-role-list li").allTextContents();
  const savedTemplate = await page.evaluate(() => localStorage.getItem("werewolf-mafia-manual-role-preset-v1:werewolves"));
  await workspace.getByRole("button", { name: "Зареди шаблон", exact: true }).click();
  await expect(workspace.getByText("13 от 13 места", { exact: true })).toBeVisible();
  await expect(workspace.getByRole("button", { name: "Премахни Лечител", exact: true })).toBeEnabled();
  await workspace.getByRole("button", { name: "Отмени последната промяна", exact: true }).click();
  await expect(workspace.getByText("13 от 13 места", { exact: true })).toBeVisible();
  expect(await workspace.locator(".create-selected-role-list li").allTextContents()).toEqual(previousRoster);
  expect(await page.evaluate(() => localStorage.getItem("werewolf-mafia-manual-role-preset-v1:werewolves"))).toBe(savedTemplate);
});

test("create polish: an incompatible template explains the problem without changing the table", async ({ page }) => {
  await openCreate(page);
  await page.getByRole("slider", { name: "Брой играчи" }).press("Home");
  await page.evaluate(() => localStorage.setItem("werewolf-mafia-manual-role-preset-v1:werewolves", JSON.stringify({
    roles: { werewolf: 3, seer: 1, witch: 1, hunter: 1, cupid: 1, healer: 1 },
  })));
  await page.getByRole("button", { name: "Настрой детайлите", exact: true }).click();
  const workspace = page.getByRole("dialog", { name: "Настрой детайлите" });
  await workspace.getByRole("button", { name: "Настрой ръчно", exact: true }).click();
  await workspace.getByRole("button", { name: "Зареди шаблон", exact: true }).click();
  const message = workspace.getByRole("status").filter({ hasText: "без премахване на специални роли" });
  await expect(message).toBeVisible();
  await expect(workspace.getByText("6 от 6 места", { exact: true })).toBeVisible();
  expect(await message.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(await workspace.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

for (const theme of ["light", "dark"]) {
  test(`create polish: the mobile role preview is readable in ${theme}`, async ({ page }) => {
    await openCreate(page, "werewolf", theme);
    await page.getByRole("button", { name: "Настрой детайлите", exact: true }).click();
    const workspace = page.getByRole("dialog", { name: "Настрой детайлите" });
    await workspace.getByRole("button", { name: "Настрой ръчно", exact: true }).click();
    await workspace.getByRole("textbox", { name: "Търси роля", exact: true }).fill("Лечител");
    await workspace.locator(".role-tile-large-body").first().click();
    await expect(page.getByRole("dialog", { name: "Лечител", exact: true })).toBeVisible();
    await page.evaluate(async () => Promise.all(document.getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => {}))));
    const audit = await new AxeBuilder({ page }).include(".ds-sheet:has(.create-mobile-role-detail)").analyze();
    expect(audit.violations).toEqual([]);
  });
}
