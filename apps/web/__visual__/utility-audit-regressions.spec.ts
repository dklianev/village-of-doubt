import { expect, test } from "playwright/test";

test.use({ contextOptions: { reducedMotion: "reduce", serviceWorkers: "block" } });

for (const theme of ["light", "dark"] as const) {
  test.describe(`utility audit ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((theme) => {
        localStorage.setItem("cookie-consent", "1");
        localStorage.setItem("werewolf-theme", theme);
      }, theme);
    });

    for (const width of [390, 1440]) {
      for (const method of ["click", "Enter"] as const) {
        test(`report ${width}: ${method} requires explicit final confirmation`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          const requests: { email: string | null }[] = [];
          await page.route("**/api/report", async (route) => {
            requests.push(route.request().postDataJSON());
            await route.fulfill({ json: { referenceId: "СИГ-0123456789" } });
          });
          await page.goto("/report");
          const activate = async (name: string) => {
            const button = page.getByRole("button", { name, exact: true });
            if (method === "click") await button.click();
            else await button.press("Enter");
          };
          await activate("Напред →");
          await page.getByLabel("Описание", { exact: true }).fill("Локален тест на сигнала, без изпращане към сървъра.");
          await activate("Напред →");
          await activate("Напред →");
          await expect(page.getByText("Преглед преди изпращане.", { exact: true })).toBeVisible();
          expect(requests, "entering review must never POST").toHaveLength(0);
          await activate("← Назад");
          await page.locator("label.report-identity-card").filter({ hasText: "С имейл" }).click();
          const email = page.getByLabel("Твоят имейл", { exact: true });
          await email.fill("test@example.com");
          await email.press("Enter");
          expect(requests, "Enter in email must never POST").toHaveLength(0);
          if (await page.getByRole("button", { name: "Напред →", exact: true }).count()) await activate("Напред →");
          await expect(page.getByText("Преглед преди изпращане.", { exact: true })).toBeVisible();
          expect(requests).toHaveLength(0);
          await activate("Изпрати сигнал");
          await expect(page.getByText("СИГ-0123456789", { exact: true })).toBeVisible();
          expect(requests).toHaveLength(1);
          expect(requests[0]?.email).toBe("test@example.com");
        });
      }
    }

    for (const width of [320, 390]) {
      test(`account ${width}: early navigation retains the editor and keyboard focus`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto("/account?visualAuth=1");
        const identity = page.getByRole("radio", { name: "Образ и достъп", exact: true });
        const label = page.locator('label[for="account-section-identity"]');
        await expect(label).toBeInViewport({ ratio: 1 });
        await label.click();
        const name = page.getByRole("textbox", { name: "Име на масата", exact: true });
        await expect(name).toBeInViewport({ ratio: 1 });
        await expect(identity).toBeFocused();
        const portraits = page.getByRole("radiogroup", { name: "Избери образ" });
        await expect(portraits).toBeInViewport();
        await identity.press("ArrowRight");
        const security = page.getByRole("radio", { name: "Данни и сигурност", exact: true });
        await expect(security).toBeChecked();
        await security.press("ArrowLeft");
        await expect(identity).toBeChecked();
        await expect(name).toBeInViewport({ ratio: 1 });
        await page.goto("/account?visualAuth=1#account-data-export");
        await expect(security).toBeChecked();
        await expect(page.getByRole("button", { name: "Изтегли моите данни (JSON)", exact: true })).toBeInViewport();
      });
    }

    for (const width of [390, 1440]) {
      test(`privacy ${width}: native promises support click, Enter and Space`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/privacy#privacy-promises");
        const disclosures = page.locator(".privacy-promise-card details");
        await expect(disclosures).toHaveCount(6);
        const first = disclosures.nth(0);
        const second = disclosures.nth(1);
        await expect(first.locator(".privacy-promise-detail")).toBeHidden();
        await first.locator("summary").click();
        await expect(first).toHaveAttribute("open", "");
        await expect(first.locator(".privacy-promise-detail")).toBeVisible();
        await expect(first.getByText("Скрий детайла", { exact: true })).toBeVisible();
        await first.locator("summary").press("Enter");
        await expect(first.locator(".privacy-promise-detail")).toBeHidden();
        await first.locator("summary").press("Space");
        await expect(first.locator(".privacy-promise-detail")).toBeVisible();
        await second.locator("summary").click();
        await expect(second.locator(".privacy-promise-detail")).toBeVisible();
        await expect(first.locator(".privacy-promise-detail")).toBeHidden();
        await expect(second.locator("summary")).toBeFocused();
        await testInfo.attach(`privacy-promises-${width}-${theme}`, { body: await page.screenshot({ caret: "initial" }), contentType: "image/png" });
      });
    }

    for (const width of [390, 1440]) {
      test(`account ${width}: direct privacy links reveal their target section`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/account?visualAuth=1#account-identity");
        await expect(page.getByRole("radio", { name: "Образ и достъп", exact: true })).toBeChecked();
        await expect(page.getByRole("textbox", { name: "Име на масата", exact: true })).toBeInViewport({ ratio: 1 });
        await page.goto("/account?visualAuth=1#account-security");
        await expect(page.getByRole("radio", { name: "Данни и сигурност", exact: true })).toBeChecked();
        await expect(page.getByRole("button", { name: "Изтегли моите данни (JSON)", exact: true })).toBeInViewport();
      });
    }

    for (const width of [320, 390, 768, 1440, 1920]) {
      test(`utility ${width}: category and privacy actions are accessible without nested framing`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (/hydration|hydrated|didn't match/i.test(message.text())) errors.push(message.text());
        });
        await page.goto("/report");
        await expect(page.getByRole("heading", { name: "Подай сигнал", exact: true })).toBeVisible();
        await expect(page.locator(".report-type-card").first()).toBeInViewport({ ratio: 1 });
        await expect(page.locator(".report-type-card").nth(1)).toBeInViewport();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await testInfo.attach(`report-${width}-${theme}`, { body: await page.screenshot({ caret: "initial" }), contentType: "image/png" });
        await page.goto("/privacy");
        const navigation = page.getByRole("navigation", { name: "Съдържание на политиката" });
        await expect(navigation).toBeInViewport({ ratio: 1 });
        await expect(page.getByRole("link", { name: "Към досието →", exact: true })).toBeInViewport();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await testInfo.attach(`privacy-${width}-${theme}`, { body: await page.screenshot({ caret: "initial" }), contentType: "image/png" });
        await navigation.getByRole("link", { name: "Срокове", exact: true }).click();
        await expect(page).toHaveURL(/#retention$/);
        await expect(page.getByRole("heading", { name: "Колко дълго пазим", exact: false })).toBeInViewport({ ratio: 1 });
        const retentionTop = await page.locator("#retention").evaluate((element) => element.getBoundingClientRect().top);
        expect(retentionTop).toBeGreaterThanOrEqual(80);
        expect(errors).toEqual([]);
      });
    }
  });
}

test("privacy promises remain usable without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    ...(baseURL ? { baseURL } : {}),
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/privacy#privacy-promises");
    const first = page.locator(".privacy-promise-card details").first();
    await expect(first.locator(".privacy-promise-detail")).toBeHidden();
    await first.locator("summary").click();
    await expect(first.locator(".privacy-promise-detail")).toBeVisible();
    await first.locator("summary").press("Enter");
    await expect(first.locator(".privacy-promise-detail")).toBeHidden();
  } finally {
    await context.close();
  }
});
