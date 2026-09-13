import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { avifBudgetKbFor, maxWidthFor, webpBudgetKbFor } from "./optimize-assets.mjs";

sharp.cache(false);

test("targeted critical mobile CLI regenerates both landing formats without visiting other sources", async (t) => {
  const root = await temporaryRoot(t);
  const source = path.join(root, "assets/game-art-source/mobile/bg-landing-hero-composited.png");
  const outputRoot = path.join(root, "apps/web/public/game-art/mobile");
  await mkdir(path.dirname(source), { recursive: true });
  await mkdir(outputRoot, { recursive: true });
  const original = await sharp({ create: { width: 100, height: 180, channels: 3, background: "#7298ab" } }).png().toBuffer();
  await writeFile(source, original);
  await writeFile(path.join(outputRoot, "sentinel.tmp-123.avif"), "untouched");
  const result = runCriticalCli(root, ["--only", "mobile/bg-landing-hero-composited.png"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(await readFile(source), original);
  const dimensions = [];
  for (const format of ["webp", "avif"]) {
    const metadata = await sharp(path.join(outputRoot, `bg-landing-hero-composited.${format}`)).metadata();
    dimensions.push([metadata.width, metadata.height]);
  }
  assert.deepEqual(dimensions[0], dimensions[1]);
  assert.equal(await readFile(path.join(outputRoot, "sentinel.tmp-123.avif"), "utf8"), "untouched");
  for (const args of [["--only="], ["--only"], ["--only", "unknown.png"], ["--onyl", "mobile/bg-landing-hero-composited.png"]]) {
    const rejected = runCriticalCli(root, args);
    assert.notEqual(rejected.status, 0);
    assert.doesNotMatch(rejected.stderr, /Input file is missing/, "bad selections fail before attempting unrelated sources");
  }
});

test("critical mobile derivatives apply source orientation before resizing like the optimizer", async (t) => {
  const { generateCriticalMobileAssets } = await import("./generate-critical-mobile-assets.mjs");
  const root = await temporaryRoot(t);
  const source = "assets/game-art-source/oriented.png";
  const output = "apps/web/public/game-art/mobile/oriented.avif";
  await mkdir(path.dirname(path.join(root, source)), { recursive: true });
  await sharp({ create: { width: 200, height: 100, channels: 3, background: "#7298ab" } }).withMetadata({ orientation: 6 }).png().toFile(path.join(root, source));
  await generateCriticalMobileAssets({ rootDirectory: root, assets: [{ source, output, width: 80 }] });
  const metadata = await sharp(path.join(root, output)).metadata();
  assert.deepEqual([metadata.width, metadata.height], [80, 160]);
});

function runCriticalCli(root, args) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./generate-critical-mobile-assets.mjs", import.meta.url)), ...args], {
    cwd: root, encoding: "utf8", windowsHide: true, timeout: 30_000,
  });
  assert.ifError(result.error);
  return result;
}

test("critical mobile CLI preserves masters and produces crisp, bounded, reproducible derivatives", async (t) => {
  const root = await temporaryRoot(t);
  const sources = [
    "mobile/bg-landing-hero-composited.png", "logo-landing-mark.png", "bg-lobby-tavern.png",
    "mafia/bg-lobby-tavern.png", "werewolf/bg-hero-v2.png", "mafia/bg-hero-v2.png",
  ];
  const originals = new Map();
  for (const source of sources) {
    const originalPath = new URL(`../assets/game-art-source/${source}`, import.meta.url);
    const staged = path.join(root, "assets/game-art-source", source);
    originals.set(staged, await readFile(originalPath));
    await mkdir(path.dirname(staged), { recursive: true });
    await copyFile(originalPath, staged);
  }
  const outputs = new Map();
  for (const pass of [1, 2]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./generate-critical-mobile-assets.mjs", import.meta.url))], {
      cwd: root, encoding: "utf8", windowsHide: true, timeout: 120_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const [source, original] of originals) {
      assert.ok((await readFile(source)).equals(original), `pass ${pass}: ${source} unchanged`);
    }
    for (const [file, width, height, budget] of [
      ["bg-landing-hero-composited.avif", 760, 820, 96],
      ["bg-landing-hero-composited.webp", 760, 820, 160],
      ["logo-landing-mark.webp", 256, 256, 12],
      ["bg-lobby-tavern.avif", 960, 540, 120],
      ["mafia/bg-lobby-tavern.avif", 960, 540, 120],
      ["werewolf/bg-hero-v2.avif", 960, null, 120],
      ["mafia/bg-hero-v2.avif", 960, null, 120],
    ]) {
      const encoded = await readFile(path.join(root, "apps/web/public/game-art/mobile", file));
      const metadata = await sharp(encoded).metadata();
      assert.equal(metadata.width, width, file);
      if (height) assert.equal(metadata.height, height, file);
      assert.ok(encoded.length <= budget * 1024, `${file}: runtime budget`);
      if (pass === 1) {
        outputs.set(file, encoded);
        t.diagnostic(`${file}: ${metadata.width}x${metadata.height}, ${encoded.length} bytes`);
      } else {
        assert.ok(encoded.equals(outputs.get(file)), `${file}: deterministic encoding`);
      }
    }
  }
  const original = originals.get(path.join(root, "assets/game-art-source/mobile/bg-landing-hero-composited.png"));
  for (const format of ["webp", "avif"]) {
    const pipeline = sharp(original).resize({ width: 760, height: 820, fit: "cover", position: "top", withoutEnlargement: true });
    const expected = format === "webp"
      ? await pipeline.webp({ quality: 78, effort: 6, smartSubsample: true }).toBuffer()
      : await pipeline.avif({ quality: 55, effort: 7, chromaSubsampling: "4:2:0" }).toBuffer();
    assert.ok(outputs.get(`bg-landing-hero-composited.${format}`).equals(expected), `${format}: expected quality and crop`);
  }
});

