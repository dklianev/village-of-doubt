import { expect, test, type Locator, type Page } from "playwright/test";
import sharp from "sharp";

type Theme = "dark" | "light";

async function prepare(page: Page, theme: Theme) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
    localStorage.setItem("werewolf-theme", selectedTheme);
  }, theme);
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  await page.goto("/leaderboard?visualLeaderboard=fixture-three");
  await expect(page.getByRole("table", { name: "Класиране" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator(".site-mobile-menu")).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
}

async function scene(shell: Locator, loaded: ReadonlySet<string>) {
  return shell.evaluate((element, loadedUrls) => {
    const style = getComputedStyle(element, "::before");
    const candidates = Array.from(style.backgroundImage.matchAll(/url\("([^"]+)"\)/g), (match) => match[1]!);
    const loaded = new Set(loadedUrls);
    return {
      candidates,
      selected: candidates.filter((url) => loaded.has(url)),
      width: parseFloat(style.width),
      left: parseFloat(style.left),
      height: parseFloat(style.height),
      display: style.display,
      visibility: style.visibility,
      opacity: Number(style.opacity),
    };
  }, [...loaded]);
}

async function expectLoadedScene(shell: Locator, width: number, loaded: ReadonlySet<string>) {
  await expect.poll(async () => (await scene(shell, loaded)).selected.length).toBe(1);
  const state = await scene(shell, loaded);
  expect(state.candidates.length).toBeGreaterThan(0);
  expect(state.display).not.toBe("none");
  expect(state.visibility).toBe("visible");
  expect(state.opacity).toBeGreaterThan(0);
  expect(state.width).toBeGreaterThanOrEqual(width - 1);
  expect(state.left).toBeLessThanOrEqual(1);
  // Desktop and mobile may use different crop heights and sizing strategies.
  if (width >= 768) expect(state.height).toBeGreaterThanOrEqual(500);
  else expect(state.height).toBeGreaterThan(0);
  // Decode only the browser-selected resource, never an unused image-set fallback.
  const decoded = await shell.evaluate(async (_element, src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  }, state.selected[0]!);
  expect(decoded.width).toBeGreaterThan(0);
  expect(decoded.height).toBeGreaterThan(0);
  return state;
}

for (const width of [320, 390, 768, 1440] as const) {
  for (const theme of ["dark", "light"] as const) {
    test(`midnight edition paints full-bleed ${theme} art without downloading the alternate theme at ${width}`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const requested = new Set<string>();
      const loaded = new Set<string>();
      const errors: string[] = [];
      page.on("request", (request) => requested.add(request.url()));
      page.on("response", (response) => {
        if (response.ok() && response.request().resourceType() === "image") loaded.add(response.url());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await prepare(page, theme);
      const shell = page.locator(".newspaper-shell");
      const initial = await expectLoadedScene(shell, width, loaded);
      expect(new URL(initial.selected[0]!).pathname).toBe(`/game-art/leaderboard/edition-${theme}-v1.webp`);
      const initialRequests = new Set(requested);
      expect(initial.candidates.filter((url) => initialRequests.has(url))).toEqual(initial.selected);
      expect([...initialRequests].some((url) => url.includes("leaderboard-headline-portrait"))).toBe(false);

      await expect(page.getByText("Runtime Error", { exact: true })).toHaveCount(0);
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      const visible = await page.screenshot({ animations: "disabled" });
      await info.attach("edition-scene", { body: visible, contentType: "image/png" });
      const hidden = await page.addStyleTag({ content: ".newspaper-shell::before { visibility: hidden !important; }" });
      let without: Buffer;
      try {
        without = await page.screenshot({ animations: "disabled" });
      } finally {
        await hidden.evaluate((node) => node.parentNode?.removeChild(node));
      }
      const pixels = await sharp(visible).removeAlpha().raw().toBuffer();
      const withoutPixels = await sharp(without).removeAlpha().raw().toBuffer();
      expect(pixels.length).toBe(withoutPixels.length);
      let changed = 0;
      for (let index = 0; index < pixels.length; index += 3) {
        if (Math.abs(pixels[index]! - withoutPixels[index]!)
          + Math.abs(pixels[index + 1]! - withoutPixels[index + 1]!)
          + Math.abs(pixels[index + 2]! - withoutPixels[index + 2]!) > 6) changed++;
      }
      expect(changed / (pixels.length / 3), "scene must actually paint, not sit behind an opaque page").toBeGreaterThan(0.01);

      // Read the opposite scene after the initial-request snapshot, so this check cannot preload it.
      const alternate: Theme = theme === "dark" ? "light" : "dark";
      await page.locator("html").evaluate((node, selected) => node.setAttribute("data-theme", selected), alternate);
      const other = await expectLoadedScene(shell, width, loaded);
      expect(new URL(other.selected[0]!).pathname).toBe(`/game-art/leaderboard/edition-${alternate}-v1.webp`);
      expect(other.selected[0]).not.toBe(initial.selected[0]);
      expect(other.candidates.filter((url) => initialRequests.has(url)), "alternate-theme art must not download on initial render").toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}
