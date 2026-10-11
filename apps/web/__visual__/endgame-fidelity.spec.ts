import { expect, test, type Locator, type Page } from "playwright/test";

type Family = "werewolves" | "mafia";
type Theme = "dark" | "light";
const widths = [320, 390, 768, 1488] as const;
const scenes = [
  { scene: "village", winner: "village", family: "werewolves", heading: "Селото победи" },
  { scene: "town", winner: "village", family: "mafia", heading: "Градът победи" },
  { scene: "werewolves", winner: "werewolves", family: "werewolves", heading: "Върколаците победиха" },
  { scene: "mafia", winner: "mafia", family: "mafia", heading: "Мафията победи" },
  { scene: "vampires", winner: "vampires", family: "werewolves", heading: "Вампирите победиха" },
  { scene: "maniac", winner: "maniac", family: "mafia", heading: "Маниакът победи" },
  { scene: "lovers", winner: "lovers", family: "werewolves", heading: "Влюбените победиха" },
  { scene: "draw", winner: "draw", family: "werewolves", heading: "Няма победил отбор" },
] as const;

test.use({ serviceWorkers: "block", screenshot: "only-on-failure" });
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  });
});
test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page), "Endgame runtime errors").toEqual([]);
  await expect(page.getByText("Runtime Error", { exact: true })).toHaveCount(0);
});

async function openConclusion(page: Page, theme: Theme, family: Family, winner: string, players = 6, jester = true) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.addInitScript((value) => localStorage.setItem("werewolf-theme", value), theme);
  const query = new URLSearchParams({
    visualGame: "1", phase: "game_over", family, winner, players: String(players),
    mode: family === "mafia" ? "mafia_free" : "werewolves_classic",
    jesterWin: jester ? "1" : "0", gameId: "synthetic-endgame-fidelity",
  });
  await page.goto(`/play/VISUAL?${query}`, { waitUntil: "domcontentloaded" });
  const root = page.locator("[data-endgame]");
  await expect(root).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(root).toHaveAttribute("data-family", family);
  await expect(root.locator('section[aria-labelledby="conclusion-roles"] li')).toHaveCount(players);
  // The lazy conclusion can remount after SSR. Decode only the connected,
  // hydrated result that owns focus, including its personal-victory artwork.
  await page.waitForFunction(() => document.activeElement?.id === "conclusion-heading");
  await expectArtworkReady(root, true);
  await expect.poll(() => root.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe("rgba(0, 0, 0, 0)");
  return root;
}

async function expectArtworkReady(root: Locator, requireFocus = false) {
  await expect.poll(() => root.evaluate(async (element, focused) => {
    await document.fonts.ready;
    // Let responsive candidates settle before decoding the newly selected source.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const images = [...element.querySelectorAll("img")];
    const failures = await Promise.all(images.map(async (image) => {
      const selected = image.currentSrc;
      try {
        await image.decode();
      } catch (error) {
        return `${image.currentSrc || image.src}: ${(error as Error).name}: ${(error as Error).message}`;
      }
      return image.isConnected && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
        && selected === image.currentSrc ? null : `${image.currentSrc || image.src}: incomplete or changed during decode`;
    }));
    return {
      connected: element.isConnected,
      focused: !focused || (element.contains(document.activeElement) && document.activeElement?.id === "conclusion-heading"),
      hasImages: images.length > 0,
      failures: failures.filter((failure) => failure !== null),
    };
  }, requireFocus), { message: "Connected conclusion and selected artwork must decode" })
    .toEqual({ connected: true, focused: true, hasImages: true, failures: [] });
}

async function expectDecoded(image: Locator, path: string) {
  await expect(image).toHaveAttribute("src", path);
  await expect(image).toHaveAttribute("alt", "");
  await expect(image).toBeVisible();
  const source = { path, original: null };
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => {
    const describe = (value: string) => {
      if (!value) return null;
      const url = new URL(value, document.baseURI);
      return { path: url.pathname, original: url.searchParams.get("url") };
    };
    return {
      loaded: element.complete && element.naturalWidth > 0 && element.naturalHeight > 0,
      src: describe(element.src),
      currentSrc: describe(element.currentSrc),
    };
  })).toEqual({ loaded: true, src: source, currentSrc: source });
}

