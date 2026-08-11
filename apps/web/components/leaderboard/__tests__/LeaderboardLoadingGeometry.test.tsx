import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  it(
    "keeps CLS below 0.05 when the tablet skeleton resolves to every runtime state",
    async () => {
      const skeleton = renderToStaticMarkup(<LeaderboardSkeleton />);
      const states = [
        ["empty", renderToStaticMarkup(<NewspaperEmpty />)],
        ["unavailable", renderToStaticMarkup(<NewspaperUnavailable />)],
        ["data", renderToStaticMarkup(<NewspaperPage entries={entries} issueCount={42} />)],
      ] as const;

      for (const [stateName, stateMarkup] of states) {
        const result = await measureTransition(page, skeleton, stateMarkup);
        expect(result.cls, `${stateName}: ${JSON.stringify(result.shifts)}`).toBeLessThan(0.05);
        expect(result.stateHeight + 1, stateName).toBeGreaterThanOrEqual(result.skeletonHeight);
      }
    },
    30_000,
  );

  it("uses a shared responsive state envelope instead of a fixed tall skeleton", () => {
    expect(css).not.toMatch(/\.newspaper-skeleton\s*\{[^}]*min-height:\s*(?:1500|1180)px/s);
    expect(css).toContain("--newspaper-state-min-block-size");
    expect(css).toMatch(/--newspaper-state-min-block-size:\s*clamp\(/);
    expect(css).not.toContain("max(720px");
  });

  it("gives unavailable editions an explicit way back to the main table", () => {
    const markup = renderToStaticMarkup(<NewspaperUnavailable />);

    expect(markup).toContain('data-state="unavailable"');
    expect(markup).toContain('href="/"');
    expect(markup).toContain("Към началото");
  });
});

async function measureTransition(targetPage: Page, skeletonMarkup: string, stateMarkup: string) {
  await targetPage.setContent(`
    <style>${utilityCss}${css}</style>
    <main id="state" class="shell newspaper-shell">${skeletonMarkup}</main>
    <footer id="after-state">Край на броя</footer>
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
