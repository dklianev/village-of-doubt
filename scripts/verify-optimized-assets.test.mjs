import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

test("paired dimension verification rejects reproducible but stale AVIFs", async (t) => {
  const { verifyOptimizedAssets } = await import("./verify-optimized-assets.mjs");
  const root = await temporaryRoot(t);
  await writeRuntimeImage(root, "play/table-inlay-mafia-v1.avif", 64, 32);
  await writeRuntimeImage(root, "play/table-inlay-mafia-v1.webp", 80, 40);
  await assert.rejects(verifyOptimizedAssets({ rootDirectory: root, runGenerators: () => {} }), /play\/table-inlay-mafia-v1.*AVIF 64x32.*WebP 80x40/s);
});

test("paired dimension checks use full relative stems, not basenames, prefixes or source files", async (t) => {
  const { verifyOptimizedAssets } = await import("./verify-optimized-assets.mjs");
  const root = await temporaryRoot(t);
  for (const [stem, width, height] of [["play/scene", 80, 40], ["mobile/play/scene", 32, 64], ["play/scene-v2", 96, 48]]) {
    for (const format of ["avif", "webp"]) await writeRuntimeImage(root, `${stem}.${format}`, width, height);
  }
  await writeRuntimeImage(root, "other/scene.avif", 20, 40);
  await writeRuntimeImage(root, "thumbs/scene.webp", 8, 4);
  await writeRuntimeImage(root, "play/scene.avif.tmp-123.avif", 12, 8);
  await writeFile(path.join(root, "assets/game-art-source/scene.webp"), "not a runtime pair");
  assert.deepEqual(await verifyOptimizedAssets({ rootDirectory: root, runGenerators: () => {} }), { restoredAvifs: [] });
});

test("paired dimension check CLI is read-only and reports every mismatch without running generators", async (t) => {
  const root = await temporaryRoot(t);
  await writeFile(path.join(root, "assets/game-art-source/broken.png"), "must not be processed");
  const originals = new Map();
  for (const stem of ["play/table-inlay-mafia-v1", "mobile/play/table-inlay-mafia-v1"]) {
    originals.set(`${stem}.avif`, await writeRuntimeImage(root, `${stem}.avif`, 64, 32));
    originals.set(`${stem}.webp`, await writeRuntimeImage(root, `${stem}.webp`, 80, 40));
  }
  const run = () => spawnSync(process.execPath, [fileURLToPath(new URL("./verify-optimized-assets.mjs", import.meta.url)), "--check-pairs"], {
    cwd: root, encoding: "utf8", windowsHide: true, timeout: 30_000,
  });
  const result = run();
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /play\/table-inlay-mafia-v1: AVIF 64x32, WebP 80x40/);
  assert.match(result.stderr, /mobile\/play\/table-inlay-mafia-v1: AVIF 64x32, WebP 80x40/);
  for (const [file, original] of originals) assert.deepEqual(await readFile(path.join(root, "apps/web/public/game-art", file)), original);
  for (const stem of ["play/table-inlay-mafia-v1", "mobile/play/table-inlay-mafia-v1"]) await writeRuntimeImage(root, `${stem}.avif`, 80, 40);
  const fixed = run();
  assert.ifError(fixed.error);
  assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);
  assert.match(fixed.stdout, /2.*pairs/);
});

async function writeRuntimeImage(root, file, width, height) {
  const output = path.join(root, "apps/web/public/game-art", file);
  await mkdir(path.dirname(output), { recursive: true });
  await sharp({ create: { width, height, channels: 3, background: "#7298ab" } }).toFile(output);
  return readFile(output);
}

test("verification can be imported without running generators or writing assets", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e",
    `import { verifyOptimizedAssets } from ${JSON.stringify(new URL("./verify-optimized-assets.mjs", import.meta.url).href)}; console.log(typeof verifyOptimizedAssets);`,
  ], { cwd: tmpdir(), encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout.trim(), "function");
});

test("source byte changes cannot use the runtime AVIF pixel-equivalence exception", async () => {
  const { changedPaths } = await import("./verify-optimized-assets.mjs");
  const source = "assets/game-art-source/original.avif";
  const output = "apps/web/public/game-art/original.avif";
  const before = new Map([source, output].map((file) => [file, { bytes: "before", pixels: "same" }]));
  const after = new Map([source, output].map((file) => [file, { bytes: "after", pixels: "same" }]));
  assert.deepEqual(changedPaths(before, after), [source]);
});

test("verification fails on source mutation, including source temporary files and generator failure", async (t) => {
  const { verifyOptimizedAssets } = await import("./verify-optimized-assets.mjs");
  const root = await temporaryRoot(t);
  const source = path.join(root, "assets/game-art-source/original.tmp-123.png");
  await writeFile(source, "master bytes");
  await assert.rejects(verifyOptimizedAssets({
    rootDirectory: root,
    runGenerators: async () => {
      await writeFile(source, "changed bytes");
      throw new Error("generator failed");
    },
  }), /mutated immutable source masters.*original\.tmp-123\.png/s);
  assert.equal(await readFile(source, "utf8"), "changed bytes", "verifier must not silently rewrite source files");
});

test("verification accepts unchanged large masters and catches additions, removals and runtime drift", async (t) => {
  const { verifyOptimizedAssets } = await import("./verify-optimized-assets.mjs");
  const root = await temporaryRoot(t);
  const source = path.join(root, "assets/game-art-source/role.png");
  const original = Buffer.alloc(1024 * 1024, 7);
  await writeFile(source, original);
  assert.deepEqual(await verifyOptimizedAssets({ rootDirectory: root, runGenerators: () => {} }), { restoredAvifs: [] });
  await assert.rejects(verifyOptimizedAssets({ rootDirectory: root, runGenerators: () => rm(source) }), /mutated immutable source masters/);
  await assert.rejects(verifyOptimizedAssets({ rootDirectory: root, runGenerators: () => writeFile(source, original) }), /mutated immutable source masters/);
  await assert.rejects(verifyOptimizedAssets({
    rootDirectory: root,
    runGenerators: () => writeFile(path.join(root, "apps/web/public/game-art/role.webp"), "new output"),
  }), /not reproducible/);
  assert.ok((await readFile(source)).equals(original));
});

test("platform AVIF restoration writes only runtime outputs, never source masters", async (t) => {
  const { restorePlatformAvifEncodings } = await import("./verify-optimized-assets.mjs");
  const root = await temporaryRoot(t);
  const source = "assets/game-art-source/hero.avif";
  const output = "apps/web/public/game-art/hero.avif";
  const before = new Map([source, output].map((file) => [file, { bytes: "before", pixels: "same", encoded: Buffer.from("old") }]));
  const after = new Map([source, output].map((file) => [file, { bytes: "after", pixels: "same", encoded: Buffer.from("new") }]));
  for (const file of [source, output]) await writeFile(path.join(root, file), "new");
  assert.deepEqual(await restorePlatformAvifEncodings(before, after, root), [output]);
  assert.equal(await readFile(path.join(root, source), "utf8"), "new");
  assert.equal(await readFile(path.join(root, output), "utf8"), "old");
});

async function temporaryRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), "asset-verifier-"));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith("asset-verifier-"));
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, "assets/game-art-source"), { recursive: true });
  await mkdir(path.join(root, "apps/web/public/game-art"), { recursive: true });
  return root;
}
