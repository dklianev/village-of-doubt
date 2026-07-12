import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./bundle-budget.mjs", import.meta.url));
const routeEntry = "[project]/apps/web/app/play/[code]/page";

test("measures /play assets from the Next.js client reference manifest", (context) => {
  const fixture = createFixture({
    routeCss: ["static/chunks/play.css", "static/chunks/play.css"],
    routeJs: ["static/chunks/play.js", "static/chunks/play.js"],
  });
  context.after(() => rmSync(fixture, { recursive: true, force: true }));

  writeFixtureFile(fixture, "apps/web/.next/static/chunks/play.css", ".play { color: #fff; }");
  writeFixtureFile(fixture, "apps/web/.next/static/chunks/play.js", "console.log('play');");
  writeFixtureFile(fixture, "apps/web/.next/static/chunks/unrelated.css", randomBytes(90 * 1024));
  writeFixtureFile(fixture, "apps/web/.next/static/chunks/unrelated.js", "console.log('other');");
  writeFixtureFile(fixture, "apps/web/public/game-art/source.png", randomBytes(2048));
  writeFixtureFile(fixture, "apps/web/public/game-art/portrait.webp", randomBytes(1024));

  const result = runBudget(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /JavaScript corpus gzip: .+ \(2 files; budget: 550 KB\)/);
  assert.match(result.stdout, /CSS corpus gzip: .+ \(2 files\)/);
  assert.match(result.stdout, /Route \/play\/\[code\] JS gzip: .+ \(1 file; budget: 140 KB\)/);
  assert.match(result.stdout, /Route \/play\/\[code\] CSS gzip: .+ \(1 file; budget: 70 KB\)/);
  assert.match(result.stdout, /Art corpus: 2 files,/);
  assert.match(result.stdout, /Largest optimized art: portrait\.webp/);
});

test("fails when /play declares no CSS even if the CSS corpus is non-empty", (context) => {
  const fixture = createFixture({ routeCss: [], routeJs: ["static/chunks/play.js"] });
  context.after(() => rmSync(fixture, { recursive: true, force: true }));

  writeFixtureFile(fixture, "apps/web/.next/static/chunks/play.js", "console.log('play');");
  writeFixtureFile(fixture, "apps/web/.next/static/chunks/unrelated.css", ".other { color: #000; }");

  const result = runBudget(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /No CSS assets declared for route \/play\/\[code\]\./);
});

test("fails when /play CSS resolves to zero source bytes", (context) => {
  const fixture = createFixture({
    routeCss: ["static/chunks/empty.css"],
    routeJs: ["static/chunks/play.js"],
  });
  context.after(() => rmSync(fixture, { recursive: true, force: true }));

  writeFixtureFile(fixture, "apps/web/.next/static/chunks/empty.css", "");
  writeFixtureFile(fixture, "apps/web/.next/static/chunks/play.js", "console.log('play');");

  const result = runBudget(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Route \/play\/\[code\] CSS source bytes are zero\./);
});

function createFixture({ routeCss, routeJs }) {
  const fixture = mkdtempSync(path.join(os.tmpdir(), "bundle-budget-"));
  const nextDir = path.join(fixture, "apps/web/.next");
  mkdirSync(path.join(nextDir, "server/app/play/[code]"), { recursive: true });
  mkdirSync(path.join(nextDir, "static/chunks"), { recursive: true });

  writeFixtureFile(
    fixture,
    "apps/web/.next/app-path-routes-manifest.json",
    JSON.stringify({ "/play/[code]/page": "/play/[code]" }),
  );

  const clientManifest = {
    entryCSSFiles: {
      [routeEntry]: routeCss.map((assetPath) => ({ path: assetPath, inlined: false })),
    },
    entryJSFiles: {
      [routeEntry]: routeJs,
    },
  };
  writeFixtureFile(
    fixture,
    "apps/web/.next/server/app/play/[code]/page_client-reference-manifest.js",
    `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\n` +
      `globalThis.__RSC_MANIFEST["/play/[code]/page"] = ${JSON.stringify(clientManifest)};\n`,
  );

  return fixture;
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
