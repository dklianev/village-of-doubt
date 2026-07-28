import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./bundle-budget.mjs", import.meta.url));
const ROUTES = {
  "/": {
    appPath: "/page",
    entry: "[project]/apps/web/app/page",
    manifest: "apps/web/.next/server/app/page_client-reference-manifest.js",
  },
  "/create": {
    appPath: "/create/page",
    entry: "[project]/apps/web/app/create/page",
    manifest: "apps/web/.next/server/app/create/page_client-reference-manifest.js",
  },
  "/play/[code]": {
    appPath: "/play/[code]/page",
    entry: "[project]/apps/web/app/play/[code]/page",
    manifest: "apps/web/.next/server/app/play/[code]/page_client-reference-manifest.js",
  },
};

test("measures the landing, create, and play routes from Next.js manifests", (context) => {
  const fixture = createFixture();
  context.after(() => rmSync(fixture, { recursive: true, force: true }));

  const result = runBudget(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /JavaScript corpus gzip: .+warning: 515 KB; hard: 525 KB/);
  assert.match(result.stdout, /Route \/ JS gzip: .+warning: 48 KB; hard: 55 KB/);
  assert.match(result.stdout, /Route \/create JS gzip: .+warning: 85 KB; hard: 95 KB/);
  assert.match(result.stdout, /Route \/play\/\[code\] JS gzip: .+warning: 135 KB; hard: 140 KB/);
  assert.match(result.stdout, /Art corpus: 2 files,/);
  assert.match(result.stdout, /Largest optimized art: portrait\.webp/);
  assert.match(result.stdout, /All budgets within thresholds/);
});

test("emits a warning without failing below the hard JavaScript cap", (context) => {
  const fixture = createFixture();
  context.after(() => rmSync(fixture, { recursive: true, force: true }));

  writeFixtureFile(fixture, "apps/web/.next/static/chunks/warning.js", randomBytes(518 * 1024));
  setBaseline(fixture, { totalJsKb: 518 });

  const result = runBudget(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Budget warnings:/);
  assert.match(result.stderr, /JavaScript corpus gzip .+ > warning 515 KB/);
});

test("fails when the JavaScript delta exceeds the checked-in baseline allowance", (context) => {
  const fixture = createFixture();
  context.after(() => rmSync(fixture, { recursive: true, force: true }));

  writeFixtureFile(fixture, "apps/web/.next/static/chunks/delta.js", randomBytes(16 * 1024));
  setBaseline(fixture, { totalJsKb: 1 });

  const result = runBudget(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /JavaScript corpus grew .+ KB above baseline 1 KB; allowed delta: 5 KB/);
});

test("fails when a protected route declares no CSS", (context) => {
  const fixture = createFixture({
    overrides: {
      "/create": { css: [] },
    },
  });
  context.after(() => rmSync(fixture, { recursive: true, force: true }));

  const result = runBudget(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /No CSS assets declared for route \/create\./);
});

test("fails when a protected route CSS asset has zero source bytes", (context) => {
  const fixture = createFixture({
    overrides: {
      "/play/[code]": { css: ["static/chunks/empty.css"] },
    },
  });
  context.after(() => rmSync(fixture, { recursive: true, force: true }));
  writeFixtureFile(fixture, "apps/web/.next/static/chunks/empty.css", "");

  const result = runBudget(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Route \/play\/\[code\] CSS source bytes are zero\./);
});

test("fails when the runtime art corpus exceeds its hard release budget", (context) => {
  const fixture = createFixture();
  context.after(() => rmSync(fixture, { recursive: true, force: true }));

  const oversizedArt = path.join(fixture, "apps/web/public/game-art/oversized.png");
  mkdirSync(path.dirname(oversizedArt), { recursive: true });
  writeFileSync(oversizedArt, "");
  truncateSync(oversizedArt, 60_001 * 1024);

  const result = runBudget(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Art corpus .+ KB > hard budget 60000 KB/);
});

function createFixture({ overrides = {} } = {}) {
  const fixture = mkdtempSync(path.join(os.tmpdir(), "bundle-budget-"));
  const routeMap = {};
  const baselineRoutes = {};

  for (const [route, config] of Object.entries(ROUTES)) {
    const slug = route === "/" ? "landing" : route.replaceAll("/", "-").replaceAll("[", "").replaceAll("]", "").slice(1);
    const css = overrides[route]?.css ?? [`static/chunks/${slug}.css`];
    const js = overrides[route]?.js ?? [`static/chunks/${slug}.js`];
    routeMap[config.appPath] = route;
    baselineRoutes[route] = { jsKb: 1, cssKb: 1 };

    for (const asset of css) {
      if (!asset.endsWith("empty.css")) {
        writeFixtureFile(fixture, `apps/web/.next/${asset}`, `.${slug} { color: #fff; }`);
      }
    }
    for (const asset of js) {
      writeFixtureFile(fixture, `apps/web/.next/${asset}`, `console.log(${JSON.stringify(slug)});`);
    }

    const clientManifest = {
      entryCSSFiles: {
        [config.entry]: css.map((assetPath) => ({ path: assetPath, inlined: false })),
      },
      entryJSFiles: {
        [config.entry]: js,
      },
    };
    writeFixtureFile(
      fixture,
      config.manifest,
      `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\n` +
        `globalThis.__RSC_MANIFEST[${JSON.stringify(config.appPath)}] = ${JSON.stringify(clientManifest)};\n`,
    );
  }

  writeFixtureFile(
    fixture,
    "apps/web/.next/app-path-routes-manifest.json",
    JSON.stringify(routeMap),
  );
  writeFixtureFile(fixture, "apps/web/public/game-art/source.png", randomBytes(2048));
  writeFixtureFile(fixture, "apps/web/public/game-art/portrait.webp", randomBytes(1024));
  writeFixtureFile(
    fixture,
    "scripts/perf-baseline.json",
    JSON.stringify({ schemaVersion: 1, totalJsKb: 1, routes: baselineRoutes }),
  );

  return fixture;
}

function setBaseline(fixture, overrides) {
  const baselinePath = path.join(fixture, "scripts/perf-baseline.json");
  const baseline = {
    schemaVersion: 1,
    totalJsKb: overrides.totalJsKb ?? 1,
    routes: Object.fromEntries(
      Object.keys(ROUTES).map((route) => [
        route,
        {
          jsKb: overrides.routes?.[route]?.jsKb ?? 1,
          cssKb: overrides.routes?.[route]?.cssKb ?? 1,
        },
      ]),
    ),
  };
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
}

function writeFixtureFile(root, relativePath, content) {
  const filePath = path.join(root, ...relativePath.split("/"));
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function runBudget(cwd) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
}
