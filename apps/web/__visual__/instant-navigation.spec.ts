import { instant } from "@next/playwright";
import { expect, test } from "playwright/test";

test.describe("Next.js instant navigation shell", () => {
  test("hydrates the landing auth controls without cache races", async ({ page }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (text.includes("Hydration failed") || text.includes("hydration-mismatch")) {
        hydrationErrors.push(text);
      }
    });
    page.on("pageerror", (error) => {
      if (error.message.includes("Hydration failed") || error.message.includes("hydration-mismatch")) {
        hydrationErrors.push(error.message);
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".game-choice-actions").first()).toBeVisible();
    await page.waitForTimeout(500);

    expect(hydrationErrors).toEqual([]);
  });

  test("renders shared chrome and a route fallback before history streams", async ({
    page,
    baseURL,
  }) => {
    const reactWarnings: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (text.includes("state update on a component that hasn't mounted yet")) {
        reactWarnings.push(text);
      }
    });

    if (!baseURL) {
      throw new Error("Playwright baseURL is required for instant navigation tests.");
    }

    await instant(
      page,
      async () => {
        await page.goto("/history?visualHistory=fixture");
        await expect(page.locator(".site-chrome")).toBeVisible();
        await expect(page.locator(".history-skeleton-hero")).toBeVisible();
        await expect(page.locator(".evidence-wall-skeleton")).toBeVisible();
        await expect(page.getByLabel("Списък с дела")).toHaveCount(0);
      },
      { baseURL },
    );

    await expect(page.locator(".history-skeleton-hero")).toHaveCount(0);
    await expect(page.locator(".evidence-wall-skeleton")).toHaveCount(0);
    await expect(page.getByLabel("Списък с дела")).toBeVisible();
    expect(reactWarnings).toEqual([]);
  });
});
