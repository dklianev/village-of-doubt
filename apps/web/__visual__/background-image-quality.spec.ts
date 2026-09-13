import { expect, test, type Locator, type Page } from "playwright/test";
import sharp from "sharp";

const viewports = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
];
const routes = [
  { path: "/create?visualAuth=1", shell: "lobby-shell", art: "bg-lobby-tavern", position: "50% 50%" },
  { path: "/werewolf/create?visualAuth=1", shell: "lobby-shell", art: "bg-lobby-tavern", position: "50% 50%" },
  { path: "/mafia/create?visualAuth=1", shell: "lobby-shell", art: "mafia/bg-lobby-tavern", position: "50% 50%" },
  { path: "/werewolf/roles", shell: "roles-shell", art: "bg-night-phase", position: "50% 28%" },
  { path: "/mafia/roles", shell: "roles-shell", art: "mafia/bg-night-phase", position: "50% 30%" },
];

async function prepare(page: Page, theme: "dark" | "light") {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.addInitScript((theme) => {
    localStorage.setItem("werewolf-theme", theme);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);
}

async function backdrop(shell: Locator) {
  return shell.evaluate(async (element) => {
    const style = getComputedStyle(element, "::before");
    const urls = Array.from(style.backgroundImage.matchAll(/url\("([^"]+)"\)/g), (match) => match[1]!);
    const images = await Promise.all(urls.map(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return { url, width: image.naturalWidth, height: image.naturalHeight };
    }));
    const width = parseFloat(style.width);
    const height = parseFloat(style.height);
    return {
      display: style.display,
      position: style.position,
      top: parseFloat(style.top),
      width,
      height,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: window.visualViewport!.height,
      backgroundPosition: style.backgroundPosition.split(", ").at(-1),
      backgroundSize: style.backgroundSize.split(", ").at(-1),
      images,
      coverScale: Math.max(...images.map((image) => Math.max(width / image.width, height / image.height))),
    };
  });
}

function expectViewportBackdrop(state: Awaited<ReturnType<typeof backdrop>>) {
  expect(state.display).toBe("block");
  expect(state.position).toBe("fixed");
  expect(state.top).toBe(64);
  expect(state.width).toBeCloseTo(state.viewportWidth, 0);
  expect(state.height).toBeCloseTo(state.viewportHeight - 64, 0);
  expect(state.backgroundSize).toBe("cover");
  expect(state.images).toHaveLength(1);
  // A landscape thumbnail must not be enlarged to the height of a long page.
  expect(state.coverScale).toBeLessThanOrEqual(1.25);
}

for (const theme of ["dark", "light"] as const) {
  for (const viewport of viewports) {
    for (const route of routes) {
      test(`background quality ${route.path} ${theme} ${viewport.width}`, async ({ page }, info) => {
        await page.setViewportSize(viewport);
        await prepare(page, theme);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await page.goto(route.path);
        // Cache Components retains inactive main elements during client navigation.
        const shell = page.locator(`main.${route.shell}:visible`);
        await expect(shell.locator("h1")).toBeVisible();
        await expect(page).toHaveURL(new RegExp(route.path.split("?")[0]!));
        expect(await page.title()).not.toBe("");
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

        if (theme === "dark") {
          const initial = await backdrop(shell);
          await info.attach("backdrop-geometry", { body: JSON.stringify(initial), contentType: "application/json" });
          expectViewportBackdrop(initial);
          expect(initial.backgroundPosition).toBe(route.position);
          expect(new URL(initial.images[0]!.url).pathname).toBe(`/game-art/${route.art}.webp`);

          const visible = await page.screenshot({ path: info.outputPath("viewport.png"), animations: "disabled", caret: "initial" });
          await info.attach("viewport", { body: visible, contentType: "image/png" });
          // Geometry alone misses negative-z-index artwork hidden behind an opaque layer.
          const hidden = await page.addStyleTag({ content: `main.${route.shell}::before { visibility: hidden !important; }` });
          let withoutBackdrop: Buffer;
          try {
            withoutBackdrop = await page.screenshot({ animations: "disabled", caret: "initial" });
          } finally {
            await hidden.evaluate((element) => element.parentNode?.removeChild(element));
          }
          const pixels = await sharp(visible).removeAlpha().raw().toBuffer();
          const withoutPixels = await sharp(withoutBackdrop).removeAlpha().raw().toBuffer();
          expect(pixels.length).toBe(withoutPixels.length);
          let changed = 0;
          for (let index = 0; index < pixels.length; index += 3) {
            if (Math.abs(pixels[index]! - withoutPixels[index]!) + Math.abs(pixels[index + 1]! - withoutPixels[index + 1]!) + Math.abs(pixels[index + 2]! - withoutPixels[index + 2]!) > 6) changed++;
          }
          expect(changed / (pixels.length / 3)).toBeGreaterThan(0.01);

          await page.evaluate(() => window.scrollTo(0, 300));
          await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
          const scrolled = await backdrop(shell);
          expectViewportBackdrop(scrolled);
          expect(scrolled.height).toBe(initial.height);
          expect(scrolled.coverScale).toBe(initial.coverScale);
          await page.screenshot({ path: info.outputPath("scrolled.png"), animations: "disabled", caret: "initial" });

          await page.setViewportSize({ width: viewport.width, height: viewport.height - 120 });
          expectViewportBackdrop(await backdrop(shell));
        } else {
          expect(await shell.evaluate((element) => getComputedStyle(element, "::before").display)).toBe("none");
          await page.screenshot({ path: info.outputPath("light.png"), animations: "disabled", caret: "initial" });
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page.getByText("Runtime Error", { exact: true })).toHaveCount(0);
        expect(errors).toEqual([]);
      });
    }
  }
}

for (const family of ["werewolf", "mafia"]) {
  test(`achievements styles do not replace ${family} rules backdrop after navigation`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page, "dark");
    await page.goto("/");
    await page.locator(`main:visible a[href="/${family}/rules"]`).first().click();
    await expect(page.locator("main.rules-shell:visible")).toBeVisible();
    const expected = await page.evaluate(() => getComputedStyle(document.body, "::before").backgroundImage);

    await page.goto("/achievements?visualAuth=1");
    await expect(page.locator("main.achievement-shell:visible")).toBeVisible();
    await page.locator(".site-brand-wordmark").click();
    await page.waitForURL("/");
    await page.locator(`main:visible a[href="/${family}/rules"]`).first().click();
    const shell = page.locator("main.rules-shell:visible");
    await expect(shell).toBeVisible();
    expect(await shell.evaluate((element) => getComputedStyle(element, "::before").display)).toBe("none");
    expect(await page.evaluate(() => getComputedStyle(document.body, "::before").backgroundImage)).toBe(expected);
  });
}

