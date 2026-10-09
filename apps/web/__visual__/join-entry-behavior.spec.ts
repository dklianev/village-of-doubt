import { expect, test } from "playwright/test";

test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["light", "dark"]) {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      test.describe(`${family} live eligibility ${theme} ${viewport.width}`, () => {
        test.use({ viewport });

        test("refreshes a full room without reload or loading flicker and rechecks on focus", async ({ page }, testInfo) => {
          const root = family === "mafia" ? "/mafia" : "/werewolf";
          const mode = family === "mafia" ? "mafia_sport" : "werewolves_classic";
          let canJoinAsPlayer = false;
          let canSpectate = true;
          let requests = 0;
          let navigations = 0;
          let holdNextRefresh = false;
          let releaseRefresh: (() => void) | undefined;
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("request", (request) => {
            if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
          });
          await page.addInitScript((theme) => {
            localStorage.setItem("werewolf-theme", theme);
            localStorage.setItem("cookie-consent", "1");
            localStorage.setItem("tutorial-completed", "1");
            localStorage.setItem("welcome-modal-shown", "1");
          }, theme);
          await page.route("**/api/auth/get-session**", (route) => route.fulfill({
            json: { user: { id: "visual-join-player", name: "Рада" } },
          }));
          await page.route("**/api/rooms/ABC234/preview", async (route) => {
            requests++;
            if (holdNextRefresh) {
              holdNextRefresh = false;
              await new Promise<void>((resolve) => { releaseRefresh = resolve; });
            }
            await route.fulfill({ json: {
              code: "ABC234", family, mode, status: "lobby", playerCount: canJoinAsPlayer ? 9 : 10, capacity: 10,
              roomVisibility: "private", viewerMembership: "none", canJoinAsPlayer, canSpectate,
            } });
          });

          try {
            await page.goto(`${root}/join/ABC234?visualAuth=1`);
            const main = page.locator("main");
            const player = main.getByRole("radio", { name: "Играч" });
            await expect(main.getByText("Местата за игра са заети.")).toBeVisible();
            await expect(player).toBeDisabled();
            await expect(main.getByRole("button", { name: "Наблюдавай", exact: true })).toBeEnabled();
            await page.evaluate(() => document.fonts.ready);
            const codeBox = await main.getByRole("group", { name: "Код на стаята" }).boundingBox();
            const documentNavigations = navigations;
            const initialRequests = requests;

            canJoinAsPlayer = true;
            holdNextRefresh = true;
            await expect.poll(() => requests, { timeout: 16_000 }).toBe(initialRequests + 1);
            await expect(main.getByText("Местата за игра са заети.")).toBeVisible();
            await expect(main.getByText("Проверяваме стаята...")).toHaveCount(0);
            await expect(main.locator(".join-preview")).toHaveAttribute("aria-busy", "false");
            await expect(player).toBeDisabled();
            releaseRefresh!();
            await expect(player).toBeEnabled();
            await expect(player).toBeChecked();
            await expect(main.getByText("9 / 10 играчи")).toBeVisible();
            await expect(main.getByRole("button", { name: "Влез в стаята", exact: true })).toBeEnabled();
            expect(await main.getByRole("group", { name: "Код на стаята" }).boundingBox()).toEqual(codeBox);
            expect(navigations).toBe(documentNavigations);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            const screenshotPath = testInfo.outputPath("refreshed-join.png");
            await page.screenshot({ path: screenshotPath, fullPage: true });
            await testInfo.attach("refreshed-join", { path: screenshotPath, contentType: "image/png" });

            canJoinAsPlayer = false;
            canSpectate = false;
            await page.evaluate(() => window.dispatchEvent(new Event("focus")));
            await expect(main.getByText("В момента няма свободни места.")).toBeVisible();
            await expect(player).toBeDisabled();
            await expect(main.getByRole("radio", { name: "Наблюдател" })).toBeDisabled();
            await expect(main.getByRole("button", { name: "Влез в стаята", exact: true })).toBeDisabled();
            expect(requests).toBe(initialRequests + 2);
            expect(navigations).toBe(documentNavigations);
            expect(errors).toEqual([]);
          } finally {
            releaseRefresh?.();
          }
        });
      });
    }
  }

  test(`${family} Join preserves scene geometry and fresh eligibility across reload`, async ({ page }) => {
    const root = family === "mafia" ? "/mafia" : "/werewolf";
    const mode = family === "mafia" ? "mafia_sport" : "werewolves_classic";
    let allowPlayer = true;
    await page.addInitScript(() => {
      localStorage.setItem("werewolf-theme", "light");
      localStorage.setItem("cookie-consent", "1");
      localStorage.setItem("tutorial-completed", "1");
      localStorage.setItem("welcome-modal-shown", "1");
    });
    await page.route("**/api/auth/get-session**", (route) => route.fulfill({
      json: { user: { id: "visual-join-player", name: "Рада" } },
    }));
    await page.route("**/api/rooms/ABC234/preview", (route) => route.fulfill({
      json: {
        code: "ABC234", family, mode, status: "in_game", playerCount: 10, capacity: 10,
        roomVisibility: "private", viewerMembership: "participant",
        canJoinAsPlayer: allowPlayer, canSpectate: false,
      },
    }));

    await page.goto(`${root}/join?visualAuth=1`);
    const main = page.locator("main");
    const scene = () => main.evaluate((element) => {
      const style = getComputedStyle(element, "::before");
      return { width: style.width, height: style.height, position: style.backgroundPosition, size: style.backgroundSize };
    });
    await expect(page.getByRole("textbox")).toHaveCount(6);
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");
    const before = await scene();

    await main.getByRole("button", { name: "Влез в стаята", exact: true }).click();
    await expect(main.getByRole("alert")).toContainText("Въведи кода");
    expect(await scene()).toEqual(before);

    await page.getByRole("textbox", { name: "Символ 1 от 6" }).fill("abc234");
    await expect(page.getByText("Връщаш се на мястото си.")).toBeVisible();
    expect(await scene()).toEqual(before);
    await page.getByRole("textbox", { name: "Символ 3 от 6" }).press("Backspace");
    expect(await page.getByRole("textbox").evaluateAll((elements) => elements.map((element) => (element as HTMLInputElement).value)))
      .toEqual(["A", "B", "", "2", "3", "4"]);

    await page.goto(`${root}/join/ABC234?visualAuth=1`);
    const submit = main.getByRole("button", { name: "Влез в стаята", exact: true });
    await expect(submit).toBeEnabled();
    await expect(main.getByRole("radio", { name: "Наблюдател" })).toBeDisabled();
    allowPlayer = false;
    await page.reload();
    await expect(page.getByText("В момента няма свободни места.")).toBeVisible();
    await expect(submit).toBeDisabled();
    await expect(main.getByRole("radio", { name: "Играч" })).toBeDisabled();
    expect(await scene()).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
