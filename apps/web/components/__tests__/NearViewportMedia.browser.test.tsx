import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve, sep } from "node:path";
import { chromium, firefox, webkit, type Browser, type Locator } from "playwright";
import { renderToString } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GameRulesPhaseTimeline, type GameRulesPhase } from "../games/GameRulesPhaseTimeline";
import { UniversalHowToPlay } from "../landing/UniversalHowToPlay";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";

// Compile the real client components and CSS with the installed test toolchain.
const require = createRequire(import.meta.url);
const toolchain = createRequire(require.resolve("vitest/package.json"));
const { transform } = toolchain("lightningcss") as {
  transform(options: { filename: string; code: Buffer; cssModules: boolean }): { code: Buffer };
};
const css = ["games/GameRulesPage", "landing/LandingSurface"].map((name) => {
  const filename = resolve(process.cwd(), `components/${name}.module.css`);
  return transform({ filename, code: readFileSync(filename), cssModules: true }).code.toString();
}).join("\n");
const publicRoot = resolve(process.cwd(), "public");
const imageConfig = { ...imageConfigDefault, qualities: [75, 85] };
const origin = "https://near-viewport.test";
const phases: GameRulesPhase[] = ["role_reveal", "night", "day_discussion", "nomination", "voting", "resolution"].map((phase, index) => ({
  id: phase, phase: phase as GameRulesPhase["phase"], title: `Phase ${index}`, short: `Step ${index}`,
  body: `Public phase ${index}`, timer: "60", wakes: "Public", example: "Example", watch: "Watch",
}));
const scenarios = [
  { family: "werewolves", theme: "light", width: 390 },
  { family: "mafia", theme: "dark", width: 390 },
  { family: "werewolves", theme: "dark", width: 1440 },
  { family: "mafia", theme: "light", width: 1440 },
] as const;
let bundle: string;

