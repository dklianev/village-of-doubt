import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Route } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const baseUrl = process.env.REPORT_BASE_URL;
let browser: Awaited<ReturnType<typeof chromium.launch>>;

describe.skipIf(!baseUrl)("report browser fixtures", () => {
  beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
  afterAll(async () => { await browser?.close(); }, 30_000);

  for (const width of [375, 1280]) {
    for (const theme of ["dark", "light"]) {
      it(`${width} ${theme}: review, pending, failure and explicit retry`, async () => {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        try {
          await context.addInitScript((theme) => {
            localStorage.setItem("werewolf-theme", theme);
            localStorage.setItem("cookie-consent", "1");
            localStorage.setItem("welcome-modal-shown", "1");
          }, theme);
          const requests: unknown[] = [];
          const unexpectedWrites: string[] = [];
          let pending: Route | undefined;
          await context.route("**/*", async (route) => {
            const request = route.request();
            if (request.method() === "POST" && new URL(request.url()).pathname === "/api/report") {
              requests.push(request.postDataJSON());
              pending = route;
              return;
            }
            if (!["GET", "HEAD"].includes(request.method())) {
              unexpectedWrites.push(request.url());
              await route.abort();
              return;
            }
            await route.continue();
          });
          const page = await context.newPage();
          const errors: string[] = [];
          const consoleErrors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("console", (message) => {
            if (message.type() === "error" && !message.text().includes("503 (Service Unavailable)")) {
              consoleErrors.push(message.text());
            }
          });
          await page.goto(`${baseUrl}/report?visualAuth=1`);
          await page.getByRole("heading", { name: "Подай сигнал" }).waitFor();
          expect(await page.title()).toContain("Сигнал");
          expect(await page.locator(".report-step-name").allTextContents()).toEqual([
            "Вид сигнал", "Подробности", "Връзка", "Преглед",
          ]);
          expect(await page.locator('.report-type-card[data-active="true"] .lucide-circle-check').count()).toBe(1);
          await page.screenshot({ path: join(tmpdir(), `report-type-${theme}-${width}.png`), caret: "initial" });

          const next = page.getByRole("button", { name: /Напред/ });
          await next.click();
          await page.getByRole("textbox", { name: "Описание" }).fill("я".repeat(4000));
          await page.getByRole("textbox", { name: /Код на стая/ }).fill("я".repeat(500));
          await next.click();
          await page.getByRole("radio", { name: /Анонимно/ }).check();
          await next.focus();
          await page.keyboard.press("Enter");
          await page.getByText("Преглед преди изпращане.", { exact: true }).waitFor();
          expect(await page.locator("legend").evaluate((node) => node === document.activeElement)).toBe(true);
          expect(requests).toHaveLength(0);
          await page.locator("form").evaluate((form: HTMLFormElement) => form.requestSubmit());
          expect(requests).toHaveLength(0);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

          await page.getByRole("button", { name: "Изпрати сигнал", exact: true }).click();
          await page.getByRole("button", { name: "Изпращаме...", exact: true }).waitFor();
          expect(await page.getByRole("button", { name: /Назад/ }).isDisabled()).toBe(true);
          expect(requests).toEqual([{ type: "abuse", body: "я".repeat(4000), evidence: "я".repeat(500), email: null }]);
          await pending!.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Временно недостъпно." }) });
          const error = page.locator(".report-wizard").getByRole("alert");
          await error.waitFor();
          expect(await error.evaluate((node) => node === document.activeElement)).toBe(true);
          expect(await page.getByRole("button", { name: /Назад/ }).isEnabled()).toBe(true);
          await page.getByRole("button", { name: "Опитай отново", exact: true }).click();
          await page.getByRole("button", { name: "Изпращаме...", exact: true }).waitFor();
          expect(requests).toHaveLength(2);
          expect(requests[1]).toEqual(requests[0]);
          await pending!.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ referenceId: "СИГ-0123456789" }) });
          const success = page.getByRole("heading", { name: "Сигналът е изпратен." });
          await success.waitFor();
          expect(await success.evaluate((node) => node === document.activeElement)).toBe(true);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
          expect(await page.locator(".report-success").innerText()).not.toMatch(/48 часа|24-48|visual@example/);
          await page.screenshot({ path: join(tmpdir(), `report-success-${theme}-${width}.png`), caret: "initial" });
          expect(errors).toEqual([]);
          expect(consoleErrors).toEqual([]);
          expect(unexpectedWrites).toEqual([]);
        } finally {
          await context.close();
        }
      }, 45_000);
    }
  }
});
