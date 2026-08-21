import { instant } from "@next/playwright";
import { expect, test } from "playwright/test";

test.describe("Next.js instant navigation shell", () => {
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
        await expect(page.locator(".evidence-wall")).toHaveCount(1);
      },
      { baseURL },
    );

    await expect(page.locator(".history-skeleton-hero")).toHaveCount(0);
    await expect(page.locator(".evidence-wall")).toBeVisible();
    expect(reactWarnings).toEqual([]);
  });
});
