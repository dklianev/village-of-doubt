import { readFileSync } from "node:fs";
import { join } from "node:path";

export function summarizeLighthouseProfile(outputDir, profile) {
  const manifest = JSON.parse(readFileSync(join(outputDir, "manifest.json"), "utf8"));
  const summaries = manifest.map((entry) => ({
    ...summarizeReport(entry, profile),
    representative: Boolean(entry.isRepresentativeRun),
  }));
  const runCounts = new Map();
  const seenRuns = new Map();

  for (const summary of summaries) {
    runCounts.set(summary.route, (runCounts.get(summary.route) ?? 0) + 1);
  }

  return summaries.map((summary) => {
    const runIndex = (seenRuns.get(summary.route) ?? 0) + 1;
    seenRuns.set(summary.route, runIndex);
    return { ...summary, runIndex, runCount: runCounts.get(summary.route) ?? 1 };
  });
}

export function formatLighthouseSummary(summary) {
  const runLabel = `run ${summary.runIndex}/${summary.runCount}`
    + (summary.representative ? " (representative)" : "");
  return `Lighthouse ${summary.profile} ${summary.route} ${runLabel}: score ${summary.performance}, `
    + `LCP ${summary.lcpMs} ms, render delay ${summary.renderDelayPercent}% `
    + `(${summary.renderDelayMs} ms), unused JS ${summary.unusedJsKb} KB, `
    + `LCP ${summary.lcpElement}`;
}

export function lighthouseTailFailures(summaries) {
  return summaries.flatMap((summary) => {
    const floor = summary.profile === "desktop"
      ? { performance: 80, lcpMs: 4_000 }
      : { performance: 70, lcpMs: 5_000 };
    const failures = [];
    if (summary.performance < floor.performance) {
      failures.push(
        `${summary.profile} ${summary.route} run ${summary.runIndex}/${summary.runCount} `
          + `performance ${summary.performance} < tail floor ${floor.performance}`,
      );
    }
    if (summary.lcpMs <= 0 || summary.lcpMs > floor.lcpMs) {
      failures.push(
        `${summary.profile} ${summary.route} run ${summary.runIndex}/${summary.runCount} `
          + `LCP ${summary.lcpMs} ms exceeds tail floor ${floor.lcpMs} ms`,
      );
    }
    return failures;
  });
}

function summarizeReport(entry, profile) {
  const report = JSON.parse(readFileSync(entry.jsonPath, "utf8"));
  const lcpMs = Math.round(report.audits?.["largest-contentful-paint"]?.numericValue ?? 0);
  const { durationMs, percent } = readRenderDelay(report.audits, lcpMs);
  const finalUrl = report.finalUrl ?? entry.url;
  const url = new URL(finalUrl);

  return {
    profile,
    route: `${url.pathname}${url.search}`,
    performance: Math.round((report.categories?.performance?.score ?? 0) * 100),
    lcpMs,
    renderDelayMs: durationMs,
    renderDelayPercent: percent,
    unusedJsKb: Math.round(
      (report.audits?.["unused-javascript"]?.details?.overallSavingsBytes ?? 0) / 1024,
    ),
    lcpElement: readLcpElement(report.audits) ?? "неизвестен елемент",
  };
}

function readRenderDelay(audits, lcpMs) {
  const legacyItems = listItems(audits?.["largest-contentful-paint-element"]?.details);
  const legacyPhase = legacyItems
    .flatMap((item) => Array.isArray(item?.items) ? item.items : [])
    .find((item) => item?.phase === "Render Delay");

  if (legacyPhase) {
    const durationMs = Math.round(legacyPhase.timing ?? 0);
    return {
      durationMs,
      percent: readPercent(legacyPhase.percent, durationMs, lcpMs),
    };
  }

  const insightItems = listItems(audits?.["lcp-phases-insight"]?.details);
  const insightPhase = insightItems
    .flatMap((item) => Array.isArray(item?.items) ? item.items : [])
    .find((item) => item?.phase === "elementRenderDelay");
  const durationMs = Math.round(insightPhase?.duration ?? 0);

  return {
    durationMs,
    percent: readPercent(undefined, durationMs, lcpMs),
  };
}

function readPercent(value, durationMs, lcpMs) {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  if (Number.isFinite(parsed)) return Math.round(parsed);
  return lcpMs > 0 ? Math.round((durationMs / lcpMs) * 100) : 0;
}

function readLcpElement(audits) {
  for (const auditName of ["largest-contentful-paint-element", "lcp-phases-insight"]) {
    for (const item of listItems(audits?.[auditName]?.details)) {
      const directSelector = item?.selector ?? item?.node?.selector;
      if (directSelector) return directSelector;

      for (const nestedItem of Array.isArray(item?.items) ? item.items : []) {
        const selector = nestedItem?.selector ?? nestedItem?.node?.selector;
        if (selector) return selector;
      }
    }
  }
  return undefined;
}

function listItems(details) {
  return Array.isArray(details?.items) ? details.items : [];
}
