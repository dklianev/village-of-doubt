import assert from "node:assert/strict";

const ROUTES = [
  {
    route: "/faq",
    link: '.site-footer a[href="/faq"]',
    main: "main.faq-shell:visible",
    selectors: [".faq-hearth-hero", "h1", ".faq-hearth-search-input", ".faq-hearth-filter", ".faq-hearth-item-handle"],
  },
  ...["werewolf", "mafia"].map((family) => ({
    route: `/${family}/rules`,
    link: `.game-choice-${family} .game-choice-reference-links a[href="/${family}/rules"]`,
    main: "main.rules-shell:visible",
    selectors: [".rules-playbook-hero", "h1", ".rules-hero-actions .btn-primary", ".rules-ghost-link", ".phase-node", ".phase-detail-panel"],
  })),
];

const STYLE_PROPERTIES = [
  "display", "position", "box-sizing", "color", "background-color", "background-image",
  "font-family", "font-size", "font-weight", "line-height", "letter-spacing", "text-align",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-radius", "box-shadow", "gap", "grid-template-columns", "flex-direction",
  "align-items", "justify-content", "overflow-x", "overflow-y",
];

/** Use a fresh page for each viewport/theme; the caller owns its browser and runtime. */
export async function assertFrontendCssNavigation(page, baseUrl, theme) {
  assert.ok(theme === "light" || theme === "dark", "Expected a light or dark theme");
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.addInitScript((value) => {
    localStorage.setItem("werewolf-theme", value);
    localStorage.setItem("cookie-consent", "1");
    localStorage.setItem("welcome-modal-shown", "1");
  }, theme);

  const results = [];
  for (const target of ROUTES) {
    const url = new URL(target.route, baseUrl).href;
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    assert.ok(response?.ok(), `${target.route}: direct load failed`);
    const direct = await capture(page, target, theme);
    assert.equal(page.url(), url, `${target.route}: direct load redirected`);

    await page.goto(new URL("/", baseUrl).href, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await waitForChrome(page, theme);
    const link = page.locator(`${target.link}:visible`);
    await link.waitFor({ timeout: 10_000 });
    assert.equal(await link.count(), 1, `${target.route}: expected one visible home link`);
    await page.evaluate(() => { window.__frontendCssNavigationDocument = document; });
    await link.click({ timeout: 10_000 });
    await page.waitForURL(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    assert.equal(
      await page.evaluate(() => window.__frontendCssNavigationDocument === document),
      true,
      `${target.route}: home link replaced the document instead of client navigation`,
    );
    const navigated = await capture(page, target, theme);
    for (const selector of Object.keys(direct)) {
      assert.deepEqual(navigated[selector], direct[selector], `${target.route} (${theme}) CSS/geometry mismatch: ${selector}`);
    }
    results.push({ route: target.route, theme, viewport: page.viewportSize(), comparedElements: Object.keys(direct).length });
  }
  return results;
}

async function waitForChrome(page, theme) {
  await page.locator(`html[data-theme="${theme}"]`).waitFor({ state: "attached", timeout: 10_000 });
  await page.locator(".site-chrome:not([data-fallback]) .site-play-cta:visible:enabled").first().waitFor({ timeout: 10_000 });
  await page.waitForFunction(
    () => [...document.querySelectorAll('link[rel~="stylesheet"]')].every((link) => link.sheet),
    undefined,
    { timeout: 10_000 },
  );
}

async function capture(page, target, theme) {
  await waitForChrome(page, theme);
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  const main = page.locator(target.main);
  await main.waitFor({ timeout: 10_000 });
  assert.equal(await main.count(), 1, `${target.route}: expected one visible route surface`);
  const snapshots = {};
  const probes = [
    [".site-chrome", page.locator(".site-chrome:not([data-fallback]):visible")],
    ...target.selectors.map((selector) => [selector, main.locator(selector).first()]),
  ];
  for (const [selector, locator] of probes) {
    await locator.waitFor({ timeout: 10_000 });
    await locator.scrollIntoViewIfNeeded({ timeout: 10_000 });
    snapshots[selector] = await locator.evaluate(async (element, { properties, label }) => {
      const boundedReady = async (promise, resource) => {
        let timer;
        try {
          await Promise.race([
            promise,
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error(`${label}: ${resource} did not settle within 5 seconds`)), 5_000);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      };
      await Promise.all([
        boundedReady(Promise.all([...element.querySelectorAll("img")].map((image) => image.decode())), "image decoding"),
        boundedReady(document.fonts.ready, "font readiness"),
      ]);
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const styles = (pseudo = null) => {
        const computed = getComputedStyle(element, pseudo);
        return Object.fromEntries(properties.map((property) => [property, computed.getPropertyValue(property)]));
      };
      const read = () => {
        const rect = element.getBoundingClientRect();
        return {
          styles: styles(),
          before: styles("::before"),
          after: styles("::after"),
          bounds: { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height },
        };
      };
      let previous;
      let stableFrames = 0;
      const deadline = performance.now() + 5_000;
      while (performance.now() < deadline) {
        await frame();
        const snapshot = read();
        const serialized = JSON.stringify(snapshot);
        stableFrames = serialized === previous ? stableFrames + 1 : 0;
        if (stableFrames === 2) return snapshot;
        previous = serialized;
      }
      throw new Error("CSS/geometry did not settle within 5 seconds");
    }, { properties: STYLE_PROPERTIES, label: `${target.route} (${theme}) ${selector}` });
  }
  return snapshots;
}
