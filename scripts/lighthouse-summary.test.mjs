import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  formatLighthouseSummary,
  lighthouseTailFailures,
  summarizeLighthouseProfile,
} from "./lighthouse-summary.mjs";

test("reports every run so a weak non-representative result remains visible", (context) => {
  const outputDir = mkdtempSync(path.join(os.tmpdir(), "lighthouse-summary-"));
  context.after(() => rmSync(outputDir, { recursive: true, force: true }));

  const reportPath = path.join(outputDir, "tutorial.report.json");
  writeFileSync(reportPath, JSON.stringify({
    finalUrl: "http://127.0.0.1:3411/tutorial?step=1",
    categories: { performance: { score: 0.9 } },
    audits: {
      "largest-contentful-paint": { numericValue: 4000 },
      "unused-javascript": { details: { overallSavingsBytes: 45_056 } },
      "largest-contentful-paint-element": {
        details: {
          type: "list",
          items: [
            { type: "table", items: [{ node: { selector: "main .tutorial-slide" } }] },
            {
              type: "table",
              items: [
                { phase: "TTFB", timing: 1000, percent: "25%" },
                { phase: "Render Delay", timing: 3000, percent: "75%" },
              ],
            },
          ],
        },
      },
      "lcp-phases-insight": {
        details: {
          type: "list",
          items: [{ type: "node", selector: "main .tutorial-slide" }],
        },
      },
    },
  }));
  writeFileSync(path.join(outputDir, "ignored.report.json"), JSON.stringify({
    finalUrl: "http://127.0.0.1:3411/tutorial?step=1",
    categories: { performance: { score: 0.76 } },
    audits: {
      "largest-contentful-paint": { numericValue: 4290 },
    },
  }));
  writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify([
    {
      url: "http://127.0.0.1:3411/tutorial?step=1",
      isRepresentativeRun: false,
      jsonPath: path.join(outputDir, "ignored.report.json"),
    },
    {
      url: "http://127.0.0.1:3411/tutorial?step=1",
      isRepresentativeRun: true,
      jsonPath: reportPath,
    },
  ]));

  const summaries = summarizeLighthouseProfile(outputDir, "mobile");

  assert.deepEqual(summaries, [
    {
      profile: "mobile",
      route: "/tutorial?step=1",
      performance: 76,
      lcpMs: 4290,
      renderDelayMs: 0,
      renderDelayPercent: 0,
      unusedJsKb: 0,
      lcpElement: "неизвестен елемент",
      representative: false,
      runIndex: 1,
      runCount: 2,
    },
    {
      profile: "mobile",
      route: "/tutorial?step=1",
      performance: 90,
      lcpMs: 4000,
      renderDelayMs: 3000,
      renderDelayPercent: 75,
      unusedJsKb: 44,
      lcpElement: "main .tutorial-slide",
      representative: true,
      runIndex: 2,
      runCount: 2,
    },
  ]);
  assert.equal(
    formatLighthouseSummary(summaries[1]),
    "Lighthouse mobile /tutorial?step=1 run 2/2 (representative): score 90, LCP 4000 ms, render delay 75% (3000 ms), unused JS 44 KB, LCP main .tutorial-slide",
  );
});

test("falls back to the insight phase table when the legacy phase table is absent", (context) => {
  const outputDir = mkdtempSync(path.join(os.tmpdir(), "lighthouse-summary-"));
  context.after(() => rmSync(outputDir, { recursive: true, force: true }));

  const reportPath = path.join(outputDir, "home.report.json");
  writeFileSync(reportPath, JSON.stringify({
    categories: { performance: { score: 0.95 } },
    audits: {
      "largest-contentful-paint": { numericValue: 2500 },
      "lcp-phases-insight": {
        details: {
          type: "list",
          items: [
            {
              type: "table",
              items: [
                { phase: "timeToFirstByte", duration: 500 },
                { phase: "elementRenderDelay", duration: 1500 },
              ],
            },
            { type: "node", selector: "main .game-choice-card" },
          ],
        },
      },
    },
  }));
  writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify([{
    url: "http://127.0.0.1:3411/",
    isRepresentativeRun: true,
    jsonPath: reportPath,
  }]));

  assert.deepEqual(summarizeLighthouseProfile(outputDir, "mobile"), [{
    profile: "mobile",
    route: "/",
    performance: 95,
    lcpMs: 2500,
    renderDelayMs: 1500,
    renderDelayPercent: 60,
    unusedJsKb: 0,
    lcpElement: "main .game-choice-card",
    representative: true,
    runIndex: 1,
    runCount: 1,
  }]);
});

test("fails a weak non-representative run instead of hiding it behind the median", () => {
  assert.deepEqual(lighthouseTailFailures([
    {
      profile: "mobile",
      route: "/tutorial",
      performance: 69,
      lcpMs: 5_050,
      runIndex: 1,
      runCount: 3,
    },
    {
      profile: "mobile",
      route: "/tutorial",
      performance: 90,
      lcpMs: 3_000,
      runIndex: 2,
      runCount: 3,
    },
  ]), [
    "mobile /tutorial run 1/3 performance 69 < tail floor 70",
    "mobile /tutorial run 1/3 LCP 5050 ms exceeds tail floor 5000 ms",
  ]);
});
