import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RouteLoadingState } from "../RouteLoadingState";
import { AchievementsClient } from "@/components/achievements-client";

const require = createRequire(import.meta.url);
const toolchain = createRequire(require.resolve("vitest/package.json"));
const { transform } = toolchain("lightningcss") as {
  transform(options: { filename: string; code: Buffer; cssModules: boolean }): { code: Buffer };
};
function compile(path: string) {
  const filename = resolve(process.cwd(), path);
  return transform({ filename, code: readFileSync(filename), cssModules: true }).code.toString();
}
const loadingCss = compile("components/system/SystemPages.module.css");
const collectionCss = compile("components/achievements/LegacyAchievements.module.css");

describe("achievement loading geometry", () => {
  let browser: Browser;
  beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
  afterAll(async () => { await browser?.close(); });

  it.each([320, 600, 640, 960, 1024, 1440])("uses the collection's real columns at %spx", async (width) => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.route("**/*", route => route.abort());
      const firstRow = async (markup: string, css: string, selector: string) => {
        await page.setContent(`<!doctype html><style>*{box-sizing:border-box}body{margin:0}${css}</style>${markup}`);
        return page.locator(selector).evaluateAll(nodes => {
          const boxes = nodes.map(node => node.getBoundingClientRect());
          return boxes.filter(box => Math.abs(box.top - boxes[0]!.top) < 1).length;
        });
      };
      const loading = await firstRow(renderToStaticMarkup(<RouteLoadingState title="Постижения" variant="achievements" />), loadingCss, ".route-loading-item");
      const loaded = await firstRow(renderToStaticMarkup(<main className="shell achievement-shell"><AchievementsClient status="ready" owned={[]} /></main>), collectionCss, ".achievement-plaque");
      expect(loading).toBe(loaded);
      expect(loading).toBe(width < 640 ? 1 : width < 1024 ? 2 : 3);
    } finally { await page.close(); }
  });
});
