export async function skipWelcomeTutorial(page, baseUrl, redirectTo) {
  // Fresh contexts have not completed onboarding; skipping it does not mark it completed.
  await page.waitForURL((url) => (
    url.origin === new URL(baseUrl).origin && url.pathname === "/tutorial" &&
    url.searchParams.get("welcome") === "1" && url.searchParams.get("redirect") === redirectTo &&
    url.searchParams.get("step") === "1"
  ), { timeout: 10_000 });
  const tutorial = page.getByRole("region", { name: "Наръчник за първа игра", exact: true });
  // The progress bar carries one skip link back to the saved destination; its copy names that
  // destination ("Към поканата", "Към Върколак"...), so match the link by its place instead.
  const skip = tutorial.getByRole("navigation", { name: "Ход на репетицията", exact: true }).getByRole("link");
  if (await skip.getAttribute("href") !== redirectTo) {
    throw new Error("Welcome tutorial did not preserve the intended redirect.");
  }
  await skip.click();
  await page.waitForURL(new URL(redirectTo, baseUrl).href, { timeout: 10_000 });
}
