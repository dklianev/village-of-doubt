import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

test.use({ serviceWorkers: "block" });
async function prepare(page: Page, theme: string) {
  await page.route("**/api/auth/get-session**", route => route.fulfill({ json: null }));
  await page.addInitScript(theme => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
}

for (const theme of ["light", "dark"]) {
  for (const width of [320, 390, 1440]) {
    test(`archive layout and controls ${theme} ${width}`, async ({ page }) => {
      await prepare(page, theme);
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("/history?visualHistory=fixture");
      await expect(page.locator(".case-file")).toHaveCount(8);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      expect(await page.locator("main a, main button, main select").evaluateAll(elements => elements.every(el => el.getBoundingClientRect().height >= 44))).toBe(true);
      expect(await page.locator(".case-file").first().evaluate(el => el.getBoundingClientRect().left)).toBeGreaterThanOrEqual(20);
      await page.getByLabel("Игра", { exact: true }).focus();
      await expect(page.getByLabel("Игра", { exact: true })).toBeFocused();
      expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test("archive URLs preserve two filters, pagination, reload and browser back", async ({ page }) => {
  await prepare(page, "light");
  await page.goto("/history?visualHistory=paginated");
  await expect(page.locator(".case-file")).toHaveCount(12);
  const first = await page.locator(".case-file").first().innerText();
  await page.getByRole("link", { name: "По-стари дела" }).click();
  await expect(page).toHaveURL(/before=/);
  await expect(page.locator(".case-file").first()).not.toHaveText(first, { useInnerText: true });
  await page.getByRole("link", { name: "По-нови дела" }).click();
  await expect(page).toHaveURL(/after=/);
  await expect(page.locator(".case-file").first()).toHaveText(first, { useInnerText: true });
  await page.getByLabel("Игра", { exact: true }).selectOption("mafia");
  await page.getByLabel("Победител", { exact: true }).selectOption("mafia");
  await page.getByRole("button", { name: "Покажи", exact: true }).click();
  await expect(page).toHaveURL(/family=mafia&outcome=mafia/);
  await expect(page.locator(".case-file")).toHaveCount(5);
  await page.reload();
  await expect(page.getByLabel("Игра", { exact: true })).toHaveValue("mafia");
  await expect(page.getByLabel("Победител", { exact: true })).toHaveValue("mafia");
  await page.getByRole("link", { name: /Отвори дело/ }).first().click();
  await expect(page).toHaveURL(/replay/);
  await page.goBack();
  await expect(page).toHaveURL(/family=mafia&outcome=mafia/);
  await expect(page.locator(".case-file")).toHaveCount(5);
});

test("empty, unavailable and no matches remain distinct", async ({ page }) => {
  await prepare(page, "dark");
  await page.goto("/history?visualHistory=fixture&family=mafia&outcome=werewolves");
  await expect(page.locator('[data-state="filtered-empty"]')).toBeVisible();
  await page.goto("/history?visualHistory=empty");
  await expect(page.locator('[data-state="empty"]')).toBeVisible();
  await expect(page.locator(".case-file-ghost")).toHaveCount(0);
  await page.goto("/history?visualHistory=unavailable&family=mafia&outcome=village");
  await expect(page.locator("main").getByRole("alert")).toContainText("Архивът не отговори");
  await expect(page.getByRole("link", { name: "Опитай отново" })).toHaveAttribute("href", "/history?family=mafia&outcome=village&visualHistory=unavailable");
});