test("dedicated family heroes retain full native portraits in both runtime formats", async (t) => {
  const root = await temporaryRoot(t);
  const originals = new Map();
  for (const file of ["mobile/werewolf/bg-hero-v3.png", "mobile/werewolf/bg-hero-light-v1.png", "mobile/mafia/bg-hero-light-v1.png"]) {
    const original = await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url));
    originals.set(file, original);
    const source = path.join(root, "assets/game-art-source", file);
    await mkdir(path.dirname(source), { recursive: true });
    await writeFile(source, original);
  }
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./optimize-assets.mjs", import.meta.url))], {
    cwd: root, encoding: "utf8", windowsHide: true, timeout: 120_000,
    env: { ...process.env, WEBP_QUALITY: "82", ASSET_FILE_CONCURRENCY: "1" },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const [file, original] of originals) {
    const source = await sharp(original).metadata();
    assert.ok(source.height > source.width);
    assert.ok(source.width > 520, `${file}: restored portrait has high-density source detail`);
    const width = Math.min(source.width, maxWidthFor(file));
    const height = Math.round(source.height * width / source.width);
    for (const format of ["webp", "avif"]) {
      const encoded = await readFile(path.join(root, "apps/web/public/game-art", file.replace(/\.png$/, `.${format}`)));
      const metadata = await sharp(encoded).metadata();
      assert.deepEqual([metadata.width, metadata.height], [width, height], `${file}: ${format} retains the portrait crop`);
      assert.ok(encoded.length <= (format === "webp" ? webpBudgetKbFor(file) : avifBudgetKbFor(file)) * 1024);
    }
    assert.ok((await readFile(path.join(root, "assets/game-art-source", file))).equals(original));
  }
});

test("critical mobile failure preserves the previous output and small sources are never enlarged", async (t) => {
  const { generateCriticalMobileAssets } = await import("./generate-critical-mobile-assets.mjs");
  const root = await temporaryRoot(t);
  const source = "assets/game-art-source/small.png";
  const output = "apps/web/public/game-art/small.webp";
  await mkdir(path.dirname(path.join(root, source)), { recursive: true });
  await mkdir(path.dirname(path.join(root, output)), { recursive: true });
  const original = await sharp({ create: { width: 64, height: 96, channels: 3, background: "#7298ab" } }).png().toBuffer();
  await writeFile(path.join(root, source), original);
  await writeFile(path.join(root, output), "previous output");
  const variant = { source, output, width: 760, height: 820, position: "top", format: "webp", maxBytes: 1 };
  await assert.rejects(generateCriticalMobileAssets({ rootDirectory: root, assets: [variant] }), /budget/);
  assert.equal(await readFile(path.join(root, output), "utf8"), "previous output");
  assert.deepEqual(await readdir(path.dirname(path.join(root, output))), ["small.webp"]);
  await generateCriticalMobileAssets({ rootDirectory: root, assets: [{ ...variant, maxBytes: 120 * 1024 }] });
  const metadata = await sharp(await readFile(path.join(root, output))).metadata();
  assert.ok(metadata.width <= 64 && metadata.height <= 96);
  await assert.rejects(generateCriticalMobileAssets({ rootDirectory: root, assets: [{ ...variant, output: source }] }), /source master/);
  assert.ok((await readFile(path.join(root, source))).equals(original));
});

async function temporaryRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), "critical-mobile-"));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith("critical-mobile-"));
    await rm(root, { recursive: true, force: true });
  });
  return root;
}
