import { expect, test } from "playwright/test";

test.use({ contextOptions: { reducedMotion: "reduce", serviceWorkers: "block" } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("cookie-consent", "1"); });
  await page.route("**/api/auth/**", (route) => route.fulfill({ json: { user: {
    id: "synthetic-welcome-player", name: "Synthetic player", email: "synthetic@example.invalid", emailVerified: true,
  } } }));
});

test("tutorial entry keeps the invitation without recursively offering the tutorial", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tutorial?welcome=1&game=mafia_free&redirect=%2Fmafia%2Fjoin%2FABC234");
  await expect(page.locator("#tutorial-game")).toHaveValue("mafia_free");
  // The authenticated feedback control proves deferred widgets have mounted.
  await expect(page.getByRole("button", { name: "Дай ни бележка", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Мястото ти е готово." })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Прескочи", exact: true })).toHaveAttribute("href", "/mafia/join/ABC234");
  expect(new URL(page.url()).searchParams.get("redirect")).toBe("/mafia/join/ABC234");
  expect(await page.evaluate(() => localStorage.getItem("welcome-modal-shown"))).toBeNull();
  await page.screenshot({ path: testInfo.outputPath("tutorial-entry.png") });
  expect(errors).toEqual([]);
});

test("fresh homepage welcome opens the tutorial without an invented invitation", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("dialog", { name: "Мястото ти е готово." }).getByRole("link", { name: "Отвори наръчника" });
  await expect(link).toHaveAttribute("href", "/tutorial?welcome=1&game=werewolves_classic");
  await link.click();
  await expect(page.locator("#tutorial-game")).toHaveValue("werewolves_classic");
  expect(new URL(page.url()).searchParams.has("redirect")).toBe(false);
  await expect(page.getByRole("link", { name: "Прескочи", exact: true })).toHaveCount(0);
});

test("query-code join preserves its complete invitation and sport mode", async ({ page }) => {
  await page.route("**/api/rooms/ABC234/preview", (route) => route.fulfill({ json: {
    code: "ABC234", family: "mafia", mode: "mafia_sport", status: "lobby", playerCount: 8, capacity: 10,
    roomVisibility: "private", viewerMembership: "none", canJoinAsPlayer: true, canSpectate: true,
  } }));
  const redirect = "/mafia/join?code=ABC234&mode=mafia_sport&visualAuth=1";
  await page.goto(redirect);
  const link = page.getByRole("dialog", { name: "Мястото ти е готово." }).getByRole("link", { name: "Отвори наръчника" });
  await expect(link).toHaveAttribute("href", `/tutorial?${new URLSearchParams({ welcome: "1", game: "mafia_sport", redirect })}`);
  await link.click();
  await expect(page.locator("#tutorial-game")).toHaveValue("mafia_sport");
  await expect(page.getByRole("link", { name: "Прескочи", exact: true })).toHaveAttribute("href", redirect);
});

for (const { game, redirect, width, theme } of [
  { game: "mafia_free", redirect: "/mafia/join/ABC234", width: 1440, theme: "dark" },
  { game: "mafia_sport", redirect: "/mafia/join/ABC234", width: 390, theme: "light" },
  { game: "werewolves_classic", redirect: "/werewolf/join/ABC234", width: 390, theme: "dark" },
]) {
  test(`welcome tutorial action preserves ${game} invitation`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript((theme) => localStorage.setItem("werewolf-theme", theme), theme);
    await page.goto(`/?${new URLSearchParams({ game, redirect })}`);
    const modal = page.getByRole("dialog", { name: "Мястото ти е готово." });
    await expect(modal).toBeVisible();
    const link = modal.getByRole("link", { name: "Отвори наръчника" });
    await expect(link).toBeFocused();
    await expect(link).toHaveAttribute("href", `/tutorial?${new URLSearchParams({ welcome: "1", game, redirect })}`);
    const screenshot = testInfo.outputPath("welcome.png");
    await page.screenshot({ path: screenshot });
    await testInfo.attach(`welcome-${game}`, { path: screenshot, contentType: "image/png" });
    await link.click();
    await expect(page).toHaveURL(/\/tutorial\?/);
    await expect(page.locator("#tutorial-game")).toHaveValue(game);
    await expect(page.getByRole("link", { name: "Прескочи", exact: true })).toHaveAttribute("href", redirect);
    await expect(modal).toHaveCount(0);
    const url = new URL(page.url());
    expect(url.searchParams.get("game")).toBe(game);
    expect(url.searchParams.get("redirect")).toBe(redirect);
    expect(await page.evaluate(() => localStorage.getItem("welcome-modal-shown"))).toBe("1");
    expect(errors).toEqual([]);
  });
}
