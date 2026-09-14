export async function skipWelcomeTutorial(page, baseUrl, redirectTo) {
  // Fresh contexts have not completed onboarding; skipping it does not mark it completed.
  await page.waitForURL((url) => (
    url.origin === new URL(baseUrl).origin && url.pathname === "/tutorial" &&
    url.searchParams.get("welcome") === "1" && url.searchParams.get("redirect") === redirectTo &&
    url.searchParams.get("step") === "1"
  ), { timeout: 10_000 });
  const tutorial = page.getByRole("region", { name: "Наръчник за първа игра", exact: true });
  const skip = tutorial.getByRole("link", { name: "Прескочи", exact: true });
  if (await skip.getAttribute("href") !== redirectTo) {
    throw new Error("Welcome tutorial did not preserve the intended redirect.");
  }
  await skip.click();
  await page.waitForURL(new URL(redirectTo, baseUrl).href, { timeout: 10_000 });
}