async function expectReadable(page: Page, label: string) {
  const conclusion = page.locator("[data-endgame]");
  await expectArtworkReady(conclusion);
  await expectDecoded(conclusion.locator('section[aria-labelledby="conclusion-heading"] > img').first(),
    `/game-art/endgame/${await conclusion.getAttribute("data-endgame")}-v1.webp`);
  // One DOM read avoids mixing rectangles from different responsive layouts.
  const result = await conclusion.evaluate((root) => {
    const scene = root.querySelector<HTMLElement>('section[aria-labelledby="conclusion-heading"]')!;
    const roster = root.querySelector<HTMLElement>('section[aria-labelledby="conclusion-roles"]')!;
    const sceneBox = scene.getBoundingClientRect();
    const headingBox = scene.querySelector("h1")!.getBoundingClientRect();
    const problems = new Set<string>();
    const labelFor = (element: Element) => `${element.tagName}: ${element.textContent?.trim().slice(0, 85)}`;
    const overlaps = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1
      && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const outside = (a: DOMRect, b: DOMRect) => a.left < b.left - 2 || a.right > b.right + 2
      || a.top < b.top - 2 || a.bottom > b.bottom + 2;
    if (document.documentElement.scrollWidth > innerWidth + 1) problems.add("document horizontal overflow");

    const backdrop = scene.querySelector<HTMLImageElement>(":scope > img")!;
    const artifact = scene.querySelector<HTMLImageElement>('img[src$="jester-v1.webp"]');
    if (root.hasAttribute("data-jester-win")) {
      if (!artifact) problems.add("missing personal-victory artwork");
      else {
        // Decoded, visible images can still be painted under the opaque backdrop.
        // Compare positioned siblings only within the same isolated scene.
        const backgroundStyle = getComputedStyle(backdrop);
        const artifactStyle = getComputedStyle(artifact);
        if (getComputedStyle(scene).isolation !== "isolate" || artifact.parentElement !== scene
          || backgroundStyle.position === "static" || artifactStyle.position === "static") {
          problems.add("personal-victory artwork must share the isolated scene stacking context");
        }
        const backgroundLayer = Number.parseInt(backgroundStyle.zIndex, 10) || 0;
        const artifactLayer = Number.parseInt(artifactStyle.zIndex, 10) || 0;
        if (artifactLayer <= backgroundLayer) {
          problems.add(`personal-victory artwork layer ${artifactStyle.zIndex} must be above backdrop ${backgroundStyle.zIndex}`);
        }
      }
    }

    const elements = [...root.querySelectorAll<HTMLElement>("h1, h2, p, a, li > strong, li > span")];
    for (const element of elements) {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (!bounds.width || !bounds.height || style.visibility !== "visible" || style.opacity === "0") {
        problems.add(`hidden ${labelFor(element)}`);
      }
      if (bounds.left < -1 || bounds.right > innerWidth + 1) problems.add(`outside viewport ${labelFor(element)}`);
      const player = element.closest("li");
      if (player && roster.contains(player)) {
        const cell = player.getBoundingClientRect();
        if (bounds.left < cell.left - 1 || bounds.right > cell.right + 1) problems.add(`outside player cell ${labelFor(element)}`);
      }
      const textRects: DOMRect[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        textRects.push(...range.getClientRects());
      }
      // Inspect actual glyphs/icons, not scrollWidth inflated by button shimmer.
      const content = [...textRects, ...[...element.querySelectorAll("svg")].map((icon) => icon.getBoundingClientRect())];
      // Display-font metrics extend beyond line boxes even without clipping.
      // Controls must contain their labels; flowing text may use its line leading.
      if (content.some((rect) => rect.left < bounds.left - 2 || rect.right > bounds.right + 2
        || ((element.matches("a") || style.overflowY !== "visible") && outside(rect, bounds)))) {
        problems.add(`text/icon exceeds box ${labelFor(element)}`);
      }
      for (let ancestor = element.parentElement; ancestor && root.contains(ancestor); ancestor = ancestor.parentElement) {
        const clip = getComputedStyle(ancestor);
        const rect = ancestor.getBoundingClientRect();
        if (content.some((part) => (clip.overflowX !== "visible" && (part.left < rect.left - 2 || part.right > rect.right + 2))
          || (clip.overflowY !== "visible" && (part.top < rect.top - 2 || part.bottom > rect.bottom + 2)))) {
          problems.add(`ancestor clips ${labelFor(element)}`);
        }
      }
    }

    const groups = [
      [...scene.querySelectorAll("h1, h2, p, a")],
      [...roster.querySelectorAll("header h2, header a")],
      ...[...roster.querySelectorAll("li")].map((player) => [...player.querySelectorAll(":scope > strong, :scope > span")]),
    ];
    for (const group of groups) {
      for (let first = 0; first < group.length; first++) {
        for (let second = first + 1; second < group.length; second++) {
          if (overlaps(group[first]!.getBoundingClientRect(), group[second]!.getBoundingClientRect())) {
            problems.add(`overlap ${labelFor(group[first]!)} / ${labelFor(group[second]!)}`);
          }
        }
      }
    }
    for (const element of scene.querySelectorAll("h1, h2, p, a")) {
      if (outside(element.getBoundingClientRect(), sceneBox)) problems.add(`outside scene ${labelFor(element)}`);
    }
    for (const action of scene.querySelectorAll("a")) {
      const rect = action.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) problems.add(`small action ${labelFor(action)}`);
    }
    return {
      problems: [...problems],
      geometry: { width: innerWidth, sceneHeight: sceneBox.height, headingTop: headingBox.top - sceneBox.top, headingHeight: headingBox.height },
    };
  });
  await test.info().attach(`${label}-geometry`, { body: JSON.stringify(result), contentType: "application/json" });
  if (result.problems.length) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const path = test.info().outputPath(`${label}.png`);
    await page.screenshot({ path, animations: "disabled" });
    await test.info().attach(label, { path, contentType: "image/png" });
  }
  expect.soft(result.problems, label).toEqual([]);
}

