import { resolve, sep } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadedEnvironment, observePlayEnvironmentResources, playEnvironmentDiagnostics } from "../../__visual__/play-environment-resources";

const origin = "https://play-environment.test";
const publicRoot = resolve(process.cwd(), "public");
const art = "/game-art/mobile/play/bg-play-werewolves-night-v2";
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser?.close(); });

async function fixture() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await observePlayEnvironmentResources(page);
  await page.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: `<!doctype html>
      <html><head><meta charset="utf-8"><style>
        body { margin: 0; background: black; }
        main { width: 390px; height: 844px; }
        main::before { content: ""; position: fixed; inset: 0; background-size: cover; }
        .play-stage { width: 100px; height: 100px; background-size: cover; position: relative; }
      </style></head><body><main class="play-shell"><div class="play-stage"></div></main></body></html>` });
    if (url.pathname.startsWith("/noise/")) return route.fulfill({ contentType: "text/plain", body: "noise" });
    const path = resolve(publicRoot, `.${url.pathname}`);
    if (!path.startsWith(publicRoot + sep)) return route.abort();
    return route.fulfill({ path });
  });
  await page.goto(origin);
  return page;
}

async function selectedByOldSampler(page: Page) {
  return page.locator("main").evaluate((element) => {
    const candidates = Array.from(getComputedStyle(element, "::before").backgroundImage.matchAll(/url\("([^"]+)"\)/g), (match) => match[1]!);
    const requested = new Set(performance.getEntriesByType("resource").map((entry) => entry.name));
    return candidates.find((url) => requested.has(url)) ?? null;
  });
}

describe("play environment resource observation", () => {
  it.each(["image/avif", "image/unsupported-fixture"])(
    "survives the real default buffer limit and follows the browser's format selection (%s)", async (firstType) => {
      const page = await fixture();
      const imageRequests: string[] = [];
      page.on("request", (request) => { if (request.url().includes("bg-play-")) imageRequests.push(request.url()); });
      try {
        await page.evaluate(async () => {
          for (let index = 0; index < 300; index++) await (await fetch(`/noise/${index}`)).text();
        });
        expect((await playEnvironmentDiagnostics(page)).bufferedEntries).toBe(250);
        await page.addStyleTag({ content: `main::before { background-image: image-set(url("${art}.avif") type("${firstType}"), url("${art}.webp") type("image/webp")); }` });
        const expected = `${art}.${firstType === "image/avif" ? "avif" : "webp"}`;
        await expect.poll(async () => (await loadedEnvironment(page.locator("main"), "::before")).path).toBe(expected);
        const environment = await loadedEnvironment(page.locator("main"), "::before");
        expect(new Set(imageRequests)).toEqual(new Set([origin + expected]));
        expect(environment).toMatchObject({ width: 390, height: 844, position: "fixed", filter: "none" });
        expect(environment.imageHeight).toBeGreaterThan(environment.imageWidth);
        expect(Math.max(environment.width / environment.imageWidth, environment.height / environment.imageHeight)).toBeLessThanOrEqual(1.35);
        expect(await selectedByOldSampler(page)).toBeNull();
        const state = await playEnvironmentDiagnostics(page);
        expect(state.bufferedEntries).toBe(250);
        expect(state.resources!.observedEntries).toBeGreaterThanOrEqual(301);
        expect(state.resources!.bufferFullEvents).toBeGreaterThan(0);
        expect(Object.values(state.resources!.sources)).toEqual([origin + expected]);

        const visible = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer();
        await page.addStyleTag({ content: "main::before { visibility: hidden; }" });
        const hidden = await sharp(await page.screenshot()).removeAlpha().raw().toBuffer();
        let changed = 0;
        for (let index = 0; index < visible.length; index += 3) {
          if (Math.abs(visible[index]! - hidden[index]!) + Math.abs(visible[index + 1]! - hidden[index + 1]!) + Math.abs(visible[index + 2]! - hidden[index + 2]!) > 6) changed++;
        }
        expect(changed / (visible.length / 3)).toBeGreaterThan(0.01);
      } finally { await page.close(); }
    },
  );

  it("retains observed art for CSS memory reuse without inventing an unrequested candidate", async () => {
    const page = await fixture();
    try {
      await page.addStyleTag({ content: `main::before { background-image: url("${art}.webp"); }` });
      await expect.poll(async () => (await loadedEnvironment(page.locator("main"), "::before")).path).toBe(`${art}.webp`);
      await page.evaluate(() => performance.clearResourceTimings());
      await page.locator(".play-stage").evaluate((element, source) => { (element as HTMLElement).style.backgroundImage = `url("${source}")`; }, `${art}.webp`);
      expect((await loadedEnvironment(page.locator(".play-stage"), null)).path).toBe(`${art}.webp`);
      expect(await selectedByOldSampler(page)).toBeNull();
      await page.addStyleTag({ content: 'main::before { content: none; background-image: url("/game-art/mobile/play/bg-play-mafia-day-v2.webp"); }' });
      expect((await loadedEnvironment(page.locator("main"), "::before")).path).toBeNull();
    } finally { await page.close(); }
  });

  it("bounds storage by the 16 environment paths and resets it on navigation", async () => {
    const page = await fixture();
    try {
      await page.evaluate(async (art) => {
        for (let revision = 0; revision < 20; revision++) await (await fetch(`${art}.webp?revision=${revision}`)).arrayBuffer();
      }, art);
      await expect.poll(async () => (await playEnvironmentDiagnostics(page)).resources!.sources[`${art}.webp`]).toBe(`${origin}${art}.webp?revision=19`);
      expect(Object.keys((await playEnvironmentDiagnostics(page)).resources!.sources)).toEqual([`${art}.webp`]);
      await page.goto(`${origin}/?next-document`);
      expect((await playEnvironmentDiagnostics(page)).resources!.sources).toEqual({});
    } finally { await page.close(); }
  });
});