beforeAll(() => {
  // A plain Node process avoids mixing JSDOM and Node typed-array realms in esbuild.
  bundle = execFileSync(process.execPath, ["-e", `
    const config = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
    process.stdout.write(require(${JSON.stringify(toolchain.resolve("esbuild"))}).buildSync(config).outputFiles[0].text);
  `], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024, input: JSON.stringify({
    absWorkingDir: process.cwd(), bundle: true, write: false, platform: "browser", format: "iife",
    alias: { "@": process.cwd(), "next/image": resolve(process.cwd(), "components/__tests__/fixtures/NextImage.tsx") }, jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import { Fragment, createElement } from "react";
      import { createRoot, hydrateRoot } from "react-dom/client";
      import { GameRulesPhaseTimeline } from "./components/games/GameRulesPhaseTimeline";
      import { UniversalHowToPlay } from "./components/landing/UniversalHowToPlay";
      import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
      const { phases, mode, hydrate } = JSON.parse(document.querySelector('#props').textContent);
      const tree = createElement(ImageConfigContext.Provider, { value: ${JSON.stringify(imageConfig)} }, createElement(Fragment, null,
        createElement(GameRulesPhaseTimeline, { phases, mode }),
        createElement('div', { style: { height: 1600 } }),
        createElement(UniversalHowToPlay)));
      const root = document.querySelector('#root');
      if (hydrate) hydrateRoot(root, tree, { onRecoverableError: error => console.error(error) });
      else createRoot(root).render(tree);
    ` },
  }) });
});

async function nearViewport(parent: Locator) {
  await parent.evaluate((element) => {
    window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - window.innerHeight - 80);
  });
}

async function decoded(images: Locator, count: number) {
  await expect.poll(() => images.count()).toBe(count);
  await expect.poll(() => images.evaluateAll((elements) => elements.every((element) => {
    const image = element as HTMLImageElement;
    return image.complete && image.naturalWidth > 0;
  }))).toBe(true);
}

// CI's unit job installs Chromium only; opt in explicitly for the cross-engine audit.
const engines = process.env.NEAR_VIEWPORT_MEDIA_ALL_BROWSERS === "1" ? { chromium, firefox, webkit } : { chromium };
for (const [name, engine] of Object.entries(engines)) {
  describe(`${name} near-viewport media without a Next server`, () => {
    let browser: Browser;
    beforeAll(async () => { browser = await engine.launch({ headless: true }); });
    afterAll(async () => { await browser?.close(); });

    for (const scenario of scenarios) {
      for (const mode of ["hydrate", "client", "no-js"] as const) {
        it(`${mode} ${scenario.family} ${scenario.theme} ${scenario.width}px preserves art and request boundaries`, async () => {
          const page = await browser.newPage({
            viewport: { width: scenario.width, height: 823 }, deviceScaleFactor: 2,
            colorScheme: scenario.theme, javaScriptEnabled: mode !== "no-js",
          });
          page.setDefaultTimeout(5_000);
          const gameMode = scenario.family === "mafia" ? "mafia_sport" : "werewolves_classic";
          const tree = <ImageConfigContext.Provider value={imageConfig}><GameRulesPhaseTimeline phases={phases} mode={gameMode} />
            <div style={{ height: 1600 }} /><UniversalHowToPlay /></ImageConfigContext.Provider>;
          const html = `<!doctype html><html data-theme="${scenario.theme}"><head>
            <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
            * { box-sizing: border-box; } body { margin: 0; } ${css}
            #root { margin-top: 1600px; padding-bottom: 1600px; }
            </style></head><body><main id="root" data-family="${scenario.family}">${mode === "client" ? "" : renderToString(tree)}</main>
            <script id="props" type="application/json">${JSON.stringify({ phases, mode: gameMode, hydrate: mode === "hydrate" })}</script>
            <script src="/fixture.js"></script></body></html>`;
          const requests: string[] = [];
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
          page.on("request", (request) => {
            if (/phase-board|thumbs/.test(request.url())) requests.push(request.url());
          });
          try {
            await page.route(`${origin}/**`, async (route) => {
              const url = new URL(route.request().url());
              if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
              if (url.pathname === "/fixture.js") return route.fulfill({ contentType: "text/javascript", body: bundle });
              const source = url.pathname === "/_next/image" ? url.searchParams.get("url")! : url.pathname;
              const path = resolve(publicRoot, `.${new URL(source, origin).pathname}`);
              if (!path.startsWith(publicRoot + sep)) return route.abort();
              // Serve original public bytes; optimizer density/format gates remain in the app suite.
              return route.fulfill({ path });
            });
            await page.goto(origin, { waitUntil: "networkidle" });
            expect(errors).toEqual([]);
            const cards = page.locator(".phase-node");
            const deck = page.locator(".home-start-deck");
            expect(await cards.count()).toBe(6);
            if (mode !== "no-js") {
              expect(requests).toEqual([]);
              expect(await page.locator("img").count()).toBe(0);
              expect(await page.locator("noscript img").count()).toBe(0);
            } else {
              expect(await page.locator("noscript img").count()).toBe(9);
            }

            await nearViewport(cards.first());
            expect(errors).toEqual([]);
            const before = await cards.first().boundingBox();
            await decoded(cards.first().locator("img"), 1);
            const after = (await cards.first().boundingBox())!;
            expect(after.width).toBe(before!.width);
            expect(after.height).toBe(before!.height);
            if (mode !== "no-js") {
              expect(after.y).toBeGreaterThan(823);
              expect(await deck.locator("img").count()).toBe(0);
              if (scenario.width === 390) expect(await cards.last().locator("img").count()).toBe(0);
            }
            for (const card of await cards.all()) {
              await card.scrollIntoViewIfNeeded();
              await decoded(card.locator("img"), 1);
            }
            const image = cards.first().locator("img");
            expect(await image.getAttribute("width")).toBe("1120");
            expect(await image.getAttribute("height")).toBe("800");
            expect(await image.getAttribute("sizes")).toContain("249px");
            expect(await image.getAttribute("srcset")).toContain("1120.webp");
            const selected = new URL(await image.evaluate((element: HTMLImageElement) => element.currentSrc));
            expect(selected.searchParams.get("q")).toBe("85");
            expect(selected.searchParams.get("url")).toContain(`/${scenario.family}/`);
            if (mode !== "no-js") {
              await cards.last().click();
              expect(await cards.last().getAttribute("aria-pressed")).toBe("true");
              expect(await page.locator("#phase-detail-panel").textContent()).toContain("Public phase 5");
            }

            await nearViewport(deck);
            const deckBefore = await deck.boundingBox();
            await decoded(deck.locator("img"), 3);
            const deckAfter = (await deck.boundingBox())!;
            expect(deckAfter.width).toBe(deckBefore!.width);
            expect(deckAfter.height).toBe(deckBefore!.height);
            if (mode !== "no-js") expect(deckAfter.y).toBeGreaterThan(823);
            expect(await deck.getAttribute("aria-hidden")).toBe("true");
            const art = await deck.locator("img").evaluateAll((images) => images.map((element) => ({
              src: element.getAttribute("src"), alt: element.getAttribute("alt"),
              width: element.getAttribute("width"), height: element.getAttribute("height"),
              transform: getComputedStyle(element).transform,
              parent: element.parentElement!.tagName,
            })));
            expect(art.map((image) => image.src)).toEqual([
              expect.stringMatching(/role-seer\.webp\?v=/),
              expect.stringMatching(/mafia\/role-commissioner\.webp\?v=/),
              "/game-art/thumbs/card-back-secret.webp",
            ]);
            for (const image of art) {
              expect(image).toMatchObject({ alt: "", width: "520", height: "780" });
              expect(image.transform).not.toBe("none");
              expect(image.parent).toBe(mode === "no-js" ? "NOSCRIPT" : "SPAN");
            }
            expect(new Set(art.map((image) => image.transform)).size).toBe(3);
            await page.evaluate(() => window.scrollTo(0, 0));
            expect(await page.locator("img").count()).toBe(9);
            expect(new Set(requests).size).toBe(8);
            expect(errors).toEqual([]);
          } finally {
            await page.close();
          }
        }, 30_000);
      }
    }
  });
}
