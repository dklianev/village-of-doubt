import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

async function prepare(page: Page, theme: "light" | "dark") {
  await page.addInitScript((value) => {
    localStorage.setItem("werewolf-theme", value);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
}

for (const theme of ["light", "dark"] as const) {
  test(`@ui-polish ${theme} home exposes both host and guest paths in the first desktop viewport`, async ({ page }) => {
    await prepare(page, theme);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    for (const path of ["/werewolf/create", "/werewolf/join", "/mafia/create", "/mafia/join"]) {
      const action = page.locator(`.game-choice-card a[href*="${encodeURIComponent(path)}"], .game-choice-card a[href="${path}"]`).first();
      await expect(action).toBeVisible();
      const box = await action.boundingBox();
      expect(box!.y + box!.height).toBeLessThan(900);
    }
  });

  test(`@ui-polish ${theme} mobile navigation has readable and reachable profile actions`, async ({ page }) => {
    await prepare(page, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: {
      user: { id: "ui-audit-user", name: "Анна", email: "audit@example.invalid", emailVerified: true, image: null },
      session: { id: "ui-audit-session", userId: "ui-audit-user", expiresAt: "2099-01-01T00:00:00.000Z" },
    } }));
    await page.goto("/");
    await page.getByRole("button", { name: "Отвори менюто" }).click();
    const drawer = page.getByRole("dialog", { name: "Навигация" });
    const profile = drawer.getByRole("link", { name: "Моето досие" });
    await expect(profile).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Изход", exact: true })).toBeVisible();
    await profile.scrollIntoViewIfNeeded();
    const hit = await profile.evaluate((element) => {
      const r = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    expect(hit).toBe(true);
    const axe = await new AxeBuilder({ page }).include(".site-drawer").withRules(["color-contrast"]).analyze();
    expect(axe.violations).toEqual([]);
    await drawer.getByRole("button", { name: "Затвори менюто" }).click();
    await expect(page.getByRole("button", { name: "Отвори менюто" })).toBeFocused();
  });

  for (const family of ["werewolf", "mafia"] as const) {
    test(`@ui-polish ${theme} ${family} mobile editor keeps a full portrait and recoverable filters`, async ({ page }) => {
      await prepare(page, theme);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/${family}/create?visualAuth=1`);
      await page.getByRole("button", { name: "Настрой детайлите", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Настрой детайлите" });
      await dialog.getByRole("button", { name: "Настрой ръчно", exact: true }).click();
      const tile = dialog.locator(".role-tile-large").first();
      const done = dialog.getByRole("button", { name: "Готово", exact: true });
      await expect(tile).toBeVisible();
      const box = await tile.boundingBox();
      const footer = await done.boundingBox();
      expect(box!.height / box!.width).toBeCloseTo(1.5, 1);
      expect(box!.y + box!.height).toBeLessThan(footer!.y);
      for (const name of ["Запази шаблон", "Зареди шаблон"]) {
        const action = dialog.getByRole("button", { name, exact: true });
        const actionBox = await action.boundingBox();
        expect(actionBox!.width).toBeGreaterThanOrEqual(44);
        expect(actionBox!.height).toBeGreaterThanOrEqual(44);
        const icon = await action.locator("svg").boundingBox();
        expect(icon!.width).toBe(16);
        expect(icon!.height).toBe(16);
      }
      const roster = dialog.getByRole("button", { name: "Покажи състава" });
      await roster.click();
      await expect(dialog.getByRole("button", { name: "Скрий състава" })).toHaveAttribute("aria-expanded", "true");
      await dialog.getByRole("button", { name: "Скрий състава" }).click();
      await dialog.getByRole("button", { name: "Търсене и филтри" }).click();
      const search = dialog.getByRole("textbox", { name: "Търси роля" });
      await search.fill("няма-такава-роля");
      await expect(dialog.getByText("Няма роли за този филтър.")).toBeVisible();
      await search.fill("");
      await dialog.getByRole("button", { name: "Търсене и филтри" }).click();
      const gallery = dialog.getByRole("region", { name: "Избор на роли" });
      await dialog.getByRole("button", { name: "Следващи роли" }).click();
      await expect.poll(() => gallery.evaluate((element) => element.scrollLeft)).toBeGreaterThan(10);
      await done.click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole("button", { name: "Настрой детайлите", exact: true })).toBeFocused();
    });
  }

  test(`@ui-polish ${theme} long mobile phase labels cannot collide with table badges`, async ({ page }) => {
    await prepare(page, theme);
    await page.setViewportSize({ width: 375, height: 812 });
    for (const phase of ["role_reveal", "day_announcement", "hunter_revenge"]) {
      await page.goto(`/play/VISUAL?visualGame=1&phase=${phase}&family=werewolves`);
      await expect(page.locator("[data-stage-ledger]")).toBeVisible();
      const geometry = await page.locator("[data-stage-ledger]").evaluate((ledger) => {
        const heading = document.querySelector("[data-play-stage] h1") ?? document.querySelector("h1");
        const a = ledger.getBoundingClientRect();
        const b = heading!.getBoundingClientRect();
        return { overlap: Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(geometry).toEqual({ overlap: false, overflow: false });
    }
  });
}

test("@ui-polish failed password request recovers without losing the email", async ({ page }) => {
  await prepare(page, "light");
  await page.route("**/api/auth/request-password-reset", (route) => route.abort());
  await page.goto("/forgot-password");
  await page.getByRole("textbox", { name: "Имейл" }).fill("audit@example.invalid");
  const submit = page.locator('button[type="submit"]');
  await submit.click();
  await expect(page.locator("main").getByRole("alert")).toContainText("връзката");
  await expect(submit).toBeEnabled();
  await expect(page.getByRole("textbox", { name: "Имейл" })).toHaveValue("audit@example.invalid");
});

test("@ui-polish signup waits for verification and keeps the room invitation", async ({ page }) => {
  await prepare(page, "light");
  await page.setViewportSize({ width: 390, height: 844 });
  let callback = "";
  await page.route("**/api/auth/sign-up/email", (route) => {
    callback = route.request().postDataJSON().callbackURL;
    return route.fulfill({ json: { token: null, user: { id: "test-pending", emailVerified: false } } });
  });
  await page.goto("/sign-in?redirect=%2Fwerewolf%2Fjoin%3Fcode%3DABC123");
  await page.getByRole("tab", { name: "Ново досие" }).click();
  await page.getByRole("textbox", { name: "Име на масата" }).fill("Анна");
  await page.getByRole("textbox", { name: "Имейл", exact: true }).fill("audit@example.invalid");
  await page.getByLabel("Парола", { exact: true }).fill("test-only-passphrase");
  await page.getByRole("button", { name: "Създай досие", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Провери имейла си" })).toBeFocused();
  expect(new URL(callback, "http://local.test").searchParams.get("redirect")).toBe("/werewolf/join?code=ABC123");
  await expect(page).toHaveURL(/\/sign-in\?/);
  await expect(page.getByRole("button", { name: /Изпрати нов линк/ })).toBeDisabled();
});
