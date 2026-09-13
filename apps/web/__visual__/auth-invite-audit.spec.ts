import { expect, test, type Page } from "playwright/test";

const invite = "/mafia/join/ABC234?source=invite&mode=mafia_free";
const inviteQuery = "redirect=%2Fmafia%2Fjoin%2FABC234%3Fsource%3Dinvite%26mode%3Dmafia_free";
const room = {
  code: "ABC234", family: "mafia", playerCount: 1, capacity: 8, hostName: "Анна",
  mode: "mafia_free", roomVisibility: "private", viewerMembership: "none",
  canSpectate: true,
  players: [{ displayName: "Анна", connected: true, ready: false, host: true }],
};

test.use({ serviceWorkers: "block" });

async function prepare(page: Page, theme: "light" | "dark") {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat/i.test(message.text())) {
      pageErrors.push(message.text());
    }
  });
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("tutorial-completed", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
  await page.route("**/api/auth/**", (route) => {
    if (new URL(route.request().url()).pathname === "/api/auth/get-session") {
      return route.fulfill({ json: null });
    }
    return route.abort("blockedbyclient");
  });
  return pageErrors;
}

async function expectPageHealth(page: Page, pageErrors: string[]) {
  expect(pageErrors).toEqual([]);
  const visibleMain = page.locator("main:visible");
  await expect(visibleMain).toHaveCount(1);
  expect((await visibleMain.innerText()).trim()).not.toBe("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator("nextjs-portal").evaluateAll((portals) => portals.some(
    (portal) => portal.shadowRoot?.querySelector("[data-nextjs-dialog-overlay]"),
  ))).toBe(false);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`@auth-invite-audit ${viewport.width}px ${theme}`, () => {
      test.use({ viewport });

      test("sign-in to forgot-password and back retains the full invitation", async ({ page }) => {
        const pageErrors = await prepare(page, theme);
        await page.goto(`/sign-in?${inviteQuery}`);
        const forgot = page.getByRole("link", { name: "Забравена парола?", exact: true });
        await expect(forgot).toHaveAttribute("href", `/forgot-password?${inviteQuery}`);
        await forgot.click();
        await expect(page).toHaveURL(new RegExp(`/forgot-password\\?${inviteQuery}$`));
        await expect(page.getByRole("heading", { name: "Забравена парола", exact: true })).toBeVisible();
        const back = page.getByRole("link", { name: "Към входа", exact: true });
        await expect(back).toHaveAttribute("href", `/sign-in?${inviteQuery}`);
        await back.click();
        await expect(page).toHaveURL(new RegExp(`/sign-in\\?${inviteQuery}$`));
        expect(new URL(page.url()).searchParams.get("redirect")).toBe(invite);
        await expect(forgot).toHaveAttribute("href", `/forgot-password?${inviteQuery}`);
        await expectPageHealth(page, pageErrors);
      });

      test("a missing room ignores the Mafia URL hint without false activity", async ({ page }, testInfo) => {
        const pageErrors = await prepare(page, theme);
        await page.route("**/api/rooms/ABC234/preview", (route) => route.fulfill({ json: { status: "missing" } }));
        await page.goto("/lobby/ABC234?mode=mafia_free&visualAuth=1");
        await expect(page.getByRole("heading", { name: "Покана за масата.", exact: true })).toBeVisible();
        await expect(page.locator(".lobby-route-card")).toContainText("Тази стая вече не е достъпна");
        await expect(page.getByRole("link", { name: "Към играта", exact: true })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Наблюдавай", exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Сподели|Копирай/ })).toHaveCount(0);
        await expect(page.locator(".lobby-player-preview")).toHaveCount(0);
        await expect(page.getByText("Поканата остава активна", { exact: false })).toHaveCount(0);
        await expect(page.locator(".lobby-invite-v2")).not.toHaveAttribute("data-family");
        const fallback = page.getByRole("link", { name: "Избери игра", exact: true });
        await expect(fallback).toHaveAttribute("href", "/");
        await expectPageHealth(page, pageErrors);
        await testInfo.attach("missing-room-with-mafia-hint", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
        await fallback.click();
        await expect(page).toHaveURL((url) => url.pathname === "/" && url.search === "");
        await expect(page.getByRole("heading", { name: "Върколак или Мафия", exact: true })).toBeVisible();
      });

      test("an unavailable Mafia preview recovers and distinguishes active and finished games", async ({ page }) => {
        const pageErrors = await prepare(page, theme);
        let status: "unavailable" | "lobby" | "in_game" | "finished" = "unavailable";
        await page.route("**/api/rooms/ABC234/preview", (route) => route.fulfill({
          status: status === "unavailable" ? 503 : 200,
          json: status === "unavailable" ? { status } : {
            ...room, status, canJoinAsPlayer: status === "lobby",
          },
        }));
        // The server preview, not a conflicting URL hint, supplies the game mode.
        await page.goto("/lobby/ABC234?mode=werewolves_classic&visualAuth=1");
        const preview = page.locator(".lobby-route-card");
        await expect(preview).toContainText("Не успяхме да проверим стаята");
        await expect(page.getByRole("link", { name: "Към играта", exact: true })).toHaveCount(0);
        await expect(page.locator(".lobby-player-preview")).toHaveCount(0);
        status = "lobby";
        await page.getByRole("button", { name: "Провери отново", exact: true }).click();
        await expect(preview).toContainText("В стаята има 1 от 8 играчи");
        await expect(page.locator(".lobby-player-preview")).toContainText("Анна");
        await expect(page.getByRole("link", { name: "Към играта", exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: "Към играта", exact: true })).toHaveAttribute("href", "/play/ABC234?mode=mafia_free");
        await expect(page.locator(".lobby-invite-v2")).toHaveAttribute("data-family", "mafia");
        await expect(page.getByRole("button", { name: "Сподели", exact: true })).toBeVisible();
        status = "in_game";
        await page.reload();
        await expect(preview).toContainText("Играта вече върви");
        await expect(page.getByRole("link", { name: "Към играта", exact: true })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Наблюдавай", exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: "Наблюдавай", exact: true })).toHaveAttribute("href", "/play/ABC234?mode=mafia_free&spectator=1");
        status = "finished";
        await page.reload();
        await expect(preview).toContainText("Тази стая вече приключи");
        await expect(page.getByRole("link", { name: "Към играта", exact: true })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Наблюдавай", exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Сподели|Копирай/ })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Въведи друг код за Мафия", exact: true })).toHaveAttribute("href", "/mafia/join");
        await expectPageHealth(page, pageErrors);
      });
    });
  }
}

test("@auth-invite-audit external redirect stays internal through recovery navigation", async ({ page }) => {
  const pageErrors = await prepare(page, "light");
  await page.goto("/sign-in?redirect=%2F%2Foutside.invalid");
  const forgot = page.getByRole("link", { name: "Забравена парола?", exact: true });
  await expect(forgot).toHaveAttribute("href", "/forgot-password?redirect=%2F");
  await forgot.click();
  await expect(page.getByRole("link", { name: "Към входа", exact: true })).toHaveAttribute("href", "/sign-in?redirect=%2F");
  await page.getByRole("link", { name: "Към входа", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\?redirect=%2F$/);
  await expectPageHealth(page, pageErrors);
});