// Unit coverage owns result/privacy semantics; this matrix adds real decoded art
// and layout for every scene, without multiplying all widths into new page loads.
for (const theme of ["dark", "light"] as const) {
  for (const scenario of scenes) {
    test(`endgame fidelity ${scenario.scene} ${theme}: scene and personal victory at four widths`, async ({ page }) => {
      await page.setViewportSize({ width: 1488, height: 1058 });
      const root = await openConclusion(page, theme, scenario.family, scenario.winner);
      await expect(root).toHaveAttribute("data-endgame", scenario.scene);
      await expect(root).toHaveAttribute("data-jester-win", "true");
      const scene = root.locator('section[aria-labelledby="conclusion-heading"]');
      await expect(scene.getByRole("heading", { level: 1 })).toHaveText(scenario.heading);
      await expect(scene.getByRole("heading", { level: 2 })).toHaveText(scenario.scene === "draw" ? "Но Шутът спечели." : "И Шутът ви изигра.");
      await expectDecoded(scene.locator(":scope > img").first(), `/game-art/endgame/${scenario.scene}-v1.webp`);
      await expectDecoded(scene.locator('img[src$="jester-v1.webp"]'), "/game-art/endgame/jester-v1.webp");
      const personal = root.locator('li[data-personal-winner="true"]');
      await expect(personal).toHaveCount(1);
      await expect(personal.getByText("Лична победа", { exact: true })).toBeVisible();
      await expect(personal.getByText("Шут", { exact: true })).toBeVisible();
      await expect(personal.getByText("Победител", { exact: true })).toHaveCount(0);
      await expect(scene).toContainText((await personal.locator("strong").innerText()).trim());
      const winners = root.locator('li[data-winner="true"]');
      if (scenario.scene === "draw") await expect(winners).toHaveCount(0);
      else await expect(winners.first().getByText("Победител", { exact: true })).toBeVisible();

      for (const width of widths) {
        await test.step(`${width}px`, async () => {
          await page.setViewportSize({ width, height: 1058 });
          await expectReadable(page, `${scenario.scene}-${theme}-${width}`);
        });
      }
      // Draw has two meaningfully different visible results, not a faction win.
      if (scenario.scene === "draw") {
        await openConclusion(page, theme, scenario.family, "draw", 6, false);
        await expect(root.getByRole("heading", { level: 1 })).toHaveText("Няма победител");
        await expect(root.locator('[data-personal-winner], img[src$="jester-v1.webp"]')).toHaveCount(0);
        await expectReadable(page, `draw-without-personal-${theme}`);
      }
    });
  }
}

