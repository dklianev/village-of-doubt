import { expect, test, type Page } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ contextOptions: { reducedMotion: "reduce", serviceWorkers: "block" } });

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 768, 1440]) {
    test(`account polish ${theme} ${width}: tabs, profile save and privacy dialog`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 960 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript((theme) => {
        localStorage.setItem("werewolf-theme", theme);
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("tutorial-completed", "1");
        localStorage.setItem("welcome-modal-shown", "1");
      }, theme);
      await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: {
        user: { id: "visual-account-user", name: "Рада", avatarId: "portrait-f04", email: "visual@example.invalid", emailVerified: true },
      } }));
      let release!: () => void;
      const responseGate = new Promise<void>((resolve) => { release = resolve; });
      const requests: unknown[] = [];
      await page.route("**/api/auth/update-user", async (route) => {
        requests.push(route.request().postDataJSON());
        await responseGate;
        await route.fulfill({ json: { status: true } });
      });
      await page.goto("/account?visualAuth=1");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Визуален играч");
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByRole("tabpanel")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const shell = await page.locator("main.account-shell > [data-activity-state]").boundingBox();
      expect(shell!.x).toBeGreaterThanOrEqual(15);
      await testInfo.attach(`account-${theme}-${width}`, { body: await page.screenshot(), contentType: "image/png" });
      if (width === 390) expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);

      const identity = page.getByRole("tab", { name: "Образ и достъп", exact: true });
      await identity.scrollIntoViewIfNeeded();
      const before = await identity.boundingBox();
      await identity.click();
      expect(Math.abs((await identity.boundingBox())!.y - before!.y)).toBeLessThanOrEqual(1);
      const name = page.getByRole("textbox", { name: "Име на масата", exact: true });
      await name.fill("Рада");
      await name.press("Enter");
      await expect.poll(() => requests.length).toBe(1);
      await name.fill("Ново име");
      release();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Рада");
      await expect(name).toHaveValue("Ново име");
      await expect(page.getByRole("button", { name: "Запази досието" })).toBeEnabled();
      await page.getByRole("button", { name: "Отмени промените" }).click();
      await expect(name).toHaveValue("Рада");
      if (width === 390) expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
      await identity.focus();
      await page.keyboard.press("ArrowRight");
      const security = page.getByRole("tab", { name: "Данни и сигурност" });
      await expect(security).toBeFocused();
      await expect(name).toBeHidden();
      const remove = page.getByRole("button", { name: "Изтрий моето досие" });
      await remove.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(page.getByRole("button", { name: "Изтрий завинаги" })).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(remove).toBeFocused();
      await page.goto("/account?visualAuth=1#account-data-export");
      await expect(security).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("button", { name: "Изтегли моите данни (JSON)" })).toBeInViewport();
      expect(errors).toEqual([]);
    });
  }
}

async function prepareAccount(page: Page, theme: "light" | "dark") {
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("tutorial-completed", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: {
    user: { id: "visual-account-user", name: "Визуален играч", avatarId: "portrait-f04", email: "visual@example.invalid", emailVerified: true },
  } }));
  await page.goto("/account?visualAuth=1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Визуален играч");
  await page.evaluate(() => document.fonts.ready);
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`account navigation ${theme} ${width}: anchors keep tabs clear and Back restores scroll`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      await prepareAccount(page, theme);
      const identity = page.getByRole("tab", { name: "Образ и достъп", exact: true });
      await page.getByRole("link", { name: "Редактирай", exact: true }).click();
      await expect(identity).toHaveAttribute("aria-selected", "true");
      await expect.poll(() => identity.evaluate((tab) => {
        const box = tab.getBoundingClientRect();
        return tab.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
      await testInfo.attach(`account-anchor-${theme}-${width}`, { body: await page.screenshot(), contentType: "image/png" });

      // Repeating the same native anchor must also leave the navigation accessible.
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.getByRole("link", { name: "Редактирай", exact: true }).click();
      await expect.poll(() => identity.evaluate((tab) => {
        const box = tab.getBoundingClientRect();
        return tab.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
      await page.getByText("Начини за вход", { exact: true }).scrollIntoViewIfNeeded();
      const scroll = await page.evaluate(() => window.scrollY);
      await page.locator('header a[href="/"]').first().click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { name: "Върколак или Мафия", exact: true })).toBeVisible();
      await expect(page.locator("#account-name")).toBeHidden();
      await page.goBack();
      await expect(identity).toHaveAttribute("aria-selected", "true");
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, 0);
      await expect(page.getByText("Начини за вход", { exact: true })).toBeInViewport();
    });
  }
}

for (const outcome of ["success", "error", "rejection"] as const) {
  test(`account pending save: ${outcome} received while away settles on Back`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await prepareAccount(page, "dark");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => { finish = resolve; });
    let submitted = false;
    await page.route("**/api/auth/update-user", async (route) => {
      submitted = true;
      await gate;
      if (outcome === "rejection") await route.abort("failed");
      else await route.fulfill(outcome === "success" ? { json: { status: true } }
        : { status: 400, json: { message: "Synthetic rejected save", code: "BAD_REQUEST" } });
      finish();
    });
    try {
      await page.getByRole("tab", { name: "Образ и достъп" }).click();
      const name = page.getByRole("textbox", { name: "Име на масата", exact: true });
      await name.fill("Рада");
      await name.press("Enter");
      await expect.poll(() => submitted).toBe(true);
      await page.locator('header a[href="/"]').first().click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator("#account-name")).toBeHidden();
      release();
      await finished;
      await expect.poll(() => page.locator("#account-profile-feedback").textContent()).not.toContain("Запазване на изпратените");
      await page.goBack();
      await expect(name).toHaveValue("Рада");
      const save = page.getByRole("button", { name: "Запази досието", exact: true });
      await expect(save).toHaveAttribute("aria-busy", "false");
      if (outcome === "success") {
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Рада");
        await expect(save).toBeDisabled();
      } else {
        await expect(save).toBeEnabled();
        await expect(page.locator("#account-profile-feedback")).toContainText(/опитай отново/i);
        await page.unroute("**/api/auth/update-user");
        await page.route("**/api/auth/update-user", (route) => route.fulfill({ json: { status: true } }));
        await save.click();
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Рада");
      }
    } finally { release(); }
  });
}
