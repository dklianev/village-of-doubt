import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import { assertFrontendCssNavigation } from "./frontend-css-navigation.mjs";

const baseUrl = "http://127.0.0.1:47819";
const routes = ["/faq", "/werewolf/rules", "/mafia/rules"];
let browser;

before(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  });
});
after(async () => { await browser?.close(); });

for (const theme of ["light", "dark"]) {
  for (const width of [390, 1440]) {
    test(`direct and client CSS agree at ${width}px in ${theme}`, async (t) => {
      const page = await fixture(t, { width });
      const results = await assertFrontendCssNavigation(page, baseUrl, theme);
      assert.deepEqual(results.map((result) => result.route), routes);
      assert.ok(results.every((result) => result.theme === theme && result.comparedElements >= 6));
    });
  }
}

for (const [name, mismatch] of [
  ["color", "h1 { color: rgb(192, 0, 0) !important; }"],
  ["geometry", ".faq-hearth-hero { min-height: 237px !important; }"],
  ["pseudo-element", "h1::before { background-color: rgb(192, 0, 0) !important; }"],
]) {
  test(`rejects client-only ${name} drift`, async (t) => {
    const page = await fixture(t, { mismatch });
    await assert.rejects(assertFrontendCssNavigation(page, baseUrl, "light"), /\/faq \(light\) CSS\/geometry mismatch/);
  });
}

test("rejects a real document navigation even when its CSS matches", async (t) => {
  const page = await fixture(t, { clientNavigation: false });
  await assert.rejects(assertFrontendCssNavigation(page, baseUrl, "dark"), /replaced the document instead of client navigation/);
});

test("bounds stalled image decoding", { timeout: 15_000 }, async (t) => {
  const page = await fixture(t);
  await page.addInitScript(() => {
    HTMLImageElement.prototype.decode = () => new Promise(() => {});
    document.addEventListener("DOMContentLoaded", () => {
      document.querySelector(".faq-hearth-hero")?.append(document.createElement("img"));
    }, { once: true });
  });
  await assert.rejects(
    assertFrontendCssNavigation(page, baseUrl, "light"),
    /\/faq \(light\) \.faq-hearth-hero: image decoding did not settle within 5 seconds/,
  );
});

test("bounds stalled font readiness", { timeout: 15_000 }, async (t) => {
  const page = await fixture(t);
  await page.addInitScript(() => {
    Object.defineProperty(document.fonts, "ready", { get: () => new Promise(() => {}) });
  });
  await assert.rejects(
    assertFrontendCssNavigation(page, baseUrl, "light"),
    /\/faq \(light\) \.site-chrome: font readiness did not settle within 5 seconds/,
  );
});

async function fixture(t, { width = 390, mismatch = "", clientNavigation = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
  t.after(() => context.close());
  // Fulfill every request in memory: no HTTP listener, Next runtime, or external traffic.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    assert.equal(url.origin, baseUrl);
    await route.fulfill({ contentType: "text/html", body: html(url.pathname, mismatch, clientNavigation) });
  });
  return context.newPage();
}

function html(pathname, mismatch, clientNavigation) {
  const home = `<main class="home">
    <h1>Choose a game</h1>
    ${["werewolf", "mafia"].map((family) => `<article class="game-choice-${family}">
      <div class="game-choice-reference-links"><a href="/${family}/rules">Rules</a></div>
    </article>`).join("")}
    </main><footer class="site-footer"><a href="/faq">Help</a></footer>`;
  const faq = `<main class="faq-shell">
    <header class="faq-hearth-hero"><h1>Help</h1></header>
    <input class="faq-hearth-search-input" aria-label="Search">
    <button class="faq-hearth-filter">All</button>
    <button class="faq-hearth-item-handle">Question</button>
  </main>`;
  const pages = Object.fromEntries(routes.map((route) => [route, route === "/faq" ? faq : `<main class="rules-shell">
    <section class="rules-playbook-hero"><h1>${route} rules</h1>
      <div class="rules-hero-actions"><a class="btn-primary" href="/create">Create</a></div>
      <a class="rules-ghost-link" href="/">Home</a>
    </section>
    <button class="phase-node">Night</button><article class="phase-detail-panel">Phase details</article>
  </main>`]));
  return `<!doctype html><html><head><meta charset="utf-8">
    <script>document.documentElement.dataset.theme = localStorage.getItem("werewolf-theme");</script>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: white; color: #222; font-family: Arial, sans-serif; }
      [data-theme="dark"] body { background: #222; color: white; }
      .site-chrome { height: 60px; padding: 8px 24px; background: #ddd; }
      main { width: calc(100% - 32px); max-width: 1080px; margin: 20px auto; }
      h1 { font-size: 32px; line-height: 1.25; color: inherit; }
      h1::before { content: ""; display: block; height: 4px; background: #087f8c; }
      a, button, input { display: inline-block; padding: 12px; border: 1px solid #777; font: inherit; }
      .faq-hearth-hero, .rules-playbook-hero { padding: 24px; border: 2px solid #087f8c; }
      .phase-detail-panel { padding: 16px; }
      @media (max-width: 600px) { h1 { font-size: 24px; } }
    </style></head><body>
    <header class="site-chrome"><button class="site-play-cta">Play</button></header>
    <div id="content">${pathname === "/" ? home : pages[pathname]}</div>
    <script>
      const pages = ${JSON.stringify(pages)};
      if (${clientNavigation}) document.addEventListener("click", (event) => {
        const link = event.target.closest("a");
        if (!link || !pages[link.getAttribute("href")]) return;
        event.preventDefault();
        const href = link.getAttribute("href");
        history.pushState({}, "", href);
        document.querySelector("#content").innerHTML = pages[href];
        const style = document.createElement("style");
        style.textContent = ${JSON.stringify(mismatch)};
        document.head.append(style);
      });
    </script></body></html>`;
}
