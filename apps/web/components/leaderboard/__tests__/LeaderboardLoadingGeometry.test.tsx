import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtureLeaderboard, LEADERBOARD_FIXTURE_AS_OF } from "@/app/leaderboard/leaderboard-fixture";
import { LeaderboardSkeleton } from "@/components/skeleton";
import { NewspaperEmpty } from "../NewspaperEmpty";
import { NewspaperPage } from "../NewspaperPage";
import { NewspaperUnavailable } from "../NewspaperUnavailable";

const css = readFileSync(resolve(process.cwd(), "components/leaderboard/Leaderboard.module.css"), "utf8").replace(
  /:global\(([^)]+)\)/g,
  "$1",
);
const utilityCss = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
  .skeleton { display: block; }
  .h-4 { height: 1rem; } .h-7 { height: 1.75rem; } .h-12 { height: 3rem; } .h-14 { height: 3.5rem; }
  .h-24 { height: 6rem; } .h-\\[360px\\] { height: 360px; }
  .w-full { width: 100%; } .w-5\\/6 { width: 83.333%; } .w-80 { width: 20rem; }
  .max-w-full { max-width: 100%; } .max-w-lg { max-width: 32rem; } .max-w-3xl { max-width: 48rem; }
  .mt-6 { margin-top: 1.5rem; } .grid { display: grid; } .content-start { align-content: start; } .gap-4 { gap: 1rem; }
