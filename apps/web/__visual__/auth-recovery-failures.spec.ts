import { expect, test } from "playwright/test";

test.use({ serviceWorkers: "block" });

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    test.describe(`auth recovery failures ${theme} ${viewport.width}`, () => {
      test.use({ viewport });

      test.beforeEach(async ({ page }) => {
        await page.addInitScript((theme) => {
          localStorage.setItem("werewolf-theme", theme);
          localStorage.setItem("cookie-consent", "1");
          localStorage.setItem("welcome-modal-shown", "1");
          localStorage.setItem("tutorial-completed", "1");
        }, theme);
        await page.addLocatorHandler(page.getByRole("button", { name: "Collapse Cache disabled badge" }), (badge) => badge.click());
        await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
      });

      test("401 USER_NOT_FOUND offers neutral new-link recovery and retains the invite", async ({ page }, testInfo) => {
        const pageErrors: string[] = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        let verifications = 0;
        let resends = 0;
        await page.route("**/api/auth/verify-email**", async (route) => {
          verifications += 1;
          await route.fulfill({ status: 401, json: { code: "USER_NOT_FOUND", message: "Synthetic account does not exist" } });
        });
        await page.route("**/api/auth/send-verification-email", async (route) => {
          resends += 1;
          expect(route.request().postDataJSON()).toEqual({
            email: "recovery@example.invalid", callbackURL: "/verify-email?redirect=%2Fmafia%2Fjoin%2FABC234",
          });
          await route.fulfill({ json: { status: true } });
        });
        await page.goto("/verify-email?token=synthetic-recovery-token&redirect=%2Fmafia%2Fjoin%2FABC234");
        const main = page.locator("main");
        await expect(main.getByRole("heading", { level: 1 })).toHaveText("Невалиден линк");
        await expect(main.getByRole("alert")).toHaveText("Линкът е изтекъл или невалиден. Заяви нов линк.");
        await expect(main).not.toContainText(/USER_NOT_FOUND|Synthetic account/);
        await expect(main.getByRole("button", { name: "Опитай отново", exact: true })).toHaveCount(0);
        const email = main.getByRole("textbox", { name: "Имейл", exact: true });
        await expect(email).toHaveValue("");
        await expect(main.getByRole("link", { name: "Към входа", exact: true })).toHaveAttribute("href", "/sign-in?redirect=%2Fmafia%2Fjoin%2FABC234");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await testInfo.attach("neutral-invalid-link", {
          body: await page.screenshot({ path: testInfo.outputPath("neutral-invalid-link.png"), fullPage: true }), contentType: "image/png",
        });
        await email.fill("recovery@example.invalid");
        await email.press("Enter");
        await expect(main.getByRole("status")).toContainText("Ако имейлът очаква потвърждение");
        expect(verifications).toBe(1);
        expect(resends).toBe(1);
        expect(pageErrors).toEqual([]);
      });

      test("503 verification remains retryable and retains the invite", async ({ page }) => {
        let attempts = 0;
        await page.route("**/api/auth/verify-email**", async (route) => {
          attempts += 1;
          await route.fulfill(attempts === 1
            ? { status: 503, json: { code: "USER_NOT_FOUND", message: "Synthetic service unavailable" } }
            : { json: { status: true } });
        });
        await page.goto("/verify-email?token=synthetic-recovery-token&redirect=%2Fmafia%2Fjoin%2FABC234");
        const main = page.locator("main");
        await expect(main.getByRole("heading", { level: 1 })).toHaveText("Проверката не завърши");
        await expect(main.getByRole("textbox", { name: "Имейл", exact: true })).toHaveCount(0);
        await expect(main).not.toContainText(/USER_NOT_FOUND|Synthetic service/);
        await main.getByRole("button", { name: "Опитай отново", exact: true }).click();
        await expect(main.getByRole("heading", { level: 1 })).toHaveText("Имейлът е потвърден.");
        await expect(main.getByRole("link", { name: "Продължи", exact: true })).toHaveAttribute("href", "/mafia/join/ABC234");
        expect(attempts).toBe(2);
      });

      for (const moveFocus of [false, true]) {
        test(`Enter then 503 ${moveFocus ? "does not steal moved focus" : "retains email focus for retry"}`, async ({ page, browserName }, testInfo) => {
          const pageErrors: string[] = [];
          page.on("pageerror", (error) => pageErrors.push(error.message));
          let attempts = 0;
          let release!: () => void;
          const pending = new Promise<void>((resolve) => { release = resolve; });
          await page.route("**/api/auth/request-password-reset", async (route) => {
            attempts += 1;
            expect(route.request().postDataJSON()).toEqual({
              email: "recovery@example.invalid", redirectTo: "/reset-password?redirect=%2Fwerewolf%2Fjoin%2FABC234",
            });
            if (attempts === 1) {
              await pending;
              await route.fulfill({ status: 503, json: { message: "Synthetic service unavailable" } });
            } else {
              await route.fulfill({ json: { status: true } });
            }
          });
          await page.goto("/forgot-password?redirect=%2Fwerewolf%2Fjoin%2FABC234");
          const main = page.locator("main");
          await expect(main.getByRole("heading", { level: 1 })).toHaveText("Забравена парола");
          const email = main.getByRole("textbox", { name: "Имейл", exact: true });
          const back = main.getByRole("link", { name: "Към входа", exact: true });
          try {
            await email.fill("recovery@example.invalid");
            await email.press("Enter");
            await expect(main.getByRole("button", { name: "Изпращаме...", exact: true })).toBeDisabled();
            await expect.poll(() => attempts).toBe(1);
            await expect(email).toBeFocused();
            await expect(email).not.toBeEditable();
            await expect(email).toBeEnabled();
            await page.keyboard.type("x");
            await page.keyboard.press("Enter");
            await expect(email).toHaveValue("recovery@example.invalid");
            expect(attempts).toBe(1);
            if (moveFocus) {
              // WebKit's default tab policy skips links; establish the same focus precondition.
              if (browserName === "webkit") await back.focus();
              else await page.keyboard.press("Tab");
              await expect(back).toBeFocused();
            }
          } finally {
            release();
          }
          await expect(main.getByRole("alert")).toHaveText("Заявката не беше приета. Опитай отново след малко.");
          await expect(moveFocus ? back : email).toBeFocused();
          await expect(email).toBeEditable();
          await expect(main.getByRole("button", { name: "Изпрати линк", exact: true })).toBeEnabled();
          await expect(back).toHaveAttribute("href", "/sign-in?redirect=%2Fwerewolf%2Fjoin%2FABC234");
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          if (!moveFocus) {
            await testInfo.attach("forgot-503-email-focused", {
              body: await page.screenshot({ path: testInfo.outputPath("forgot-503-email-focused.png"), fullPage: true }), contentType: "image/png",
            });
            await page.keyboard.press("Enter");
            await expect(main.getByRole("heading", { level: 1 })).toHaveText("Провери имейла си");
            await expect(main.getByRole("status")).toContainText("Ако има профил с този имейл");
            expect(attempts).toBe(2);
          }
          expect(pageErrors).toEqual([]);
        });
      }
    });
  }
}