async function paintedBackground(target: Locator, pseudo: string | null = "::before") {
  return target.evaluate(async (element, pseudo) => {
    const style = getComputedStyle(element, pseudo);
    const requested = new Set(performance.getEntriesByType("resource").map((entry) => entry.name));
    const candidates = Array.from(style.backgroundImage.matchAll(/url\("([^"]+)"\)/g), (match) => match[1]!);
    // Observe the browser's image-set request before decoding; do not load its unused fallback.
    const selected = candidates.find((url) => requested.has(url));
    const image = new Image();
    if (selected) {
      image.src = selected;
      await image.decode();
    }
    const width = parseFloat(style.width);
    const height = parseFloat(style.height);
    const matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
    return {
      path: selected ? new URL(selected).pathname : null,
      candidates: candidates.map((url) => new URL(url).pathname),
      width,
      height,
      position: style.position,
      top: parseFloat(style.top),
      backgroundPosition: style.backgroundPosition,
      backgroundSize: style.backgroundSize,
      display: style.display,
      content: style.content,
      coverScale: selected ? Math.max(width / image.naturalWidth, height / image.naturalHeight) * Math.hypot(matrix.a, matrix.b) : null,
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
      viewportHeight: window.visualViewport!.height,
    };
  }, pseudo);
}

const ambientRoutes = [
  { name: "history", path: "/history?visualHistory=fixture", selector: "main.history-shell:visible", art: (theme: string) => `history/bg-history-archive-desk${theme === "light" ? "-light" : ""}-v1` },
  { name: "account", path: "/account?visualAuth=1", selector: "body", art: (theme: string) => theme === "dark" ? "account/bg-account-archive-room-dark-v1" : null },
  { name: "friends", path: "/friends?visualAuth=1", selector: "body", art: (theme: string) => `friends/bg-friends-invitation-${theme}-v1` },
  { name: "achievements", path: "/achievements?visualAuth=1&visualAchievements=fixture", selector: "body", art: (theme: string) => theme === "dark" ? "achievements/bg-legends-hall-v1" : null },
];

for (const theme of ["dark", "light"] as const) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 640, height: 360 }, { width: 1440, height: 900 }]) {
    for (const route of ambientRoutes) {
      test(`ambient quality ${route.name} ${theme} ${viewport.width}`, async ({ page }, info) => {
        await page.setViewportSize(viewport);
        await prepare(page, theme);
        await page.goto(route.path);
        await expect(page.locator("main:visible h1")).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: info.outputPath("viewport.png"), animations: "disabled", caret: "initial" });
        const target = page.locator(route.selector);
        const initial = await paintedBackground(target);
        await info.attach("chosen-background", { body: JSON.stringify(initial), contentType: "application/json" });
        const art = route.art(theme);
        if (art) {
          const mobileLandscape = viewport.width <= 720 && viewport.width > viewport.height;
          expect(initial.path).toMatch(new RegExp(`^/game-art/${mobileLandscape ? "mobile/" : ""}${art}\\.(webp|avif)$`));
          expect(initial.coverScale).toBeLessThanOrEqual(1.35);
          expect(initial.position).toBe("fixed");
          expect(initial.height).toBeGreaterThanOrEqual(viewport.height - 64);
          expect(initial.height).toBeLessThanOrEqual(viewport.height * 1.09);
          await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
          await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
          const scrolled = await paintedBackground(target);
          expect(scrolled.height).toBe(initial.height);
          expect(scrolled.top).toBe(initial.top);
          expect(scrolled.backgroundPosition).toBe(initial.backgroundPosition);
          expect(scrolled.backgroundSize).toBe(initial.backgroundSize);
          expect(scrolled.path).toBe(initial.path);
          await page.screenshot({ path: info.outputPath("scrolled.png"), animations: "disabled", caret: "initial" });
        } else {
          // Do not activate previously unpainted light-theme ambient scenes.
          expect(initial.path).toContain("texture-ornament-sheet.webp");
          expect(initial.backgroundSize).toContain("860px 860px");
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      });
    }
  }

  for (const family of ["werewolves", "mafia"] as const) {
    test(`play backgrounds and portrait inlay ${family} ${theme}`, async ({ page }, info) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await prepare(page, theme);
      for (const [phase, period] of [
        ["lobby", "day"], ["role_reveal", "day"], ["night", "night"],
        ["day_discussion", "day"], ["voting", "day"], ["resolution", "day"],
      ]) {
        await page.goto(`/play/VISUAL?visualGame=1&family=${family}&phase=${phase}&players=10&viewer=host`);
        const stage = page.locator(".play-stage:visible");
        await expect(stage).toHaveAttribute("data-layout-ready", "true");
        await page.screenshot({ path: info.outputPath(`${phase}.png`), animations: "disabled", caret: "initial" });
        const shell = page.locator("main.play-shell:visible");
        const background = await paintedBackground(shell);
        expect(background.path).toMatch(new RegExp(`^/game-art/mobile/play/bg-play-${family}-${period}-v2\\.(avif|webp)$`));
        expect(background.position).toBe("fixed");
        expect(background.height).toBe(844);
        expect(background.coverScale).toBeLessThanOrEqual(1.35);
        const room = await paintedBackground(stage, null);
        expect(room.path).toBe(background.path);
        expect(room.coverScale).toBeLessThanOrEqual(1.35);
        const inlay = await paintedBackground(stage.locator('[class*="__tableSurface"]'));
        const inlayVersion = family === "mafia" ? "v2" : "v1";
        expect(inlay.path).toMatch(new RegExp(`^/game-art/mobile/play/table-inlay-${family}-${inlayVersion}\\.(avif|webp)$`));
        expect(inlay.backgroundPosition).toBe("50% 0%");
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        const scrolled = await paintedBackground(shell);
        expect(scrolled.height).toBe(background.height);
        expect(scrolled.path).toBe(background.path);
        expect(scrolled.top).toBe(background.top);
      }
    });
  }

  test(`tutorial scene quality and unchanged ambient ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page, theme);
    await page.goto("/tutorial?step=1");
    const stage = page.locator(".tutorial-slide-stage:visible");
    await expect(stage).toHaveAttribute("data-tutorial-scene", "setup");
    for (const [scene, art] of [["setup", "day"], ["night", "night"]]) {
      await expect(stage).toHaveAttribute("data-tutorial-scene", scene!);
      const slide = stage.locator(".tutorial-slide");
      await expect(slide).toBeVisible();
      await expect.poll(async () => (await paintedBackground(slide, null)).path)
        .toBe(`/game-art/tutorial-${art}-scene.webp`);
      await page.screenshot({ path: info.outputPath(`${scene}.png`), animations: "disabled", caret: "initial" });
      const initial = await paintedBackground(slide, null);
      expect(initial.path).toBe(`/game-art/tutorial-${art}-scene.webp`);
      expect(initial.coverScale).toBeLessThanOrEqual(1.35);
      const ambient = await paintedBackground(page.locator("body"));
      expect(ambient.path).toContain("texture-ornament-sheet.webp");
      expect(ambient.backgroundSize).toContain("860px 860px");
      expect(await page.locator("main.tutorial-shell:visible").evaluate((element) => getComputedStyle(element, "::before").content)).toBe("none");
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      const scrolled = await paintedBackground(slide, null);
      expect(scrolled.height).toBe(initial.height);
      expect(scrolled.backgroundPosition).toBe(initial.backgroundPosition);
      expect(scrolled.backgroundSize).toBe(initial.backgroundSize);
      if (scene === "setup") {
        await page.evaluate(() => scrollTo(0, 0));
        await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
        await page.getByRole("button", { name: "Следваща сцена", exact: true }).click();
      }
    }
  });
}