`;

const entries = Array.from({ length: 18 }, (_, index) => ({
  id: `player-${index}`,
  displayName: `Играч ${index + 1}`,
  games: 20 - index,
  wins: Math.max(1, 14 - index),
  lastPlayed: new Date("2026-07-20T12:00:00.000Z"),
}));

let browser: Awaited<ReturnType<typeof chromium.launch>>;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
});

afterAll(async () => {
  await browser?.close();
}, 30_000);

describe("leaderboard loading geometry", () => {
  it.each([320, 390, 768, 1440])("keeps the ranking and its first player visible after the editorial hero at %ipx in both themes", async (width) => {
    await page.setViewportSize({ width, height: 844 });
    const markup = renderToStaticMarkup(<NewspaperPage entries={entries} asOf={LEADERBOARD_FIXTURE_AS_OF} />);
    for (const theme of ["dark", "light"]) {
      await page.setContent(`<style>${utilityCss}${css}</style><main class="newspaper-shell">${markup}</main>`);
      await page.locator("html").evaluate((node, value) => node.setAttribute("data-theme", value), theme);
      const ranking = await page.getByRole("table", { name: "Класиране" }).boundingBox({ timeout: 1500 });
      const headline = await page.getByRole("region", { name: "Начело на броя" }).boundingBox();
      const first = await page.locator("tbody tr").first().boundingBox();
      expect(ranking).not.toBeNull();
      expect(first!.y + first!.height).toBeLessThan(844);
      expect(headline!.y + headline!.height).toBeLessThanOrEqual(ranking!.y + 1);
      expect(await page.locator(".headline-portrait, .headline-main img").count()).toBe(0);
      expect(await page.locator("tbody tr").count()).toBe(entries.length);
      expect(await page.locator(".headline-runner").count()).toBe(2);
      if (width === 1440) {
        // The approved edition has an approximately 500px hero before the full ranking.
        expect(ranking!.y).toBeLessThanOrEqual(600);
        expect(await page.locator(".masthead").evaluate((node) => getComputedStyle(node).textAlign)).toMatch(/^(left|start)$/);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await page.setViewportSize({ width: 768, height: 1024 });
  });

  it("keeps empty and unavailable editions compact on mobile", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const state of [<NewspaperEmpty />, <NewspaperUnavailable />]) {
      await page.setContent(`<style>${utilityCss}${css}</style><main class="newspaper-shell">${renderToStaticMarkup(state)}</main>`);
      const edition = await page.locator(".newspaper-page").boundingBox();
      const actions = await page.locator(".empty-cta").boundingBox();
      expect(edition!.y + edition!.height).toBeLessThan(844);
      expect(actions!.y + actions!.height).toBeLessThan(650);
    }
  });

  it.each(["dark", "light"])(
    "keeps CLS below 0.05 when the tablet skeleton resolves to every runtime state in %s",
    async (theme) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      const skeleton = renderToStaticMarkup(<LeaderboardSkeleton />);
      const states = [
        ["empty", renderToStaticMarkup(<NewspaperEmpty />)],
        ["unavailable", renderToStaticMarkup(<NewspaperUnavailable />)],
        ...[1, 2, 3, 30].flatMap((count) => [
          [
            `data-${count}-dated`, renderToStaticMarkup(<NewspaperPage entries={fixtureLeaderboard(count)} asOf={LEADERBOARD_FIXTURE_AS_OF} />),
          ] as const,
          [
            `data-${count}-undated`, renderToStaticMarkup(<NewspaperPage entries={fixtureLeaderboard(count)} />),
          ] as const,
        ]),
      ] as const;

      for (const [stateName, stateMarkup] of states) {
        const result = await measureTransition(page, skeleton, stateMarkup, theme);
        expect(result.cls, `${stateName}: ${JSON.stringify(result.shifts)}`).toBeLessThan(0.05);
        expect(result.stateHeight + 1, stateName).toBeGreaterThanOrEqual(result.skeletonHeight);
      }
    },
    30_000,
  );

  it("uses the same responsive minimum envelope for loading and all runtime states", async () => {
    expect(css).not.toMatch(/\.newspaper-skeleton\s*\{[^}]*min-height:\s*(?:1500|1180)px/s);
    expect(css).toContain("--newspaper-state-min-block-size");
    expect(css).not.toContain("max(720px");
    const sizes: number[] = [];
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1200 }]) {
      await page.setViewportSize(viewport);
      const states = [<LeaderboardSkeleton />, <NewspaperEmpty />, <NewspaperUnavailable />, <NewspaperPage entries={entries} asOf={LEADERBOARD_FIXTURE_AS_OF} />];
      const minima: number[] = [];
      for (const state of states) {
        await page.setContent(`<style>${utilityCss}${css}</style><main class="newspaper-shell">${renderToStaticMarkup(state)}</main>`);
        minima.push(await page.locator(".newspaper-page").evaluate((node) => parseFloat(getComputedStyle(node).minBlockSize)));
      }
      expect(new Set(minima).size).toBe(1);
      expect(minima[0]).toBeGreaterThan(0);
      expect(minima[0]).toBeLessThan(844);
      sizes.push(minima[0]!);
    }
    expect(new Set(sizes).size).toBe(2);
  });

  it("gives unavailable editions an explicit way back to the main table", () => {
    const markup = renderToStaticMarkup(<NewspaperUnavailable />);

    expect(markup).toContain('data-state="unavailable"');
    expect(markup).toContain('href="/"');
    expect(markup).toContain("Към началото");
  });
});

async function measureTransition(targetPage: Page, skeletonMarkup: string, stateMarkup: string, theme: string) {
  await targetPage.setContent(`
    <html data-theme="${theme}">
    <style>${utilityCss}${css}</style>
    <main id="state" class="shell newspaper-shell">${skeletonMarkup}</main>
    <footer id="after-state">Край на броя</footer>
    </html>
  `);
  const skeletonHeight = await targetPage.locator(".newspaper-page").evaluate((node) => node.getBoundingClientRect().height);
  await targetPage.evaluate(() => {
    const runtimeWindow = window as typeof window & {
      __leaderboardCls?: number;
      __leaderboardObserver?: PerformanceObserver;
      __leaderboardShifts?: unknown[];
    };
    runtimeWindow.__leaderboardObserver?.disconnect();
    runtimeWindow.__leaderboardCls = 0;
    runtimeWindow.__leaderboardShifts = [];
    runtimeWindow.__leaderboardObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput: boolean; value: number }>) {
        if (!entry.hadRecentInput) {
          runtimeWindow.__leaderboardCls! += entry.value;
          runtimeWindow.__leaderboardShifts!.push({
            value: entry.value,
            sources: (entry as PerformanceEntry & {
              sources?: Array<{ node?: Element; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }>;
            }).sources?.map((source) => ({
              node: source.node?.id || source.node?.className || source.node?.tagName,
              previousRect: source.previousRect.toJSON(),
              currentRect: source.currentRect.toJSON(),
            })),
          });
        }
      }
    });
    runtimeWindow.__leaderboardObserver.observe({ type: "layout-shift" });
  });
  await targetPage.evaluate(() => new Promise<void>((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))));
  await targetPage.locator("#state").evaluate((node, markup) => {
    node.innerHTML = markup;
  }, stateMarkup);
  await targetPage.waitForTimeout(150);

  return {
    cls: await targetPage.evaluate(() => (window as typeof window & { __leaderboardCls?: number }).__leaderboardCls ?? 0),
    shifts: await targetPage.evaluate(
      () => (window as typeof window & { __leaderboardShifts?: unknown[] }).__leaderboardShifts ?? [],
    ),
    skeletonHeight,
    stateHeight: await targetPage.locator(".newspaper-page").evaluate((node) => node.getBoundingClientRect().height),
  };
}
