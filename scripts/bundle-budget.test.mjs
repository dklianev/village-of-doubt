import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
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
  "/tutorial": {
    appPath: "/tutorial/page",
    entry: "[project]/apps/web/app/tutorial/page",
    manifest: "apps/web/.next/server/app/tutorial/page_client-reference-manifest.js",
  },
  "/werewolf/rules": {
    appPath: "/werewolf/rules/page",
    entry: "[project]/apps/web/app/werewolf/rules/page",
    manifest: "apps/web/.next/server/app/werewolf/rules/page_client-reference-manifest.js",
  },
};

test("measures all protected experience routes from Next.js manifests", (context) => {
  const fixture = createFixture();
  context.after(() => rmSync(fixture, { recursive: true, force: true }));

  const result = runBudget(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /JavaScript corpus gzip: .+warning: 560 KB; hard: 570 KB/);
  assert.match(result.stdout, /Route \/ declared client JS gzip: .+warning: 48 KB; hard: 55 KB/);
  assert.match(result.stdout, /Route \/create declared client JS gzip: .+warning: 85 KB; hard: 95 KB/);
  assert.match(result.stdout, /Route \/play\/\[code\] declared client JS gzip: .+warning: 135 KB; hard: 140 KB/);
  assert.match(result.stdout, /Route \/tutorial declared client JS gzip: .+warning: 24 KB; hard: 30 KB/);
  assert.match(result.stdout, /Route \/tutorial declared client CSS gzip: .+warning: 51 KB; hard: 56 KB/);
  assert.match(result.stdout, /Route \/werewolf\/rules declared client JS gzip: .+warning: 36 KB; hard: 42 KB/);
  assert.match(result.stdout, /Route \/werewolf\/rules declared client CSS gzip: .+warning: 52 KB; hard: 57 KB/);
  assert.match(result.stdout, /Art corpus: 2 files,/);
  assert.match(result.stdout, /Largest optimized art: portrait\.webp/);
  assert.match(result.stdout, /All budgets within thresholds/);
});

test("emits a warning without failing below the hard JavaScript cap", (context) => {
  const fixture = createFixture();
  context.after(() => rmSync(fixture, { recursive: true, force: true }));

  writeFixtureFile(fixture, "apps/web/.next/static/chunks/warning.js", randomBytes(563 * 1024));
  setBaseline(fixture, { totalJsKb: 566 });

  const result = runBudget(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Budget warnings:/);
  assert.match(result.stderr, /JavaScript corpus gzip .+ > warning 560 KB/);
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

test("reports byte-sized route overages instead of rounding them away", (context) => {
  const fixture = createFixture();
  context.after(() => rmSync(fixture, { recursive: true, force: true }));
  const payload = randomBytes(5 * 1024);
  writeFixtureFile(fixture, "apps/web/.next/static/chunks/play-code.js", payload);
  const atLimitBaseline = gzipSync(payload).length / 1024 - 3;
  setBaseline(fixture, { totalJsKb: 10, routes: { "/play/[code]": { jsKb: atLimitBaseline } } });
  const atLimit = runBudget(fixture);
  assert.equal(atLimit.status, 0, atLimit.stderr);

  setBaseline(fixture, { totalJsKb: 10, routes: { "/play/[code]": { jsKb: atLimitBaseline - 10 / 1024 } } });
  const overLimit = runBudget(fixture);
  assert.equal(overLimit.status, 1);
  assert.match(overLimit.stderr, /Route \/play\/\[code\] declared client JS grew .+allowed delta: 3 KB; over by 10 bytes/);
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
  truncateSync(oversizedArt, 75_001 * 1024);

  const result = runBudget(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Art corpus .+ KB > hard budget 75000 KB/);
});

test("guards metadata PNG previews separately without relaxing interface image limits", (context) => {
  const fixture = createFixture();
  context.after(() => rmSync(fixture, { recursive: true, force: true }));
  const preview = path.join(fixture, "apps/web/public/game-art/og/og-home.png");
  mkdirSync(path.dirname(preview), { recursive: true });
  writeFileSync(preview, "");
  truncateSync(preview, 461 * 1024);
  const allowed = runBudget(fixture);
  assert.equal(allowed.status, 0, allowed.stderr);
  assert.match(allowed.stderr, /Metadata PNG preview .+ > warning 450 KB/);
  truncateSync(preview, 501 * 1024);
  const oversized = runBudget(fixture);
  assert.equal(oversized.status, 1);
  assert.match(oversized.stderr, /Metadata PNG preview .+ > hard budget 500 KB/);
  truncateSync(preview, 400 * 1024);
  const interfaceArt = path.join(fixture, "apps/web/public/game-art/portrait.webp");
  truncateSync(interfaceArt, 401 * 1024);
  const interfaceResult = runBudget(fixture);
  assert.equal(interfaceResult.status, 1);
  assert.match(interfaceResult.stderr, /Largest optimized art .+ > hard budget 400 KB/);
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