async function enlargeTextWithLongNames(root: Locator) {
  await root.evaluate((element) => {
    const name = element.querySelector<HTMLElement>('li[data-personal-winner="true"] > strong')!;
    const oldName = name.textContent!;
    const longName = "Александър-Константин-Александров";
    name.textContent = longName;
    for (const paragraph of element.querySelectorAll('section[aria-labelledby="conclusion-heading"] p')) {
      if (paragraph.textContent?.includes(oldName)) paragraph.textContent = paragraph.textContent.replace(oldName, longName);
    }
    element.querySelector("li > strong")!.textContent = "КонстантинополскиКонстантинов";
    // Fixed-pixel type ignores a root font-size change. Double computed text sizes
    // together, restoring the prior stress styles before each responsive sample.
    const text = [...element.querySelectorAll<HTMLElement>("h1, h2, p, strong, a, li, li span")];
    for (const node of text) node.style.removeProperty("font-size");
    const sizes = text.map((node) => Number.parseFloat(getComputedStyle(node).fontSize));
    text.forEach((node, index) => { node.style.fontSize = `${sizes[index]! * 2}px`; });
  });
}

for (const family of ["werewolves", "mafia"] as const) {
  for (const theme of ["dark", "light"] as const) {
    test(`endgame fidelity ${family} ${theme}: dense roster, long names and 200% text`, async ({ page }) => {
      const root = await openConclusion(page, theme, family, family === "mafia" ? "village" : "werewolves", family === "mafia" ? 24 : 30);
      for (const width of widths) {
        await test.step(`${width}px at 200%`, async () => {
          await page.setViewportSize({ width, height: 1058 });
          await enlargeTextWithLongNames(root);
          await expectReadable(page, `${family}-${theme}-${width}-200-percent`);
          await root.getByRole("link", { name: "Всички роли", exact: true }).scrollIntoViewIfNeeded();
          await expect(root.getByRole("link", { name: "Всички роли", exact: true })).toBeInViewport();
        });
      }
    });

    test(`endgame fidelity ${family} ${theme}: keyboard actions and family roles`, async ({ page }) => {
      await page.setViewportSize({ width: theme === "dark" ? 1488 : 320, height: 1058 });
      const root = await openConclusion(page, theme, family, family === "mafia" ? "mafia" : "werewolves");
      const familyPath = family === "mafia" ? "mafia" : "werewolf";
      const roster = root.locator('section[aria-labelledby="conclusion-roles"]');
      await expect(roster.getByText(family === "mafia" ? "Мафиот" : "Върколак", { exact: true })).toBeVisible();
      await expect(roster.getByText(family === "mafia" ? "Върколак" : "Мафиот", { exact: true })).toHaveCount(0);
      const primary = root.getByRole("link", { name: "Още една игра", exact: true });
      const replay = root.getByRole("link", { name: "Виж записа", exact: true });
      const roles = root.getByRole("link", { name: "Всички роли", exact: true });
      const primaryUrl = new URL((await primary.getAttribute("href"))!, page.url());
      expect(primaryUrl.pathname).toBe(`/${familyPath}/create`);
      await expect(replay).toHaveAttribute("href", "/history/synthetic-endgame-fidelity/replay");
      await expect(roles).toHaveAttribute("href", `/${familyPath}/roles`);

      // Test keyboard activation without treating a synthetic game ID as a real
      // persisted replay or creating a room. Destination flows have their own suites.
      await root.evaluate((element) => {
        element.addEventListener("click", (event) => {
          const link = (event.target as Element).closest("a");
          if (!link) return;
          event.preventDefault();
          event.stopPropagation();
          element.setAttribute("data-keyboard-action", link.getAttribute("href")!);
        }, true);
      });
      for (const link of [primary, replay, roles]) {
        await page.keyboard.press("Tab");
        await expect(link).toBeFocused();
        await expect(link).toBeInViewport({ ratio: 1 });
        await expect.poll(() => link.evaluate((element) => {
          const style = getComputedStyle(element);
          return element.matches(":focus-visible") && ((style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0)
            || style.boxShadow !== "none");
        }), { message: "Keyboard focus has a visible indicator" }).toBe(true);
        await page.keyboard.press("Enter");
        await expect(root).toHaveAttribute("data-keyboard-action", (await link.getAttribute("href"))!);
      }
      await page.keyboard.press("Shift+Tab");
      await expect(replay).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(primary).toBeFocused();
    });
  }
}
