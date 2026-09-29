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
  { name: "account", path: "/account?visualAuth=1", selector: "body", art: (theme: string) => `account/bg-account-archive-room-${theme}-v1` },
  { name: "friends", path: "/friends?visualAuth=1", selector: "body", art: (theme: string) => `friends/bg-friends-invitation-${theme}-v1` },
];

for (const theme of ["dark", "light"] as const) {
  test(`account scene keeps its desktop composition on narrow screens ${theme}`, async ({ page }) => {
    await prepare(page, theme);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/account?visualAuth=1");
    await page.getByRole("tab", { name: "Образ и достъп", exact: true }).click();
    await page.getByRole("tab", { name: "Хроника", exact: true }).click();
    const target = page.locator("body");
    const desktop = await paintedBackground(target);
    const visibleWidth = (scene: typeof desktop) => scene.width / (scene.imageWidth * scene.coverScale!);
    expect(desktop.coverScale).toBeGreaterThan(0);
    for (const width of [320, 390, 640, 768, 1024, 1280, 1920]) {
      await page.setViewportSize({ width, height: width === 640 ? 360 : 900 });
      const scene = await paintedBackground(target);
      expect(scene.path).toContain(`account/bg-account-archive-room-${theme}-v1`);
      expect(scene.coverScale).toBeGreaterThan(0);
      expect(visibleWidth(scene), `Archive side details at ${width}px must not be cropped more than on desktop`)
        .toBeGreaterThanOrEqual(visibleWidth(desktop) - 0.005);
      expect(scene.backgroundPosition).toBe(desktop.backgroundPosition);
      expect(scene.height).toBeLessThanOrEqual(await target.evaluate(node => node.getBoundingClientRect().height));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

for (const theme of ["dark", "light"] as const) {
for (const width of theme === "light" ? [320, 390, 768, 1440, 1920] : [320, 390, 768, 1440]) {
  test(`collection scene readable over actual pixels ${theme} ${width}`, async ({ page }) => {
    await prepare(page, theme);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/achievements?visualAuth=1&visualAchievements=fixture");
    await expect(page.locator(".achievement-feature")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await paintedBackground(page.locator("body"));
    await paintedBackground(page.locator("body"), "::after");
    const labels = await page.locator(".achievement-shell").evaluate(root => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const result = [];
      while (walker.nextNode()) {
        const text = walker.currentNode;
        const element = text.parentElement!;
        if (!text.textContent?.trim() || element.closest("button, .btn, [aria-hidden='true']")) continue;
        const style = getComputedStyle(element);
        const range = document.createRange();
        range.selectNodeContents(text);
        for (const rect of range.getClientRects()) {
          if (!rect.width || !rect.height) continue;
          result.push({
            text: text.textContent.trim(), color: style.color,
            left: rect.left, top: rect.top + scrollY, right: rect.right, bottom: rect.bottom + scrollY,
            minimum: parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5,
          });
        }
      }
      return result;
    });
    expect(labels.length).toBeGreaterThan(20);
    // Hide content without changing layout or the route-specific backdrop.
    await page.addStyleTag({ content: "body * { visibility: hidden !important; } nextjs-portal { display: none; }" });
    const { data, info } = await sharp(await page.screenshot({ fullPage: true })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const luminance = (rgb: number[]) => rgb.map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
    const contrastFailures = [];
    for (const label of labels) {
      const foreground = luminance(label.color.match(/[\d.]+/g)!.slice(0, 3).map(Number));
      let minimum = Infinity;
      for (let y = Math.max(0, Math.floor(label.top)); y < Math.min(info.height, Math.ceil(label.bottom)); y++) {
        for (let x = Math.max(0, Math.floor(label.left)); x < Math.min(info.width, Math.ceil(label.right)); x++) {
          const offset = (y * info.width + x) * info.channels;
          const background = luminance([data[offset]!, data[offset + 1]!, data[offset + 2]!]);
          minimum = Math.min(minimum, (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05));
        }
      }
      if (minimum < label.minimum) contrastFailures.push({ text: label.text, ratio: minimum, minimum: label.minimum });
    }
    expect(contrastFailures, "Text stays readable over every sampled background pixel").toEqual([]);
    await page.goto("/achievements?visualAuth=1&visualAchievements=unavailable");
    await expect(page.locator(".achievement-load-state")).toBeVisible();
    const bodyHeight = await page.locator("body").evaluate(node => node.getBoundingClientRect().height);
    const scene = await paintedBackground(page.locator("body"), "::after");
    expect(scene.height + scene.top, "Scenery must not extend a short error page").toBeLessThanOrEqual(bodyHeight);
  });
}
}

for (const theme of ["dark", "light"] as const) {
  test(`collection material quality ${theme}: native repeating surface without old room downloads`, async ({ page }) => {
    await prepare(page, theme);
    for (const width of [390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/achievements?visualAuth=1&visualAchievements=fixture");
      await expect(page.locator(".achievement-feature")).toBeVisible();
      const surface = await paintedBackground(page.locator("body"));
      expect(surface.path).toBe(theme === "dark"
        ? "/game-art/achievements/collection-slate-dark-v1.webp"
        : "/game-art/achievements/collection-surface.webp");
      expect(surface.backgroundSize).toBe("512px 512px");
      expect(surface.imageWidth).toBeGreaterThanOrEqual(512);
      expect(surface.position).toBe("absolute");
      if (theme === "dark") {
        expect(await page.locator("body").evaluate(node => {
          const style = getComputedStyle(node, "::before");
          return { filter: style.filter, opacity: style.opacity };
        })).toEqual({ filter: "none", opacity: "0.4" });
        const scene = await paintedBackground(page.locator("body"), "::after");
        expect(scene.path).toBe("/game-art/achievements/collection-table-dark-v1.webp");
        expect(scene.backgroundSize).toBe("1536px 1024px");
        expect([scene.imageWidth, scene.imageHeight]).toEqual([1536, 1024]);
        expect(scene.height).toBe(1024);
        expect(scene.position).toBe("absolute");
        expect(await page.locator("body").evaluate(node => getComputedStyle(node, "::after").opacity)).toBe("1");
      } else {
        const scene = await paintedBackground(page.locator("body"), "::after");
        expect(scene.path).toBe("/game-art/achievements/collection-table-light-v1.webp");
        expect(scene.backgroundSize.replace(/ auto$/, "")).toBe(width < 640 ? "960px" : "max(100%, 1536px)");
        expect([scene.imageWidth, scene.imageHeight]).toEqual([1536, 1024]);
        expect(scene.position).toBe("absolute");
        const edges = await page.locator("body").evaluate(node => {
          const style = getComputedStyle(node, "::after");
          return { width: node.getBoundingClientRect().width, left: style.left, right: style.right, transform: style.transform, mask: style.maskImage };
        });
        expect(scene.width, "The stone reaches both screen edges, not a framed inner panel").toBe(edges.width);
        expect(edges).toMatchObject({ left: "0px", right: "0px", transform: "none" });
        expect(edges.mask.match(/linear-gradient/g)).toHaveLength(1);
        expect(edges.mask).not.toMatch(/to (left|right)/);
      }
      expect(await page.locator("body").evaluate(node => getComputedStyle(node, "::before").animationName)).toBe("none");
      expect(await page.evaluate(() => performance.getEntriesByType("resource").some(entry => entry.name.includes("bg-legends-hall")))).toBe(false);
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      const scrolled = await paintedBackground(page.locator("body"));
      expect(scrolled.top).toBe(surface.top);
      expect(scrolled.backgroundPosition).toBe(surface.backgroundPosition);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
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
          const mobileLandscape = route.name !== "account" && viewport.width <= 720 && viewport.width > viewport.height;
          expect(initial.path).toMatch(new RegExp(`^/game-art/${mobileLandscape ? "mobile/" : ""}${art}\\.(webp|avif)$`));
          expect(initial.coverScale).toBeLessThanOrEqual(1.35);
          if (route.name === "account") {
            expect(initial.position).toBe("absolute");
            expect(initial.height).toBeCloseTo(Math.min(initial.width * 55 / 72, 1100, await target.evaluate(node => node.getBoundingClientRect().height)), 1);
            const overlay = await paintedBackground(target, "::after");
            expect(overlay.height).toBeCloseTo(await target.evaluate(node => node.getBoundingClientRect().height), 2);
            expect(await target.evaluate(node => getComputedStyle(node, "::before").maskImage)).toContain("linear-gradient");
          } else {
            expect(initial.position).toBe("fixed");
            expect(initial.height).toBeGreaterThanOrEqual(viewport.height - 64);
            expect(initial.height).toBeLessThanOrEqual(viewport.height * 1.09);
          }
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
        if (phase === "lobby") {
          expect(background.path).toBe(`/game-art/lobby/waiting-${family}-${theme}-v1.webp`);
          expect(background.position).toBe("absolute");
          expect(background.backgroundSize.split(", ").at(-1)).toBe("auto 800px");
          expect(800 / background.imageHeight).toBeLessThanOrEqual(1.35);
          await expect(stage.locator('[data-table-core]')).toHaveCount(0);
          await expect(stage.locator('[class*="__tableSurface"]')).toBeHidden();
          await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
          const scrolled = await paintedBackground(shell);
          expect(scrolled.path).toBe(background.path);
          expect(scrolled.backgroundSize).toBe(background.backgroundSize);
          continue;
        }
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
      const artWindow = stage.locator(".tutorial-slide-art");
      await expect(artWindow).toBeVisible();
      await expect.poll(async () => (await paintedBackground(artWindow, null)).path)
        .toBe(`/game-art/tutorial-${art}-scene.webp`);
      await page.screenshot({ path: info.outputPath(`${scene}.png`), animations: "disabled", caret: "initial" });
      const initial = await paintedBackground(artWindow, null);
      expect(initial.path).toBe(`/game-art/tutorial-${art}-scene.webp`);
      expect(initial.backgroundSize).toBe("cover");
      expect(initial.height).toBe(228);
      const slideBox = await stage.locator(".tutorial-slide").boundingBox();
      expect(slideBox).not.toBeNull();
      expect(initial.width).toBeCloseTo(slideBox!.width, 0);
      expect(initial.height).toBeLessThan(slideBox!.height);
      expect(initial.coverScale).toBeLessThanOrEqual(1.35);
      const ambient = await paintedBackground(page.locator("body"));
      expect(ambient.path).toContain("texture-ornament-sheet.webp");
      expect(ambient.backgroundSize).toContain("860px 860px");
      expect(await page.locator("main.tutorial-shell:visible").evaluate((element) => getComputedStyle(element, "::before").content)).toBe("none");
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      const scrolled = await paintedBackground(artWindow, null);
      expect(scrolled.height).toBe(initial.height);
      expect(scrolled.backgroundPosition).toBe(initial.backgroundPosition);
      expect(scrolled.backgroundSize).toBe(initial.backgroundSize);
      expect(scrolled.path).toBe(initial.path);
      expect(scrolled.coverScale).toBe(initial.coverScale);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (scene === "setup") {
        await page.evaluate(() => scrollTo(0, 0));
        await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
        await page.getByRole("button", { name: "Следваща сцена", exact: true }).click();
      }
    }
  });
}
