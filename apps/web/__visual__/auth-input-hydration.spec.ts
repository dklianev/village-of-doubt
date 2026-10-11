import { expect, test, type Page } from "playwright/test";

test.use({ serviceWorkers: "block" });

const email = "hydration@example.invalid";
const password = " Synthetic-password-123 ";
const redirect = "/werewolf/join/ABC234";
const cases = [
  { route: "/sign-in", endpoint: "/sign-in/email", fields: { 'input[type="email"]': email },
    payload: { email, password } },
  { route: "/forgot-password", endpoint: "/request-password-reset", fields: { 'input[type="email"]': email },
    payload: { email, redirectTo: "/reset-password?redirect=%2Fwerewolf%2Fjoin%2FABC234" } },
  { route: "/reset-password", endpoint: "/reset-password",
    fields: { 'input[name="password"]': password, 'input[name="confirmPassword"]': password },
    payload: { token: "synthetic-hydration-token", newPassword: password } },
];

async function waitForHydration(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator('.auth-chip-slot[data-auth-state="guest"]').first()).toBeAttached();
}

for (const scenario of cases) {
  for (const timing of ["delayed hydration", "silent autofill"]) {
    test(`${scenario.route} preserves ${timing} input and submits the native values`, async ({ page }, testInfo) => {
      const pageErrors: string[] = [];
      const submissions: unknown[] = [];
      const unexpectedAuth: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem("werewolf-theme", matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("welcome-modal-shown", "1");
        localStorage.setItem("tutorial-completed", "1");
      });
      // Fail closed: no auth request, including a regression to another endpoint, reaches the server.
      await page.route("**/api/auth/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/auth/get-session" && route.request().method() === "GET") {
          await route.fulfill({ json: null });
        } else if (path === `/api/auth${scenario.endpoint}` && route.request().method() === "POST") {
          submissions.push(route.request().postDataJSON());
          await route.fulfill({ status: 503, json: { code: "SYNTHETIC_UNAVAILABLE", message: "Synthetic failure" } });
        } else {
          unexpectedAuth.push(path);
          await route.fulfill({ status: 501, json: { code: "UNEXPECTED_SYNTHETIC_REQUEST" } });
        }
      });

      let release!: () => void;
      let heldScripts = 0;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      if (timing === "delayed hydration") {
        await page.route("**/_next/static/chunks/**", async (route) => {
          if (new URL(route.request().url()).pathname.endsWith(".js")) {
            heldScripts += 1;
            await gate;
          }
          await route.continue();
        });
      }

      try {
        const query = new URLSearchParams({ redirect });
        if (scenario.route === "/reset-password") query.set("token", "synthetic-hydration-token");
        await page.goto(`${scenario.route}?${query}`, { waitUntil: "commit" });
        await expect(page.locator("main h1:visible")).toBeVisible();
        if (timing === "silent autofill") await waitForHydration(page);
        for (const [selector, value] of Object.entries(scenario.fields)) {
          const field = page.locator(selector);
          await expect(field).toBeEditable();
          if (timing === "delayed hydration") {
            await field.fill(value);
          } else {
            // Password managers can update the DOM without a React change event.
            await field.evaluate((input: HTMLInputElement, value) => { input.value = value; }, value);
          }
          await expect(field).toHaveValue(value);
        }
        if (timing === "delayed hydration") {
          expect(heldScripts).toBeGreaterThan(0);
          await expect(page.locator('.auth-chip-slot[data-auth-state="guest"]')).toHaveCount(0);
          release();
          await waitForHydration(page);
        }

        if (scenario.route === "/sign-in") {
          const field = page.locator('input[autocomplete="current-password"]');
          if (timing === "silent autofill") {
            await field.evaluate((input: HTMLInputElement, value) => { input.value = value; }, password);
          } else {
            await field.fill(password);
          }
          await page.locator(".email-password-toggle").click();
          await expect(field).toHaveValue(password);
        } else if (scenario.route === "/reset-password") {
          await page.locator(".recovery-reveal").first().click();
        }
        for (const [selector, value] of Object.entries(scenario.fields)) {
          await expect(page.locator(selector)).toHaveValue(value);
        }

        const form = page.locator("main form");
        await expect(form).toHaveAttribute("method", "post");
        const nativeValues = await form.evaluate((form: HTMLFormElement) => Object.fromEntries(new FormData(form)));
        expect(nativeValues).toMatchObject(scenario.route === "/reset-password"
          ? { password, confirmPassword: password }
          : scenario.route === "/sign-in" ? { email, password } : { email });
        await form.locator('button[type="submit"]').click();
        await expect.poll(() => submissions.length).toBe(1);
        expect(submissions[0]).toEqual(scenario.payload);
        await expect(form.getByRole("alert")).toBeVisible();
        await expect(form.locator('button[type="submit"]')).toBeEnabled();
        for (const [selector, value] of Object.entries(scenario.fields)) {
          await expect(page.locator(selector)).toHaveValue(value);
        }
        await form.locator('button[type="submit"]').click();
        await expect.poll(() => submissions.length).toBe(2);
        expect(submissions[1]).toEqual(scenario.payload);
        expect(unexpectedAuth).toEqual([]);
        expect(pageErrors).toEqual([]);
        await expect(page.locator("[data-nextjs-dialog-overlay]")).toHaveCount(0);
        const screenshot = testInfo.outputPath("auth-input-retained.png");
        await page.screenshot({ path: screenshot });
        await testInfo.attach("auth-input-retained", { path: screenshot, contentType: "image/png" });
      } finally {
        release();
        await page.unrouteAll({ behavior: "wait" });
      }
    });
  }
}
