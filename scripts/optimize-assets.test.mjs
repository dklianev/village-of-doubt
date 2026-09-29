import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import * as optimizer from "./optimize-assets.mjs";
import { variants as criticalMobileVariants } from "./generate-critical-mobile-assets.mjs";

sharp.cache(false);

import {
  avifBudgetKbFor,
  inspectMobileDerivativeConflicts,
  maxWidthFor,
  mobileBudgetKbFor,
  mobileWidthFor,
  mobileDerivativePathFor,
  webpBudgetKbFor,
} from "./optimize-assets.mjs";

const endgameScenes = ["village", "town", "werewolves", "mafia", "vampires", "maniac", "lovers", "draw"];

test("endgame policy selects only eight native Q75 WebP scenes without additional formats", () => {
  for (const key of endgameScenes) {
    const file = `endgame/${key}-v1.png`;
    for (const input of [file, path.join(...file.split("/"))]) {
      assert.equal(optimizer.isEndgameScene(input), true, input);
      assert.equal(optimizer.shouldCreateAvif(input), false, input);
      assert.equal(maxWidthFor(input), 1920, input);
      assert.equal(webpBudgetKbFor(input), 230, input);
      assert.equal(mobileWidthFor(input), 0, input);
      assert.equal(mobileDerivativePathFor(input, new Set([file])), null, input);
      assert.equal(optimizer.shouldCreateRoleThumbnail(input), false, input);
      assert.equal(optimizer.publishedPngBudgetKbFor(input), 0, input);
      for (const preferredQuality of [34, 75, 82]) {
        assert.deepEqual(optimizer.webpQualityStepsFor(input, { preferredQuality }), [75], input);
      }
    }
  }
  for (const file of [
    "endgame/unknown-v1.png", "endgame/village-v2.png", "endgame/village-v10.png",
    "endgame/Village-v1.png", "endgame/village-v1-extra.png", "endgame/village-v1.png.bak",
    "village-v1.png", "other/village-v1.png", "endgame/nested/village-v1.png",
    "mobile/endgame/village-v1.png",
  ]) {
    assert.equal(optimizer.isEndgameScene(file), false, file);
    assert.equal(webpBudgetKbFor(file), 360, file);
    assert.deepEqual(optimizer.webpQualityStepsFor(file), [82, 78, 74, 70], file);
  }
  assert.equal(optimizer.isEndgameScene("endgame/jester-v1.png"), false);
  assert.equal(maxWidthFor("endgame/jester-v1.png"), 960);
  assert.equal(webpBudgetKbFor("endgame/jester-v1.png"), 130);
  assert.deepEqual(optimizer.webpQualityStepsFor("endgame/jester-v1.png"), [78]);
  assert.equal(optimizer.shouldCreateAvif("endgame/jester-v1.png"), false);
});

test("endgame scenes reproduce exact native WebPs, preserve masters and retire only their obsolete AVIFs", async (t) => {
  const root = await temporaryAssetRoot(t);
  const files = [...endgameScenes.map((key) => `endgame/${key}-v1.png`), "endgame/jester-v1.png"];
  const outputRoot = path.join(root, "apps/web/public/game-art");
  const output = path.join(outputRoot, "endgame");
  await mkdir(output, { recursive: true });
  const originals = new Map();
  const expectedOutputs = new Map();
  for (const file of files) {
    const source = path.join(root, "assets/game-art-source", file);
    await mkdir(path.dirname(source), { recursive: true });
    const original = await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url));
    originals.set(file, original);
    await writeFile(source, original);
    const scene = optimizer.isEndgameScene(file);
    const expected = await sharp(original).rotate()
      .resize({ width: scene ? 1920 : 960, fit: "inside", withoutEnlargement: true })
      .webp(scene ? { quality: 75, effort: 6 } : { quality: 78, effort: 6, smartSubsample: true }).toBuffer();
    expectedOutputs.set(file, expected);
    if (scene) await writeFile(path.join(outputRoot, file.replace(/\.png$/, ".avif")), "obsolete AVIF");
  }
  const sentinel = path.join(output, "unselected-v1.avif");
  await writeFile(sentinel, "unselected AVIF");
  for (const pass of [1, 2]) {
    const result = runTargetedOptimizer(root, files);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(await readdir(outputRoot), ["endgame"], "no mobile or thumbnail derivatives");
    assert.deepEqual((await readdir(output)).sort(), [
      "unselected-v1.avif", ...files.map((file) => path.basename(file).replace(/\.png$/, ".webp")),
    ].sort(), "only selected WebPs replace their AVIFs; no extra PNGs or temporary files");
    assert.equal(await readFile(sentinel, "utf8"), "unselected AVIF");
    for (const file of files) {
      const derivative = file.replace(/\.png$/, ".webp");
      const encoded = await readFile(path.join(outputRoot, derivative));
      assert.deepEqual(encoded, expectedOutputs.get(file), `pass ${pass}: exact fixed-quality recipe for ${file}`);
      assert.deepEqual(encoded, await readFile(new URL(`../apps/web/public/game-art/${derivative}`, import.meta.url)), derivative);
      const metadata = await sharp(encoded).metadata();
      const scene = optimizer.isEndgameScene(file);
      const dimensions = scene ? [file.includes("draw-") ? 1835 : 1836, file.includes("vampires-") ? 856 : 857] : [960, 600];
      assert.deepEqual([metadata.width, metadata.height, metadata.format, metadata.hasAlpha],
        [...dimensions, "webp", !scene], derivative);
      assert.ok(encoded.length > 10_000 && encoded.length <= webpBudgetKbFor(file) * 1024, derivative);
      const original = originals.get(file);
      assert.deepEqual(await readFile(path.join(root, "assets/game-art-source", file)), original, file);
      assert.deepEqual(await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url)), original, file);
      if (scene) {
        const sourceMetadata = await sharp(original).metadata();
        assert.deepEqual([metadata.width, metadata.height], [sourceMetadata.width, sourceMetadata.height], "native scene dimensions");
      } else {
        const stats = await sharp(encoded).stats();
        assert.equal(stats.channels[3].min, 0, "Jester retains transparent background");
        assert.equal(stats.channels[3].max, 255, "Jester retains opaque foreground");
      }
    }
  }
});

test("endgame export failure preserves its AVIF, previous WebP and master without lowering Q75", async (t) => {
  const root = await temporaryAssetRoot(t);
  const file = "endgame/village-v1.png";
  const source = path.join(root, "assets/game-art-source", file);
  const output = path.join(root, "apps/web/public/game-art/endgame");
  const pixels = Buffer.alloc(1836 * 857 * 3);
  let seed = 1;
  for (let index = 0; index < pixels.length; index += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels[index] = seed >>> 24;
  }
  const original = await sharp(pixels, { raw: { width: 1836, height: 857, channels: 3 } }).png().toBuffer();
  await mkdir(path.dirname(source), { recursive: true });
  await mkdir(output, { recursive: true });
  await writeFile(source, original);
  await writeFile(path.join(output, "village-v1.webp"), "previous WebP");
  await writeFile(path.join(output, "village-v1.avif"), "previous AVIF");
  const result = runTargetedOptimizer(root, [file]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /budget 230 KiB cannot be met at quality floor 75 without reducing dimensions/);
  assert.deepEqual(await readFile(source), original);
  assert.equal(await readFile(path.join(output, "village-v1.webp"), "utf8"), "previous WebP");
  assert.equal(await readFile(path.join(output, "village-v1.avif"), "utf8"), "previous AVIF");
  assert.deepEqual((await readdir(output)).sort(), ["village-v1.avif", "village-v1.webp"]);
});

test("chronometer keeps a transparent, bounded WebP without extra runtime formats", async (t) => {
  const file = "play/chronometer-brass-v1.png";
  for (const input of [file, path.join(...file.split("/"))]) {
    assert.equal(maxWidthFor(input), 448);
    assert.equal(webpBudgetKbFor(input), 36);
    assert.deepEqual(optimizer.webpQualityStepsFor(input), [82, 78, 74, 70]);
    assert.equal(optimizer.shouldCreateAvif(input), false);
    assert.equal(optimizer.shouldCreateRoleThumbnail(input), false);
    assert.equal(optimizer.publishedPngBudgetKbFor(input), 0);
    assert.equal(mobileWidthFor(input), 0);
  }
  for (const other of ["play/chronometer-brass-v2.png", "other/chronometer-brass-v1.png", "mobile/play/chronometer-brass-v1.png"]) {
    assert.equal(maxWidthFor(other), 1920);
    assert.equal(optimizer.shouldCreateAvif(other), false);
  }
  const root = await temporaryAssetRoot(t);
  const source = path.join(root, "assets/game-art-source", file);
  const output = path.join(root, "apps/web/public/game-art/play");
  await mkdir(path.dirname(source), { recursive: true });
  const original = await readFile(new URL("../assets/game-art-source/play/chronometer-brass-v1.png", import.meta.url));
  const expected = await sharp(original).resize(448).webp({ quality: 82, effort: 6, smartSubsample: true }).toBuffer();
  await writeFile(source, original);
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "chronometer-brass-v1.avif"), "obsolete candidate");
  let first;
  for (const pass of [1, 2]) {
    const result = runTargetedOptimizer(root, [file]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(await readdir(output), ["chronometer-brass-v1.webp"]);
    const encoded = await readFile(path.join(output, "chronometer-brass-v1.webp"));
    assert.deepEqual(encoded, expected, "the real plate must fit at Q82 without shrinking or lowering quality");
    assert.deepEqual(encoded, await readFile(new URL("../apps/web/public/game-art/play/chronometer-brass-v1.webp", import.meta.url)));
    assert.ok(encoded.length <= 36 * 1024);
    const metadata = await sharp(encoded).metadata();
    assert.deepEqual([metadata.width, metadata.height, metadata.hasAlpha], [448, 448, true]);
    assert.deepEqual(await readFile(source), original);
    if (pass === 1) first = encoded;
    else assert.deepEqual(encoded, first);
  }
});

test("lobby waiting budget applies only to four exact paths with unchanged quality and derivative policy", () => {
  for (const family of ["werewolves", "mafia"]) {
    for (const theme of ["light", "dark"]) {
      const file = `lobby/waiting-${family}-${theme}-v1.png`;
      for (const input of [file, path.join(...file.split("/"))]) {
        assert.equal(webpBudgetKbFor(input), family === "werewolves" ? (theme === "dark" ? 220 : 260) : 200, input);
        assert.equal(maxWidthFor(input), family === "werewolves" ? 1320 : 1920, input);
        assert.deepEqual(optimizer.webpQualityStepsFor(input, { preferredQuality: 82 }), [82, 78, 74, 70], input);
        assert.deepEqual(optimizer.webpQualityStepsFor(input, { preferredQuality: 45 }), [70], input);
        assert.equal(optimizer.shouldCreateAvif(input), false, input);
        assert.equal(optimizer.shouldCreateRoleThumbnail(input), false, input);
        assert.equal(optimizer.publishedPngBudgetKbFor(input), 0, input);
        assert.equal(mobileWidthFor(input), 0, input);
        assert.equal(mobileDerivativePathFor(input, new Set([file])), null, input);
      }
    }
  }
  for (const file of [
    "waiting-werewolves-dark-v1.png", "other/waiting-werewolves-dark-v1.png",
    "lobby/nested/waiting-werewolves-dark-v1.png", "mobile/lobby/waiting-mafia-light-v1.png",
    "lobby/waiting-werewolf-dark-v1.png", "lobby/waiting-mafia-dawn-v1.png",
    "lobby/waiting-mafia-Light-v1.png", "lobby/waiting-mafia-light-v2.png",
    "lobby/waiting-mafia-light-v10.png", "lobby/waiting-mafia-light-v1-extra.png",
    "lobby/waiting-mafia-light-v1.png.bak",
    "mobile/lobby/waiting-werewolves-dark-v1.png", "lobby/waiting-werewolves-Light-v1.png",
    "lobby/waiting-werewolves-dark-v2.png", "lobby/waiting-werewolves-dark-v10.png",
    "lobby/waiting-werewolves-dark-v1-extra.png", "lobby/waiting-werewolves-dark-v1.png.bak",
  ]) {
    assert.equal(webpBudgetKbFor(file), 360, file);
    assert.equal(maxWidthFor(file), 1920, file);
    assert.deepEqual(optimizer.webpQualityStepsFor(file, { preferredQuality: 82 }), [82, 78, 74, 70], file);
  }
  for (const file of ["bg-lobby-tavern.png", "mafia/bg-lobby-tavern.png", "play/bg-play-werewolves-day-v2.png"]) {
    assert.equal(webpBudgetKbFor(file), 400, file);
    assert.equal(maxWidthFor(file), 2560, file);
    assert.equal(optimizer.shouldCreateAvif(file), true, file);
    assert.equal(mobileWidthFor(file), 960, file);
  }
});

test("lobby waiting targeted exports preserve masters and apply only the explicit Werewolves width", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sourceRoot = path.join(root, "assets/game-art-source/lobby");
  const outputRoot = path.join(root, "apps/web/public/game-art");
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(path.join(outputRoot, "lobby"), { recursive: true });
  const original = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: "#72987b" } }).png().toBuffer();
  const expected = new Map();
  for (const [family, width] of [["werewolves", 1320], ["mafia", 1920]]) {
    expected.set(family, await sharp(original).rotate()
      .resize({ width, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 6, smartSubsample: true }).toBuffer());
  }
  const files = [];
  for (const family of ["werewolves", "mafia"]) {
    for (const theme of ["light", "dark"]) {
      const file = `waiting-${family}-${theme}-v1.png`;
      await writeFile(path.join(sourceRoot, file), original);
      files.push(`lobby/${file}`);
    }
  }
  const sentinelSource = path.join(sourceRoot, "unselected.png");
  const sentinelOutput = path.join(outputRoot, "lobby/unselected.webp");
  await writeFile(sentinelSource, "unselected source");
  await writeFile(sentinelOutput, "unselected output");
  for (const pass of [1, 2]) {
    const result = runTargetedOptimizer(root, files);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const file of files) {
      const encoded = await readFile(path.join(outputRoot, file.replace(/\.png$/, ".webp")));
      const family = file.includes("werewolves") ? "werewolves" : "mafia";
      assert.deepEqual(encoded, expected.get(family), `pass ${pass}: first fitting quality for ${file}`);
      assert.ok(encoded.length <= webpBudgetKbFor(file) * 1024, file);
      const metadata = await sharp(encoded).metadata();
      assert.deepEqual([metadata.width, metadata.height, metadata.format, metadata.hasAlpha],
        family === "werewolves" ? [1320, 880, "webp", false] : [1536, 1024, "webp", false], file);
      assert.deepEqual(await readFile(path.join(root, "assets/game-art-source", file)), original, file);
    }
    assert.equal(await readFile(sentinelSource, "utf8"), "unselected source");
    assert.equal(await readFile(sentinelOutput, "utf8"), "unselected output");
    assert.deepEqual(await readdir(outputRoot), ["lobby"]);
    assert.deepEqual((await readdir(path.join(outputRoot, "lobby"))).sort(), [
      "unselected.webp", ...files.map((file) => path.basename(file).replace(/\.png$/, ".webp")),
    ].sort(), "no extra PNGs, AVIFs, mobile assets or temporary artifacts");
  }
});

test("lobby waiting real masters reproduce approved dimensions and fit the combined reclaimed budget", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sourceRoot = path.join(root, "assets/game-art-source/lobby");
  const outputRoot = path.join(root, "apps/web/public/game-art");
  await mkdir(sourceRoot, { recursive: true });
  const originals = new Map();
  const expectedOutputs = new Map();
  const variants = [
    { name: "waiting-werewolves-dark-v1", width: 1320, height: 940, cap: 220, quality: 70 },
    { name: "waiting-werewolves-light-v1", width: 1320, height: 943, cap: 260, quality: 70 },
    { name: "waiting-mafia-dark-v1", width: 1487, height: 1058, cap: 200, quality: 74 },
    { name: "waiting-mafia-light-v1", width: 1486, height: 1058, cap: 200, quality: 70 },
  ];
  for (const variant of variants) {
    const file = `lobby/${variant.name}.png`;
    const original = await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url));
    originals.set(file, original);
    await writeFile(path.join(sourceRoot, path.basename(file)), original);
    for (const quality of [82, 78, 74, 70]) {
      const encoded = await sharp(original).rotate()
        .resize({ width: variant.width, fit: "inside", withoutEnlargement: true })
        .webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
      if (encoded.length <= variant.cap * 1024) {
        assert.equal(quality, variant.quality, `${file}: first fitting quality`);
        expectedOutputs.set(file, encoded);
        break;
      }
    }
    assert.ok(expectedOutputs.has(file), `${file}: must fit without reducing quality below Q70`);
  }
  for (const pass of [1, 2]) {
    const result = runTargetedOptimizer(root, [...originals.keys()]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    let combinedBytes = 0;
    for (const variant of variants) {
      const file = `lobby/${variant.name}.png`;
      const original = originals.get(file);
      const name = file.replace(/\.png$/, ".webp");
      const encoded = await readFile(path.join(outputRoot, name));
      assert.deepEqual(encoded, expectedOutputs.get(file), `pass ${pass}: ${file}`);
      assert.deepEqual(encoded, await readFile(new URL(`../apps/web/public/game-art/${name}`, import.meta.url)), name);
      combinedBytes += encoded.length;
      const outputMetadata = await sharp(encoded).metadata();
      assert.deepEqual([outputMetadata.width, outputMetadata.height, outputMetadata.format, outputMetadata.hasAlpha],
        [variant.width, variant.height, "webp", false], name);
      assert.deepEqual(await readFile(path.join(root, "assets/game-art-source", file)), original, file);
      assert.deepEqual(await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url)), original, file);
    }
    assert.deepEqual(await readdir(outputRoot), ["lobby"]);
    assert.deepEqual((await readdir(path.join(outputRoot, "lobby"))).sort(),
      variants.map((variant) => `${variant.name}.webp`).sort());
    assert.ok(combinedBytes <= 886309, `four plates must fit reclaimed bytes plus original headroom: ${combinedBytes}`);
  }
});

test("lobby waiting over-budget export fails at Q70 without replacing the previous derivative", async (t) => {
  const root = await temporaryAssetRoot(t);
  const file = "lobby/waiting-werewolves-dark-v1.png";
  const source = path.join(root, "assets/game-art-source", file);
  const output = path.join(root, "apps/web/public/game-art/lobby/waiting-werewolves-dark-v1.webp");
  const pixels = Buffer.alloc(1024 * 1024 * 3);
  let seed = 1;
  for (let index = 0; index < pixels.length; index += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels[index] = seed >>> 24;
  }
  const original = await sharp(pixels, { raw: { width: 1024, height: 1024, channels: 3 } }).png().toBuffer();
  const floorEncoding = await sharp(original).webp({ quality: 70, effort: 6, smartSubsample: true }).toBuffer();
  assert.ok(floorEncoding.length > 220 * 1024, "fixture exceeds the real lobby budget at the quality floor");
  await mkdir(path.dirname(source), { recursive: true });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(source, original);
  await writeFile(output, "previous derivative");
  const result = runTargetedOptimizer(root, [file]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /budget 220 KiB cannot be met at quality floor 70 without reducing dimensions/);
  assert.deepEqual(await readFile(source), original);
  assert.equal(await readFile(output, "utf8"), "previous derivative");
  assert.deepEqual(await readdir(path.dirname(output)), ["waiting-werewolves-dark-v1.webp"]);
});

test("invitation threshold budget applies only to the exact native WebP pair without changing quality floors", () => {
  for (const theme of ["dark", "light"]) {
    const file = `invitation/werewolf-threshold-v1-${theme}.png`;
    for (const input of [file, path.join(...file.split("/"))]) {
      assert.equal(webpBudgetKbFor(input), 300, input);
      assert.equal(maxWidthFor(input), 1920, input);
      assert.deepEqual(optimizer.webpQualityStepsFor(input, { preferredQuality: 82 }), [82, 78, 74, 70], input);
      assert.deepEqual(optimizer.webpQualityStepsFor(input, { preferredQuality: 45 }), [70], input);
      assert.equal(optimizer.shouldCreateAvif(input), false, input);
      assert.equal(optimizer.shouldCreateRoleThumbnail(input), false, input);
      assert.equal(optimizer.publishedPngBudgetKbFor(input), 0, input);
      assert.equal(mobileWidthFor(input), 0, input);
      assert.equal(mobileDerivativePathFor(input, new Set([file])), null, input);
    }
  }
  for (const file of [
    "werewolf-threshold-v1-dark.png", "other/werewolf-threshold-v1-dark.png",
    "invitation/nested/werewolf-threshold-v1-dark.png", "mobile/invitation/werewolf-threshold-v1-light.png",
    "invitation/werewolf-threshold-v2-dark.png", "invitation/werewolf-threshold-v10-light.png",
    "invitation/werewolf-threshold-v1-other.png", "invitation/mafia-threshold-v1-dark.png",
    "invitation/werewolf-threshold-v1-light.png.bak",
  ]) {
    assert.equal(webpBudgetKbFor(file), 360, file);
    assert.equal(maxWidthFor(file), 1920, file);
    assert.deepEqual(optimizer.webpQualityStepsFor(file, { preferredQuality: 82 }), [82, 78, 74, 70], file);
  }
});

test("invitation threshold scenes reproduce the first fitting quality at native dimensions without changed masters or extra outputs", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sourceRoot = path.join(root, "assets/game-art-source");
  const outputRoot = path.join(root, "apps/web/public/game-art");
  const originals = new Map();
  const expectedOutputs = new Map();
  for (const theme of ["dark", "light"]) {
    const file = `invitation/werewolf-threshold-v1-${theme}.png`;
    const original = await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url));
    await mkdir(path.dirname(path.join(sourceRoot, file)), { recursive: true });
    await writeFile(path.join(sourceRoot, file), original);
    originals.set(file, original);
    for (const quality of [82, 78, 74, 70]) {
      const encoded = await sharp(original, { limitInputPixels: false }).rotate()
        .resize({ width: 1920, fit: "inside", withoutEnlargement: true })
        .webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
      if (encoded.length <= 300 * 1024) {
        assert.equal(quality, theme === "dark" ? 82 : 78, `${file}: first fitting quality`);
        expectedOutputs.set(file, encoded);
        break;
      }
    }
    assert.ok(expectedOutputs.has(file), `${file}: budget must fit without lowering the Q70 floor`);
  }

  for (const pass of [1, 2]) {
    const result = runTargetedOptimizer(root, [...originals.keys()]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const [file, original] of originals) {
      const name = file.replace(/\.png$/, ".webp");
      const encoded = await readFile(path.join(outputRoot, name));
      assert.deepEqual(encoded, expectedOutputs.get(file), `pass ${pass}: first fitting encoding for ${file}`);
      assert.deepEqual(encoded, await readFile(new URL(`../apps/web/public/game-art/${name}`, import.meta.url)), name);
      const metadata = await sharp(encoded).metadata();
      assert.deepEqual([metadata.width, metadata.height, metadata.format], [1487, 1058, "webp"], name);
      assert.equal(metadata.hasAlpha, false, name);
      assert.ok(encoded.length <= 300 * 1024, `${name}: bounded runtime bytes`);
      assert.deepEqual(await readFile(path.join(sourceRoot, file)), original, `pass ${pass}: staged master unchanged`);
      assert.deepEqual(await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url)), original, "repository master unchanged");
    }
    assert.deepEqual(await readdir(outputRoot), ["invitation"], "no mobile or thumbnail directories");
    assert.deepEqual((await readdir(path.join(outputRoot, "invitation"))).sort(), [
      "werewolf-threshold-v1-dark.webp", "werewolf-threshold-v1-light.webp",
    ], "only the two WebPs; no PNGs, AVIFs or temporary artifacts");
  }
});

test("guestbook artwork uses bounded scenes and sharp transparent small ornaments", async (t) => {
  const root = await temporaryAssetRoot(t);
  const files = ["friends/invitation-seal-v1.png", "friends/guest-medallion-v1.png"];
  for (const file of files) {
    await mkdir(path.dirname(path.join(root, "assets/game-art-source", file)), { recursive: true });
    await copyFile(new URL(`../assets/game-art-source/${file}`, import.meta.url), path.join(root, "assets/game-art-source", file));
  }
  const result = runTargetedOptimizer(root, files);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const file of files) {
    const output = path.join(root, "apps/web/public/game-art", file.replace(/\.png$/, ".webp"));
    const bytes = await readFile(output);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, file.includes("seal") ? 192 : 128);
    assert.equal(metadata.height, metadata.width);
    assert.equal(metadata.hasAlpha, true);
    assert.ok(bytes.length < 16 * 1024);
    const stats = await sharp(bytes).stats();
    assert.equal(stats.channels[3].min, 0);
    assert.equal(stats.channels[3].max, 255);
    assert.ok(stats.entropy > 3, "The visible asset is not a blank transparent placeholder");
    assert.deepEqual(bytes, await readFile(new URL(`../apps/web/public/game-art/${file.replace(/\.png$/, ".webp")}`, import.meta.url)));
  }
  for (const theme of ["light", "dark"]) {
    const file = `friends/bg-friends-invitation-${theme}-v1.png`;
    assert.equal(maxWidthFor(file), 1448);
    assert.deepEqual(optimizer.webpQualityStepsFor(file), [75]);
    assert.equal(webpBudgetKbFor(file), 180);
    assert.equal(mobileWidthFor(file), 960);
  }
});

test("guestbook paper preserves its portrait texture within a single bounded derivative", async (t) => {
  const root = await temporaryAssetRoot(t);
  const file = "friends/invitation-paper-v1.png";
  const source = path.join(root, "assets/game-art-source", file);
  const original = await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url));
  await mkdir(path.dirname(source), { recursive: true });
  await writeFile(source, original);
  assert.equal(maxWidthFor(file), 816);
  assert.deepEqual(optimizer.webpQualityStepsFor(file), [72]);
  assert.equal(webpBudgetKbFor(file), 80);
  assert.equal(mobileWidthFor(file), 0);
  assert.equal(optimizer.shouldCreateAvif(file), false);
  const result = runTargetedOptimizer(root, [file]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(await readFile(source), original);
  const bytes = await readFile(path.join(root, "apps/web/public/game-art/friends/invitation-paper-v1.webp"));
  const metadata = await sharp(bytes).metadata();
  assert.deepEqual([metadata.width, metadata.height], [816, 1088]);
  assert.ok(bytes.length > 10000 && bytes.length < 80 * 1024);
  assert.ok((await sharp(bytes).stats()).entropy > 3);
  assert.deepEqual(bytes, await readFile(new URL("../apps/web/public/game-art/friends/invitation-paper-v1.webp", import.meta.url)));
});

test("achievement collection exports preserve transparency and reproduce without extra formats", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sourceRoot = path.join(root, "assets/game-art-source");
  const outputRoot = path.join(root, "apps/web/public/game-art");
  const originals = new Map();
  const relics = ["first_blood", "jester_win", "guardian_save", "hunter_revenge", "silent_civilian", "perfect_record", "maniac_endgame"];
  const surfaces = ["achievements/collection-surface.png", "achievements/collection-slate-dark-v1.png", "achievements/collection-table-dark-v1.png", "achievements/collection-table-light-v1.png"];
  const files = [...relics.map((id) => `achievements/relics/${id}.png`), ...surfaces, "og/og-achievements.png"];
  for (const file of files) {
    const original = await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url));
    await mkdir(path.dirname(path.join(sourceRoot, file)), { recursive: true });
    await writeFile(path.join(sourceRoot, file), original);
    originals.set(file, original);
    assert.equal(optimizer.shouldCreateAvif(file), false);
    assert.equal(optimizer.mobileWidthFor(file), 0);
  }
  const outputs = new Map();
  for (const pass of [1, 2]) {
    const result = runTargetedOptimizer(root, files);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const [file, original] of originals) {
      assert.deepEqual(await readFile(path.join(sourceRoot, file)), original, file);
      const isPreview = file.startsWith("og/");
      const isSurface = surfaces.includes(file);
      const name = file.replace(/\.png$/, isPreview ? ".jpg" : ".webp");
      const encoded = await readFile(path.join(outputRoot, name));
      assert.deepEqual(encoded, await readFile(new URL(`../apps/web/public/game-art/${name}`, import.meta.url)), `${name}: published encoding is reproducible`);
      const metadata = await sharp(encoded).metadata();
      if (isPreview) {
        assert.equal(metadata.format, "jpeg");
        assert.equal(existsSync(path.join(outputRoot, file)), false, "no obsolete metadata PNG");
      }
      const dimensions = isPreview ? [1200, 630] : /collection-table-(dark|light)-v1\.png$/.test(file) ? [1536, 1024] : isSurface ? [512, 512] : [960, 640];
      assert.deepEqual([metadata.width, metadata.height], dimensions, file);
      assert.ok(encoded.length <= (isPreview ? 300 : webpBudgetKbFor(file)) * 1024, file);
      assert.equal(existsSync(path.join(outputRoot, file.replace(/\.png$/, ".avif"))), false);
      if (!isPreview && !isSurface) {
        assert.equal(metadata.hasAlpha, true, file);
        const alpha = (await sharp(encoded).stats()).channels[3];
        assert.equal(alpha.min, 0, file);
        assert.ok(alpha.max >= 250, file);
      }
      if (pass === 1) outputs.set(file, encoded);
      else assert.deepEqual(encoded, outputs.get(file), file);
    }
  }
  assert.equal(existsSync(path.join(outputRoot, "mobile")), false);
  assert.equal(maxWidthFor("other/relics/first_blood.png"), 1920);
  assert.equal(maxWidthFor("achievements/relics/nested/first_blood.png"), 1920);
  assert.equal(maxWidthFor("other/collection-surface.png"), 1920);
});

test("leaderboard edition scenes and metadata reproduce at native resolution within budget", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sourceRoot = path.join(root, "assets/game-art-source");
  const outputRoot = path.join(root, "apps/web/public/game-art");
  const originals = new Map();
  const files = ["leaderboard/edition-dark-v1.png", "leaderboard/edition-light-v1.png", "og/og-leaderboard.png"];
  for (const file of files) {
    const original = await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url));
    await mkdir(path.dirname(path.join(sourceRoot, file)), { recursive: true });
    await writeFile(path.join(sourceRoot, file), original);
    originals.set(file, original);
    assert.equal(optimizer.shouldCreateAvif(file), false);
    assert.equal(optimizer.mobileWidthFor(file), 0);
  }
  await mkdir(path.join(outputRoot, "og"), { recursive: true });
  await writeFile(path.join(outputRoot, "og/og-leaderboard.png"), "obsolete derivative");
  for (const pass of [1, 2]) {
    const result = runTargetedOptimizer(root, files);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const [file, original] of originals) {
      assert.deepEqual(await readFile(path.join(sourceRoot, file)), original, `pass ${pass}: master unchanged`);
      const preview = file.startsWith("og/");
      const name = file.replace(/\.png$/, preview ? ".jpg" : ".webp");
      const encoded = await readFile(path.join(outputRoot, name));
      assert.deepEqual(encoded, await readFile(new URL(`../apps/web/public/game-art/${name}`, import.meta.url)), name);
      const metadata = await sharp(encoded).metadata();
      assert.deepEqual([metadata.width, metadata.height], preview ? [1200, 630] : [1536, 1024]);
      assert.equal(metadata.format, preview ? "jpeg" : "webp");
      assert.ok(encoded.length <= (preview ? 300 : webpBudgetKbFor(file)) * 1024);
      assert.equal(existsSync(path.join(outputRoot, file)), false);
      assert.equal(existsSync(path.join(outputRoot, file.replace(/\.png$/, ".avif"))), false);
    }
  }
  assert.equal(existsSync(path.join(outputRoot, "mobile")), false);
  assert.equal(maxWidthFor("leaderboard/edition-light-v1.png"), 1536);
  assert.deepEqual(optimizer.webpQualityStepsFor("leaderboard/edition-light-v1.png"), [75]);
  assert.equal(maxWidthFor("other/edition-light-v1.png"), 1920);
});

test("history ledger scenes reproduce within budget without redundant derivatives", async (t) => {
  const root = await temporaryAssetRoot(t);
  const files = ["history/archive-ledger-dark-v2.png", "history/archive-ledger-light-v2.png"];
  for (const file of files) {
    const input = new URL(`../assets/game-art-source/${file}`, import.meta.url);
    const target = path.join(root, "assets/game-art-source", file);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(input, target);
    assert.equal(maxWidthFor(file), 1536);
    assert.equal(webpBudgetKbFor(file), 180);
    assert.deepEqual(optimizer.webpQualityStepsFor(file), [75]);
    assert.equal(optimizer.shouldCreateAvif(file), false);
    assert.equal(optimizer.mobileWidthFor(file), 0);
  }
  const result = runTargetedOptimizer(root, files);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const file of files) {
    const name = file.replace(/\.png$/, ".webp");
    const output = await readFile(path.join(root, "apps/web/public/game-art", name));
    assert.deepEqual(output, await readFile(new URL(`../apps/web/public/game-art/${name}`, import.meta.url)));
    assert.ok(output.length <= webpBudgetKbFor(file) * 1024);
    assert.equal((await sharp(output).metadata()).width, 1536);
    assert.deepEqual(
      await readFile(path.join(root, "assets/game-art-source", file)),
      await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url)),
    );
  }
  assert.equal(maxWidthFor("other/archive-ledger-dark-v2.png"), 1920);
});

test("history replay recipe applies only to the exact dawn source pair", () => {
  for (const theme of ["dark", "light"]) {
    const file = `history/replay-dawn-${theme}-v1.png`;
    for (const input of [file, path.join(...file.split("/"))]) {
      assert.equal(maxWidthFor(input), 1440, input);
      assert.equal(webpBudgetKbFor(input), theme === "dark" ? 100 : 156, input);
      assert.deepEqual(optimizer.webpQualityStepsFor(input), [65], input);
      assert.deepEqual(optimizer.webpQualityStepsFor(input, { preferredQuality: 45 }), [65], input);
      assert.equal(optimizer.shouldCreateAvif(input), false, input);
      assert.equal(optimizer.shouldCreateRoleThumbnail(input), false, input);
      assert.equal(optimizer.publishedPngBudgetKbFor(input), 0, input);
      assert.equal(optimizer.mobileWidthFor(input), 0, input);
      assert.equal(mobileDerivativePathFor(input, new Set([file])), null, input);
    }
  }
  for (const file of [
    "other/replay-dawn-dark-v1.png", "history/nested/replay-dawn-dark-v1.png",
    "mobile/history/replay-dawn-light-v1.png", "history/replay-dawn-dark-v2.png",
    "history/replay-dawn-dark-v10.png", "history/replay-dawn-other-v1.png",
    "history/replay-dawn-light-v1.png.bak",
  ]) {
    assert.equal(maxWidthFor(file), 1920, file);
    assert.equal(webpBudgetKbFor(file), 360, file);
    assert.deepEqual(optimizer.webpQualityStepsFor(file, { preferredQuality: 82 }), [82, 78, 74, 70], file);
  }
});

test("history replay scenes reproduce current runtime bytes at 1440x480 within budgets without extra outputs or changed masters", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sourceRoot = path.join(root, "assets/game-art-source");
  const outputRoot = path.join(root, "apps/web/public/game-art");
  const originals = new Map();
  const expectedOutputs = new Map();
  for (const theme of ["dark", "light"]) {
    const file = `history/replay-dawn-${theme}-v1.png`;
    const original = await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url));
    await mkdir(path.dirname(path.join(sourceRoot, file)), { recursive: true });
    await writeFile(path.join(sourceRoot, file), original);
    originals.set(file, original);
    const expected = await sharp(original, { limitInputPixels: false }).rotate()
      .resize({ width: 1440, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 65, effort: 6, smartSubsample: true }).toBuffer();
    expectedOutputs.set(file, expected);
  }

  for (const pass of [1, 2]) {
    const result = runTargetedOptimizer(root, [...originals.keys()]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    let totalBytes = 0;
    for (const [file, original] of originals) {
      const name = file.replace(/\.png$/, ".webp");
      const encoded = await readFile(path.join(outputRoot, name));
      assert.deepEqual(encoded, expectedOutputs.get(file), `pass ${pass}: fixed Q65 encoding for ${file}`);
      assert.deepEqual(encoded, await readFile(new URL(`../apps/web/public/game-art/${name}`, import.meta.url)), name);
      const metadata = await sharp(encoded).metadata();
      assert.deepEqual([metadata.width, metadata.height], [1440, 480], name);
      assert.equal(metadata.format, "webp", name);
      assert.equal(metadata.hasAlpha, false, name);
      assert.ok(encoded.length <= webpBudgetKbFor(file) * 1024, `${name}: individual budget`);
      totalBytes += encoded.length;
      assert.deepEqual(await readFile(path.join(sourceRoot, file)), original, `pass ${pass}: staged master unchanged`);
      assert.deepEqual(await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url)), original, "repository master unchanged");
    }
    assert.ok(totalBytes <= 250 * 1024, "combined replay budget");
    assert.deepEqual(await readdir(outputRoot), ["history"], "no mobile, thumbnail or metadata directories");
    assert.deepEqual((await readdir(path.join(outputRoot, "history"))).sort(), [
      "replay-dawn-dark-v1.webp", "replay-dawn-light-v1.webp",
    ], "only the two WebPs; no PNGs, AVIFs or temporary artifacts");
  }
});

test("history replay fails closed instead of lowering Q65 when its budget is exceeded", async (t) => {
  const root = await temporaryAssetRoot(t);
  const file = "history/replay-dawn-light-v1.png";
  const original = await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url));
  const input = path.join(root, "source.png");
  const output = path.join(root, "replay.webp");
  const previous = Buffer.from("previous runtime output");
  await writeFile(input, original);
  await writeFile(output, previous);
  await assert.rejects(
    optimizer.writeWebp(sharp, input, output, file, 1440, 150),
    /budget 150 KiB cannot be met at quality floor 65 without reducing dimensions/,
  );
  assert.deepEqual(await readFile(input), original, "source is unchanged");
  assert.deepEqual(await readFile(output), previous, "previous output is unchanged");
  assert.deepEqual((await readdir(root)).sort(), ["replay.webp", "source.png"], "no temporary artifacts remain");
});

test("create mastheads reproduce as bounded WebPs without redundant formats or changed masters", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sourceRoot = path.join(root, "assets/game-art-source");
  const outputRoot = path.join(root, "apps/web/public/game-art");
  const originals = new Map();
  for (const family of ["werewolf", "mafia"]) {
    for (const theme of ["light", "dark"]) {
      const file = `create/masthead-${family}-${theme}-v1.png`;
      const source = await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url));
      await mkdir(path.join(sourceRoot, "create"), { recursive: true });
      await writeFile(path.join(sourceRoot, file), source);
      originals.set(file, source);
      assert.equal(maxWidthFor(file), 1152);
      assert.equal(optimizer.shouldCreateAvif(file), false);
      assert.deepEqual(optimizer.webpQualityStepsFor(file), [70]);
      assert.equal(optimizer.mobileWidthFor(file), 0);
    }
  }
  const outputs = new Map();
  for (const pass of [1, 2]) {
    const result = runTargetedOptimizer(root, [...originals.keys()]);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const [file, source] of originals) {
      assert.deepEqual(await readFile(path.join(sourceRoot, file)), source);
      const name = file.replace(/\.png$/, ".webp");
      const encoded = await readFile(path.join(outputRoot, name));
      const metadata = await sharp(encoded).metadata();
      assert.deepEqual([metadata.width, metadata.height], [1152, 384]);
      assert.ok(encoded.length <= webpBudgetKbFor(file) * 1024);
      assert.equal(existsSync(path.join(outputRoot, file.replace(/\.png$/, ".avif"))), false);
      if (pass === 1) outputs.set(name, encoded);
      else assert.deepEqual(encoded, outputs.get(name), name);
    }
  }
  assert.equal(existsSync(path.join(outputRoot, "mobile")), false);
  assert.equal((await readdir(path.join(outputRoot, "create"))).length, 4);
  for (const file of ["other/masthead-mafia-light-v1.png", "create/masthead-mafia-light-v2.png", "create/masthead-other-light-v1.png"]) {
    assert.equal(maxWidthFor(file), 1920);
    assert.equal(optimizer.shouldCreateAvif(file), false);
    assert.deepEqual(optimizer.avifQualityStepsFor(file), [60, 56, 55]);
  }
});

test("exported AVIF writer preserves dimensions, masters and previous output on budget failure", async (t) => {
  assert.equal(typeof optimizer.writeAvif, "function");
  const root = await temporaryAssetRoot(t);
  const input = path.join(root, "source.png");
  const output = path.join(root, "output.avif");
  const original = await sharp({ create: { width: 80, height: 120, channels: 3, background: "#7298ab" } }).png().toBuffer();
  await writeFile(input, original);
  await writeFile(output, "previous output");
  await assert.rejects(optimizer.writeAvif(sharp, input, output, "mobile/mafia/bg-hero-v3.png", 1152, 0.001), /budget.*quality.*without reducing dimensions/);
  assert.equal(await readFile(output, "utf8"), "previous output");
  await optimizer.writeAvif(sharp, input, output, "mobile/mafia/bg-hero-v3.png", 1152, 256);
  const metadata = await sharp(await readFile(output)).metadata();
  assert.deepEqual([metadata.width, metadata.height], [80, 120]);
  await assert.rejects(optimizer.writeAvif(sharp, input, input, "mobile/mafia/bg-hero-v3.png", 1152, 256), /source master/);
  assert.deepEqual(await readFile(input), original);
  assert.deepEqual((await readdir(root)).sort(), ["output.avif", "source.png"]);
});

test("targeted Mafia v3 portrait export retains the family resolution limit in both formats", async (t) => {
  const root = await temporaryAssetRoot(t);
  const file = "mobile/mafia/bg-hero-v3.png";
  const source = path.join(root, "assets/game-art-source", file);
  await mkdir(path.dirname(source), { recursive: true });
  const original = await sharp({ create: { width: 1600, height: 2400, channels: 3, background: "#7298ab" } }).png().toBuffer();
  await writeFile(source, original);
  const result = runTargetedOptimizer(root, [file]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const [format, budget] of [["avif", 256], ["webp", 384]]) {
    const encoded = await readFile(path.join(root, "apps/web/public/game-art", file.replace(/\.png$/, `.${format}`)));
    const metadata = await sharp(encoded).metadata();
    assert.deepEqual([metadata.width, metadata.height], [1152, 1728], format);
    assert.ok(encoded.length <= budget * 1024);
  }
  assert.deepEqual(await readFile(source), original);
  assert.equal(avifBudgetKbFor(file), 256);
  assert.equal(webpBudgetKbFor(file), 384);
  for (const unrelated of ["mafia/bg-hero-v3.png", "mobile/other/bg-hero-v3.png", "mobile/mafia/bg-hero-v30.png", "mobile/mafia/nested/bg-hero-v3.png"]) {
    assert.equal(maxWidthFor(unrelated), 2560, unrelated);
    assert.equal(avifBudgetKbFor(unrelated), 360, unrelated);
  }
});

test("paired table inlays replace stale AVIFs at the same native dimensions as WebP", async (t) => {
  const root = await temporaryAssetRoot(t);
  const originals = new Map();
  for (const [directory, width, height, staleWidth] of [["play", 1774, 887, 1280], ["mobile/play", 941, 1672, 640]]) {
    for (const family of ["werewolves", "mafia"]) {
      const file = `${directory}/table-inlay-${family}-${family === "mafia" ? "v2" : "v1"}.png`;
      const original = await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url));
      const input = path.join(root, "assets/game-art-source", file);
      const stale = path.join(root, "apps/web/public/game-art", file.replace(/\.png$/, ".avif"));
      await mkdir(path.dirname(input), { recursive: true });
      await mkdir(path.dirname(stale), { recursive: true });
      await writeFile(input, original);
      await sharp(original).resize({ width: staleWidth }).avif().toFile(stale);
      originals.set(file, { original, width, height });
    }
  }
  const result = runTargetedOptimizer(root, [...originals.keys()]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const [file, { original, width, height }] of originals) {
    assert.deepEqual(await readFile(path.join(root, "assets/game-art-source", file)), original);
    for (const format of ["webp", "avif"]) {
      const encoded = await readFile(path.join(root, "apps/web/public/game-art", file.replace(/\.png$/, `.${format}`)));
      const metadata = await sharp(encoded).metadata();
      assert.deepEqual([metadata.width, metadata.height], [width, height], `${file}: ${format}`);
      assert.ok(encoded.length <= 360 * 1024, `${file}: ${format} delivery budget`);
    }
  }
});

test("Mafia v2 inlay AVIF registration preserves v1 and excludes every unregistered path and version", () => {
  for (const directory of ["play", "mobile/play"]) {
    for (const name of ["table-inlay-werewolves-v1.png", "table-inlay-mafia-v1.png", "table-inlay-mafia-v2.png"]) {
      for (const file of [`${directory}/${name}`, path.join(directory, name)]) {
        assert.equal(optimizer.shouldCreateAvif(file), true, file);
      }
    }
    for (const name of ["table-inlay-werewolves-v2.png", "table-inlay-mafia-v3.png", "table-inlay-mafia-v20.png", "table-inlay-other-v2.png", "table-inlay-mafia-v2-extra.png", "table-inlay-mafia-v2.png.bak"]) {
      assert.equal(optimizer.shouldCreateAvif(`${directory}/${name}`), false, `${directory}/${name}`);
    }
  }
  for (const file of ["table-inlay-mafia-v2.png", "other/table-inlay-mafia-v2.png", "play/nested/table-inlay-mafia-v2.png", "mobile/other/table-inlay-mafia-v2.png"]) {
    assert.equal(optimizer.shouldCreateAvif(file), false, file);
  }
});

test("Mafia v2 inlay targeted exports preserve both native aspect ratios and source bytes", async (t) => {
  const root = await temporaryAssetRoot(t);
  const originals = new Map();
  for (const [directory, dimensions] of [["play", [1774, 887]], ["mobile/play", [941, 1672]]]) {
    const file = `${directory}/table-inlay-mafia-v2.png`;
    const original = await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url));
    const source = path.join(root, "assets/game-art-source", file);
    await mkdir(path.dirname(source), { recursive: true });
    await writeFile(source, original);
    originals.set(file, { original, dimensions });
  }
  const result = runTargetedOptimizer(root, [...originals.keys()]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const [file, { original, dimensions }] of originals) {
    assert.deepEqual(await readFile(path.join(root, "assets/game-art-source", file)), original, file);
    for (const format of ["webp", "avif"]) {
      const output = path.join(root, "apps/web/public/game-art", file.replace(/\.png$/, `.${format}`));
      assert.ok(existsSync(output), `${file}: ${format} generated`);
      const encoded = await readFile(output);
      const metadata = await sharp(encoded).metadata();
      assert.deepEqual([metadata.width, metadata.height], dimensions, `${file}: ${format}`);
      assert.ok(encoded.length <= 360 * 1024, `${file}: ${format} budget`);
      t.diagnostic(`${file}: ${format} ${(encoded.length / 1024).toFixed(1)} KiB at ${metadata.width}x${metadata.height}`);
    }
  }
});

test("table inlay AVIF registration excludes unrelated paths, families and versions", () => {
  for (const file of [
    "table-inlay-mafia-v1.png", "other/table-inlay-mafia-v1.png", "play/nested/table-inlay-mafia-v1.png",
    "play/table-inlay-other-v1.png", "play/table-inlay-mafia-v10.png", "play/table-inlay-mafia-v1.png.bak",
    "mobile/other/table-inlay-mafia-v1.png",
  ]) assert.equal(optimizer.shouldCreateAvif(file), false, file);
});

test("targeted optimizer leaves unselected outputs, temporary files and dedicated mobile masters alone", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sourceRoot = path.join(root, "assets/game-art-source");
  const outputRoot = path.join(root, "apps/web/public/game-art");
  for (const directory of [sourceRoot, path.join(sourceRoot, "mobile/play"), path.join(sourceRoot, "play"), path.join(outputRoot, "mobile/play")]) {
    await mkdir(directory, { recursive: true });
  }
  const file = "play/bg-play-mafia-day-v2.png";
  await sharp({ create: { width: 80, height: 40, channels: 3, background: "#7298ab" } }).png().toFile(path.join(sourceRoot, file));
  await writeFile(path.join(sourceRoot, "mobile", file), "unselected dedicated master");
  await writeFile(path.join(sourceRoot, "unrelated.png"), "invalid unselected master");
  const sentinels = ["unrelated.webp", "unrelated.webp.tmp-123.webp", "mobile/play/bg-play-mafia-day-v2.webp", "mobile/play/bg-play-mafia-day-v2.avif"];
  for (const file of sentinels) await writeFile(path.join(outputRoot, file), "unselected output");
  const result = runTargetedOptimizer(root, [file]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Processed 1\/1/);
  for (const file of sentinels) assert.equal(await readFile(path.join(outputRoot, file), "utf8"), "unselected output", file);
  const report = runTargetedOptimizer(root, [file], ["--report-only"]);
  assert.equal(report.status, 0, report.stderr);
  assert.equal(report.stdout.trim().split(/\r?\n/).length, 2);
  assert.match(report.stdout, /play\/bg-play-mafia-day-v2\.png/);
});

test("targeted optimizer fails closed on unknown, empty or malformed selections before any writes", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sourceRoot = path.join(root, "assets/game-art-source");
  const outputRoot = path.join(root, "apps/web/public/game-art");
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(outputRoot, { recursive: true });
  await sharp({ create: { width: 32, height: 32, channels: 3, background: "#7298ab" } }).png().toFile(path.join(sourceRoot, "valid.png"));
  await writeFile(path.join(outputRoot, "sentinel.tmp-123.webp"), "untouched");
  for (const args of [["--only", "valid.png", "--only", "missing.png"], ["--only="], ["--only"], ["--only", "../valid.png"], ["--onyl", "valid.png"]]) {
    const result = runTargetedOptimizer(root, [], args);
    assert.notEqual(result.status, 0, JSON.stringify(args));
    assert.deepEqual(await readdir(outputRoot), ["sentinel.tmp-123.webp"], JSON.stringify(args));
  }
});

test("dedicated mobile v2 scene cap applies only to the four exact paths without lowering quality or budgets", () => {
  for (const family of ["werewolves", "mafia"]) {
    for (const phase of ["day", "night"]) {
      const file = `mobile/play/bg-play-${family}-${phase}-v2.png`;
      for (const input of [file, path.join(...file.split("/"))]) {
        assert.equal(maxWidthFor(input), 960, input);
        assert.equal(webpBudgetKbFor(input), 400, input);
        assert.equal(avifBudgetKbFor(input), 360, input);
        assert.deepEqual(optimizer.webpQualityStepsFor(input, { preferredQuality: 34 }), [70], input);
      }
    }
  }
  for (const file of [
    "play/bg-play-werewolves-day-v2.png", "play/bg-play-mafia-night-v2.png",
    "mobile/other/bg-play-mafia-day-v2.png", "mobile/play/nested/bg-play-mafia-day-v2.png",
    "mobile/play/bg-play-werewolf-day-v2.png", "mobile/play/bg-play-mafia-dawn-v2.png",
    "mobile/play/bg-play-mafia-day-v20.png", "mobile/play/bg-play-mafia-day-v2-extra.png",
    "mobile/play/bg-play-mafia-day-v2.png.bak",
  ]) assert.equal(maxWidthFor(file), 2560, file);
});

test("dedicated mobile v2 scenes export matching 960x1440 formats and preserve 1024x1536 masters", async (t) => {
  const root = await temporaryAssetRoot(t);
  const originals = new Map();
  const fixture = await sharp({ create: { width: 1024, height: 1536, channels: 3, background: "#7298ab" } }).png().toBuffer();
  for (const family of ["werewolves", "mafia"]) {
    for (const phase of ["day", "night"]) {
      const file = `mobile/play/bg-play-${family}-${phase}-v2.png`;
      const original = family === "werewolves" && phase === "day"
        ? await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url))
        : fixture;
      const source = path.join(root, "assets/game-art-source", file);
      await mkdir(path.dirname(source), { recursive: true });
      await writeFile(source, original);
      const metadata = await sharp(original).metadata();
      assert.deepEqual([metadata.width, metadata.height], [1024, 1536], file);
      originals.set(file, original);
    }
  }
  const result = runTargetedOptimizer(root, [...originals.keys()]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const [file, original] of originals) {
    assert.deepEqual(await readFile(path.join(root, "assets/game-art-source", file)), original, `${file}: master unchanged`);
    for (const [format, budget] of [["webp", 400], ["avif", 360]]) {
      const encoded = await readFile(path.join(root, "apps/web/public/game-art", file.replace(/\.png$/, `.${format}`)));
      const metadata = await sharp(encoded).metadata();
      assert.deepEqual([metadata.width, metadata.height], [960, 1440], `${file}: ${format}`);
      assert.ok(encoded.length <= budget * 1024, `${file}: ${format} budget`);
      if (file.includes("werewolves-day")) t.diagnostic(`${file}: ${format} ${(encoded.length / 1024).toFixed(1)} KiB at 960x1440`);
    }
  }
});

test("paired v2 play scenes export desktop and mobile formats with dedicated mobile ownership", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sources = [];
  const expected = new Map();
  for (const family of ["werewolves", "mafia"]) {
    for (const phase of ["day", "night"]) {
      const file = `play/bg-play-${family}-${phase}-v2.png`;
      for (const [prefix, width, height] of [["", 2000, 1000], ...(phase === "day" ? [["mobile/", 120, 240]] : [])]) {
        const relative = `${prefix}${file}`;
        const source = path.join(root, "assets/game-art-source", relative);
        await mkdir(path.dirname(source), { recursive: true });
        await sharp({ create: { width, height, channels: 3, background: "#7298ab" } }).png().toFile(source);
        sources.push(relative);
        expected.set(relative.replace(/\.png$/, ""), [width, height]);
      }
      if (phase === "night") expected.set(`mobile/${file.replace(/\.png$/, "")}`, [960, 480]);
    }
  }
  const result = runTargetedOptimizer(root, sources);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const [stem, dimensions] of expected) {
    for (const format of ["avif", "webp"]) {
      const output = path.join(root, "apps/web/public/game-art", `${stem}.${format}`);
      assert.ok(existsSync(output), `${stem}.${format}: generated`);
      const metadata = await sharp(output).metadata();
      assert.deepEqual([metadata.width, metadata.height], dimensions, `${stem}.${format}`);
    }
  }
});

function runTargetedOptimizer(root, files, extraArgs = []) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./optimize-assets.mjs", import.meta.url)), ...files.flatMap((file) => ["--only", file]), ...extraArgs], {
    cwd: root, encoding: "utf8", windowsHide: true, timeout: 120_000,
    env: { ...process.env, WEBP_QUALITY: "82", ASSET_FILE_CONCURRENCY: "1" },
  });
  assert.ifError(result.error);
  return result;
}

test("recovery auth v2 budgets preserve formats, native limits and quality floors for only six scenes", () => {
  for (const route of ["forgot-password", "reset-password", "verify-email"]) {
    for (const theme of ["light", "dark"]) {
      const file = `auth/bg-${route}-${theme}-v2.png`;
      for (const input of [file, path.join(...file.split("/"))]) {
        assert.equal(webpBudgetKbFor(input), 270, input);
        assert.equal(avifBudgetKbFor(input), 180, input);
        assert.equal(mobileBudgetKbFor(input), 100, input);
        assert.equal(maxWidthFor(input), 2560, input);
        assert.equal(optimizer.mobileWidthFor(input), 960, input);
        assert.equal(optimizer.shouldCreateAvif(input), true, input);
        assert.equal(optimizer.shouldCreateRoleThumbnail(input), false, input);
        assert.equal(optimizer.publishedPngBudgetKbFor(input), 0, input);
        assert.equal(mobileDerivativePathFor(input, new Set([file])), `mobile/${file.replace(/\.png$/, ".webp")}`, input);
        assert.deepEqual(optimizer.webpQualityStepsFor(input, { preferredQuality: 82 }), [82, 78, 74, 70], input);
        assert.deepEqual(optimizer.webpQualityStepsFor(input, { preferredQuality: 78 }), [78, 74, 70], input);
        assert.deepEqual(optimizer.webpQualityStepsFor(input, { preferredQuality: 34 }), [70], input);
        assert.deepEqual(optimizer.avifQualityStepsFor(input), [60, 56, 55], input);
      }
    }
  }

  for (const file of [
    "auth/bg-sign-in-light-v2.png", "auth/bg-sign-in-dark-v2.png",
    "auth/bg-forgot-password-light-v1.png", "auth/bg-forgot-password-light-v3.png",
    "auth/bg-forgot-password-light-v20.png", "auth/bg-forgot-password-light-v2-extra.png",
    "auth/bg-forgot-password-light-v2.png.bak", "auth/bg-forgot-password-Light-v2.png",
    "auth/bg-forgot-password-v2.png", "auth/bg-recovery-light-v2.png",
    "other/bg-forgot-password-light-v2.png", "bg-forgot-password-light-v2.png",
    "auth/nested/bg-forgot-password-light-v2.png", "mobile/auth/bg-forgot-password-light-v2.png",
  ]) {
    assert.equal(webpBudgetKbFor(file), 400, file);
    assert.equal(avifBudgetKbFor(file), 360, file);
    assert.equal(mobileBudgetKbFor(file), 180, file);
    assert.equal(maxWidthFor(file), 2560, file);
  }
  for (const theme of ["light", "dark"]) {
    const file = `auth/bg-sign-in-${theme}-v2.png`;
    assert.equal(optimizer.shouldCreateAvif(file), true, file);
    assert.equal(optimizer.mobileWidthFor(file), 960, file);
    assert.deepEqual(optimizer.webpQualityStepsFor(file, { preferredQuality: 82 }), [82, 78, 74, 70], file);
    assert.deepEqual(optimizer.avifQualityStepsFor(file), [60, 56, 55], file);
  }
});

test("recovery auth targeted exports preserve source bytes, paired dimensions and unselected sign-in art", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sourceRoot = path.join(root, "assets/game-art-source/auth");
  const outputRoot = path.join(root, "apps/web/public/game-art");
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(path.join(outputRoot, "auth"), { recursive: true });
  await mkdir(path.join(outputRoot, "mobile/auth"), { recursive: true });
  const file = "auth/bg-forgot-password-light-v2.png";
  const original = await sharp({ create: { width: 1672, height: 941, channels: 3, background: "#72987b" } }).png().toBuffer();
  await writeFile(path.join(root, "assets/game-art-source", file), original);
  const signInSource = path.join(sourceRoot, "bg-sign-in-light-v2.png");
  await writeFile(signInSource, "unselected sign-in source");
  const sentinels = ["auth/bg-sign-in-light-v2.webp", "auth/bg-sign-in-light-v2.avif", "mobile/auth/bg-sign-in-light-v2.webp"];
  for (const sentinel of sentinels) await writeFile(path.join(outputRoot, sentinel), "unselected sign-in output");

  const first = runTargetedOptimizer(root, [file]);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const outputs = new Map();
  for (const [relative, dimensions, budget, format] of [
    [file.replace(/\.png$/, ".webp"), [1672, 941], 270, "webp"],
    [file.replace(/\.png$/, ".avif"), [1672, 941], 180, "heif"],
    [`mobile/${file.replace(/\.png$/, ".webp")}`, [960, 540], 100, "webp"],
  ]) {
    const encoded = await readFile(path.join(outputRoot, relative));
    const metadata = await sharp(encoded).metadata();
    assert.deepEqual([metadata.width, metadata.height], dimensions, relative);
    assert.equal(metadata.format, format, relative);
    assert.ok(encoded.length <= budget * 1024, relative);
    outputs.set(relative, encoded);
  }
  assert.equal(existsSync(path.join(outputRoot, file)), false, "source PNG is not published");
  assert.equal(existsSync(path.join(outputRoot, "mobile", file.replace(/\.png$/, ".avif"))), false, "mobile derivative remains WebP only");

  const second = runTargetedOptimizer(root, [file]);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  for (const [relative, encoded] of outputs) assert.deepEqual(await readFile(path.join(outputRoot, relative)), encoded, relative);
  assert.deepEqual(await readFile(path.join(root, "assets/game-art-source", file)), original);
  assert.equal(await readFile(signInSource, "utf8"), "unselected sign-in source");
  for (const sentinel of sentinels) assert.equal(await readFile(path.join(outputRoot, sentinel), "utf8"), "unselected sign-in output", sentinel);
});

test("preserves restored master resolution within category limits", () => {
  assert.equal(maxWidthFor("bg-night-phase.png"), 2560);
  assert.equal(maxWidthFor("auth/account-dossier.png"), 1920);
  assert.equal(maxWidthFor("homepage/choice-werewolf-light-v7.png"), 1536);
  assert.equal(maxWidthFor("role-seer.png"), 1100);
  assert.equal(maxWidthFor("faction-village.png"), 960);
  assert.equal(webpBudgetKbFor("faction-village.png"), 360);
  assert.equal(webpBudgetKbFor("bg-night-phase.png"), 400);
  assert.equal(webpBudgetKbFor("icon-ability-bless.png"), 64);
  assert.equal(maxWidthFor("icon-ability-bless.png"), 384);
  assert.equal(maxWidthFor("mafia/icon-phase-night.png"), 384);
  assert.equal(maxWidthFor("player-avatar-sheet.png"), 960);
  assert.equal(maxWidthFor("village-map.png"), 1200);
  assert.equal(maxWidthFor("mobile/werewolf/bg-hero-light-v1.png"), 1152);
  assert.equal(maxWidthFor("mobile/werewolf/bg-hero-v3.png"), 1152);
  assert.equal(webpBudgetKbFor("mobile/werewolf/bg-hero-v3.png"), 384);
  assert.equal(avifBudgetKbFor("mobile/werewolf/bg-hero-v3.png"), 256);
});

test("relaxes only the measured card-back thumbnail and village-map mobile budgets", () => {
  assert.equal(typeof optimizer.thumbnailBudgetKbFor, "function");
  assert.equal(optimizer.thumbnailBudgetKbFor("card-back-secret.png"), 120);
  assert.equal(optimizer.thumbnailBudgetKbFor("role-seer.png"), 90);
  assert.equal(optimizer.thumbnailBudgetKbFor("mafia/card-back-secret.png"), 90);
  assert.equal(mobileBudgetKbFor("village-map.png"), 288);
  assert.equal(mobileBudgetKbFor("mafia/village-map.png"), 180);
  assert.equal(optimizer.mobileWidthFor("village-map.png"), 960);
});

test("CLI exports the detailed card back and mobile map at unchanged dimensions and Q74", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sourceRoot = path.join(root, "assets/game-art-source");
  await mkdir(sourceRoot, { recursive: true });
  const originals = new Map();
  for (const file of ["card-back-secret.png", "village-map.png"]) {
    const original = await readFile(new URL(`../assets/game-art-source/${file}`, import.meta.url));
    originals.set(file, original);
    await writeFile(path.join(sourceRoot, file), original);
  }
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./optimize-assets.mjs", import.meta.url))], {
    cwd: root, encoding: "utf8", windowsHide: true, timeout: 120_000,
    env: { ...process.env, WEBP_QUALITY: "82", ASSET_FILE_CONCURRENCY: "1" },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const [file, variant, width, budget] of [
    ["card-back-secret.png", "thumbs/card-back-secret.webp", 520, 120],
    ["village-map.png", "mobile/village-map.webp", 960, 288],
  ]) {
    const original = originals.get(file);
    const source = await sharp(original).metadata();
    const output = await readFile(path.join(root, "apps/web/public/game-art", variant));
    const metadata = await sharp(output).metadata();
    assert.deepEqual([metadata.width, metadata.height], [width, Math.round(source.height * width / source.width)]);
    assert.ok(output.length <= budget * 1024);
    const expected = await sharp(original).rotate().resize({ width, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 74, effort: 6, smartSubsample: true }).toBuffer();
    assert.ok(output.equals(expected), `${variant}: quality retained at Q74`);
    assert.ok((await readFile(path.join(sourceRoot, file))).equals(original));
    t.diagnostic(`${variant}: ${output.length} bytes at Q74, ${metadata.width}x${metadata.height}`);
  }
});

test("quality overrides cannot bypass category floors", () => {
  assert.equal(typeof optimizer.webpQualityStepsFor, "function");
  for (const [file, variant, floor] of [
    ["bg-night-phase.png", "full", 70],
    ["homepage/choice-werewolf-light-v7.png", "full", 70],
    ["role-seer.png", "full", 70],
    ["role-seer.png", "thumbnail", 70],
    ["homepage/choice-werewolf-light-v7.png", "mobile", 70],
  ]) {
    assert.deepEqual(optimizer.webpQualityStepsFor(file, { variant, preferredQuality: 34 }), [floor]);
    assert.equal(optimizer.webpQualityStepsFor(file, { variant }).at(-1), floor);
  }
  assert.equal(optimizer.avifQualityStepsFor("bg-night-phase.png").at(-1), 55);
  assert.equal(optimizer.avifQualityStepsFor("mobile/bg-night-phase.png").at(-1), 50);
  assert.throws(() => optimizer.webpQualityStepsFor("role-seer.png", { preferredQuality: NaN }), /quality/i);
});

test("an impossible delivery budget preserves the source and previous output", async (t) => {
  assert.equal(typeof optimizer.writeWebp, "function");
  const root = await temporaryAssetRoot(t);
  const input = path.join(root, "role-source.png");
  const output = path.join(root, "role-output.webp");
  const original = await sharp({ create: { width: 1200, height: 1800, channels: 3, background: "#7298ab" } }).png().toBuffer();
  await writeFile(input, original);
  await writeFile(output, "previous output");
  await assert.rejects(optimizer.writeWebp(sharp, input, output, "role-seer.png", 1100, 0.001), /budget.*quality|quality.*budget/i);
  assert.deepEqual(await readFile(input), original);
  assert.equal(await readFile(output, "utf8"), "previous output");
  assert.deepEqual((await readdir(root)).sort(), ["role-output.webp", "role-source.png"]);
});

test("all thumbnail and mobile budgets fit current masters at the quality floor in memory", async (t) => {
  const sourceRoot = fileURLToPath(new URL("../assets/game-art-source", import.meta.url));
  const entries = await readdir(sourceRoot, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
    .map((entry) => path.relative(sourceRoot, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
    .filter((file) => !file.split("/").includes("thumbs")).sort();
  const sourceFiles = new Set(files);
  const failures = [];
  const counts = { thumbnail: 0, mobile: 0, dedicatedMobile: 0, dedicatedMobileAvif: 0, criticalMobile: 0 };
  const largest = new Map();

  for (const file of files) {
    const variants = [];
    if (optimizer.shouldCreateRoleThumbnail(file)) {
      variants.push({ kind: "thumbnail", width: 520, budget: optimizer.thumbnailBudgetKbFor(file) });
    }
    if (mobileDerivativePathFor(file, sourceFiles)) {
      variants.push({ kind: "mobile", width: optimizer.mobileWidthFor(file), budget: mobileBudgetKbFor(file) });
    }
    if (file.startsWith("mobile/")) {
      variants.push({ kind: "dedicatedMobile", width: maxWidthFor(file), budget: webpBudgetKbFor(file) });
      if (optimizer.shouldCreateAvif(file)) {
        variants.push({ kind: "dedicatedMobileAvif", width: maxWidthFor(file), budget: avifBudgetKbFor(file), format: "avif" });
      }
    }
    if (!variants.length) continue;
    const original = await readFile(path.join(sourceRoot, file));
    const source = await sharp(original).metadata();
    for (const variant of variants) {
      const pipeline = sharp(original).rotate().resize({ width: variant.width, fit: "inside", withoutEnlargement: true });
      const { data, info } = variant.format === "avif"
        ? await pipeline.avif({ quality: optimizer.avifQualityStepsFor(file).at(-1), effort: 6 }).toBuffer({ resolveWithObject: true })
        : await pipeline.webp({ quality: 70, effort: 6, smartSubsample: true }).toBuffer({ resolveWithObject: true });
      const width = Math.min(source.width, variant.width);
      assert.deepEqual([info.width, info.height], [width, Math.round(source.height * width / source.width)], file);
      record(variant.kind, file, data.length, variant.budget);
    }
    assert.ok((await readFile(path.join(sourceRoot, file))).equals(original), `${file}: source bytes unchanged`);
  }

  for (const variant of criticalMobileVariants) {
    const sourcePath = fileURLToPath(new URL(`../${variant.source}`, import.meta.url));
    const original = await readFile(sourcePath);
    const pipeline = sharp(original).resize({
      width: variant.width,
      ...(variant.height ? { height: variant.height, fit: "cover", position: variant.position ?? "centre" } : {}),
      withoutEnlargement: true,
    });
    const data = variant.format === "webp"
      ? await pipeline.webp({ quality: 78, effort: 6, smartSubsample: true }).toBuffer()
      : await pipeline.avif({ quality: 55, effort: 7, chromaSubsampling: "4:2:0" }).toBuffer();
    record("criticalMobile", variant.output, data.length, (variant.maxBytes ?? 120 * 1024) / 1024);
    assert.ok((await readFile(sourcePath)).equals(original), `${variant.source}: source bytes unchanged`);
  }

  t.diagnostic(`In-memory derivative preflight: ${JSON.stringify(counts)}`);
  for (const [kind, item] of largest) t.diagnostic(`${kind} largest: ${JSON.stringify(item)}`);
  assert.deepEqual(failures, [], `All derivative budget failures:\n${failures.join("\n")}`);

  function record(kind, file, bytes, budget) {
    counts[kind] += 1;
    const kib = Number((bytes / 1024).toFixed(2));
    if (!largest.has(kind) || bytes > largest.get(kind).bytes) largest.set(kind, { file, bytes, kib, budget });
    if (bytes > budget * 1024) failures.push(`${kind} ${file}: ${kib} KiB exceeds ${budget} KiB`);
  }
});

test("CLI completes other files and reports every worker failure while remaining fail-closed", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sourceRoot = path.join(root, "assets/game-art-source");
  await mkdir(sourceRoot, { recursive: true });
  const broken = ["a-broken.png", "b-broken.png", "c-broken.png", "d-broken.png"];
  for (const file of broken) await writeFile(path.join(sourceRoot, file), "invalid image bytes");
  const original = await sharp({ create: { width: 64, height: 96, channels: 3, background: "#7298ab" } }).png().toBuffer();
  await writeFile(path.join(sourceRoot, "z-valid.png"), original);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./optimize-assets.mjs", import.meta.url))], {
    cwd: root, encoding: "utf8", windowsHide: true, timeout: 30_000,
    env: { ...process.env, WEBP_QUALITY: "82", ASSET_FILE_CONCURRENCY: "2" },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  for (const file of broken) {
    assert.ok(result.stderr.includes(file), `${file}: failure reported`);
    assert.equal(await readFile(path.join(sourceRoot, file), "utf8"), "invalid image bytes");
  }
  assert.match(result.stderr, /4 assets failed/);
  assert.match(result.stdout, /Processed 5\/5/);
  const output = await sharp(await readFile(path.join(root, "apps/web/public/game-art/z-valid.webp"))).metadata();
  assert.deepEqual([output.width, output.height], [64, 96]);
  assert.ok((await readFile(path.join(sourceRoot, "z-valid.png"))).equals(original));
});

test("CLI preserves an over-500-KiB master byte-for-byte across repeated exports", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sourceRoot = path.join(root, "assets/game-art-source");
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(path.join(root, "apps/web/public/game-art"), { recursive: true });
  const input = path.join(sourceRoot, "role-restored.png");
  const original = await sharp({ create: { width: 1200, height: 1800, channels: 3, background: "#7298ab" } })
    .png({ compressionLevel: 0 }).toBuffer();
  assert.ok(original.length > 500 * 1024);
  await writeFile(input, original);
  const sentinel = path.join(sourceRoot, "master.tmp-123.png");
  await writeFile(sentinel, await sharp({ create: { width: 64, height: 96, channels: 3, background: "#7298ab" } }).png().toBuffer());
  for (const pass of [1, 2]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./optimize-assets.mjs", import.meta.url))], {
      cwd: root, encoding: "utf8", windowsHide: true, timeout: 30_000,
      env: { ...process.env, WEBP_QUALITY: "82", ASSET_FILE_CONCURRENCY: "1" },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok((await readFile(input)).equals(original), `pass ${pass}: master bytes`);
    assert.ok(existsSync(sentinel), "source cleanup must not delete source-directory files");
    const full = await sharp(path.join(root, "apps/web/public/game-art/role-restored.webp")).metadata();
    assert.deepEqual([full.width, full.height], [1100, 1650]);
    const small = await sharp(path.join(root, "apps/web/public/game-art/master.tmp-123.webp")).metadata();
    assert.deepEqual([small.width, small.height], [64, 96], "small sources are never enlarged");
  }
  const report = spawnSync(process.execPath, [fileURLToPath(new URL("./optimize-assets.mjs", import.meta.url)), "--report-only"], {
    cwd: root, encoding: "utf8", windowsHide: true,
  });
  assert.equal(report.status, 0, report.stderr);
  const columns = report.stdout.trim().split(/\r?\n/)[0].split(",");
  const row = report.stdout.trim().split(/\r?\n/).find((line) => line.startsWith('"role-restored.png"')).split(",");
  assert.equal(row[columns.indexOf("png_budget_kb")], "0");
  assert.equal(row[columns.indexOf("status")], "ok", "master size is not a delivery budget");
});

test("keeps the published metadata PNG budget separate from UI image budgets", () => {
  assert.equal(typeof optimizer.publishedPngBudgetKbFor, "function");
  for (const file of ["og/og-home.png", "og/og-leaderboard.png", "og/og-werewolf.png", "legal/privacy-banner.png"]) {
    assert.equal(optimizer.publishedPngBudgetKbFor(file), 500);
  }
  assert.equal(optimizer.publishedPngBudgetKbFor("role-seer.png"), 0);
  assert.equal(webpBudgetKbFor("bg-night-phase.png"), 400);
});

test("publishes bounded metadata PNG derivatives without changing oversized masters", async (t) => {
  const root = await temporaryAssetRoot(t);
  const files = ["legal/privacy-banner.png", "og/og-default.png"];
  const original = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: "#a37eac" } })
    .png({ compressionLevel: 0 }).toBuffer();
  for (const file of files) {
    const source = path.join(root, "assets/game-art-source", file);
    await mkdir(path.dirname(source), { recursive: true });
    await writeFile(source, original);
  }
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./optimize-assets.mjs", import.meta.url))], {
    cwd: root, encoding: "utf8", windowsHide: true, timeout: 60_000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const file of files) {
    assert.ok((await readFile(path.join(root, "assets/game-art-source", file))).equals(original));
    const published = await readFile(path.join(root, "apps/web/public/game-art", file));
    const metadata = await sharp(published).metadata();
    assert.equal(metadata.format, "png");
    assert.ok(metadata.width <= 1280 && metadata.height <= 1280);
    assert.ok(published.length <= 500 * 1024);
    if (file.startsWith("og/")) assert.ok(metadata.width <= 1200 && metadata.height <= 630);
  }
  const report = spawnSync(process.execPath, [fileURLToPath(new URL("./optimize-assets.mjs", import.meta.url)), "--report-only"], {
    cwd: root, encoding: "utf8", windowsHide: true,
  });
  assert.equal(report.status, 0, report.stderr);
  const [header, ...rows] = report.stdout.trim().split(/\r?\n/).map((line) => line.split(","));
  for (const row of rows) {
    assert.equal(row[header.indexOf("png_budget_kb")], "0");
    assert.equal(row[header.indexOf("runtime_png_budget_kb")], "500");
    assert.equal(row[header.indexOf("status")], "ok");
  }
});

test("encodes at the quality floor without shrinking dimensions or modifying the input", async (t) => {
  assert.equal(typeof optimizer.writeWebp, "function");
  const root = await temporaryAssetRoot(t);
  const input = path.join(root, "role.png");
  const output = path.join(root, "role.webp");
  const original = await sharp({ create: { width: 1024, height: 1536, channels: 3, background: "#846891" } }).png().toBuffer();
  await writeFile(input, original);
  await optimizer.writeWebp(sharp, input, output, "role-seer.png", 1100, 220, 34);
  const encoded = await readFile(output);
  const expected = await sharp(original).rotate().resize({ width: 1100, withoutEnlargement: true })
    .webp({ quality: 70, effort: 6, smartSubsample: true }).toBuffer();
  assert.ok(encoded.equals(expected), "an override below Q70 is clamped to Q70");
  const metadata = await sharp(encoded).metadata();
  assert.deepEqual([metadata.width, metadata.height], [1024, 1536]);
  assert.ok((await readFile(input)).equals(original));
  await assert.rejects(optimizer.writeWebp(sharp, input, input, "role-seer.png", 1100, 220), /source|input|master/i);
  assert.ok((await readFile(input)).equals(original));
});

async function temporaryAssetRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), "asset-quality-"));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith("asset-quality-"));
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

test("keeps dedicated mobile light heroes compact without changing their portrait crop", () => {
  for (const family of ["werewolf", "mafia"]) {
    const file = `mobile/${family}/bg-hero-light-v1.png`;

    assert.equal(maxWidthFor(file), 1152);
    assert.equal(avifBudgetKbFor(file), 256);
    assert.equal(webpBudgetKbFor(file), 384);
  }
});

test("does not overwrite a dedicated mobile source with a desktop derivative", () => {
  const sources = new Set([
    "werewolf/bg-hero-light-v1.png",
    "mobile/werewolf/bg-hero-light-v1.png",
  ]);

  assert.equal(
    mobileDerivativePathFor("werewolf/bg-hero-light-v1.png", sources),
    null,
  );
  assert.equal(
    mobileDerivativePathFor("werewolf/bg-hero-v2.png", sources),
    "mobile/werewolf/bg-hero-v2.webp",
  );
});

test("keeps homepage choice v2 compact without changing v1 or unrelated assets", () => {
  for (const family of ["werewolf", "mafia"]) {
    for (const file of [`homepage/choice-${family}-v2.png`, path.join("homepage", `choice-${family}-v2.png`)]) {
      assert.equal(maxWidthFor(file), 1536);
      assert.equal(webpBudgetKbFor(file), 384);
      assert.equal(mobileBudgetKbFor(file), 220);
    }
    assert.equal(maxWidthFor(`homepage/choice-${family}-v1.png`), 1920);
    assert.equal(webpBudgetKbFor(`homepage/choice-${family}-v1.png`), 360);
    assert.equal(mobileBudgetKbFor(`homepage/choice-${family}-v1.png`), 180);
  }

  for (const file of ["other/choice-mafia-v2.png", "homepage/choice-other-v2.png", "homepage/choice-mafia-v4.png"]) {
    assert.equal(maxWidthFor(file), 1920);
    assert.equal(webpBudgetKbFor(file), 360);
    assert.equal(mobileBudgetKbFor(file), 180);
  }
});

test("creates mobile derivatives only for the supported homepage choice masters", () => {
  for (const version of ["v1", "v2", "v3"]) {
    for (const family of ["werewolf", "mafia"]) {
      const file = `homepage/choice-${family}-${version}.png`;
      for (const input of [file, path.join("homepage", `choice-${family}-${version}.png`)]) {
        assert.equal(mobileDerivativePathFor(input, new Set([file])), `mobile/${file.replace(/\.png$/, ".webp")}`);
      }
    }
  }

  for (const file of [
    "choice-werewolf-v1.png",
    "other/choice-mafia-v1.png",
    "homepage/nested/choice-mafia-v1.png",
    "homepage/choice-other-v1.png",
    "homepage/choice-werewolf-v4.png",
    "choice-werewolf-v2.png",
    "other/choice-mafia-v2.png",
    "homepage/nested/choice-mafia-v2.png",
    "homepage/choice-other-v2.png",
    "homepage/choice-mafia-v20.png",
    "homepage/choice-mafia-v2-extra.png",
    "homepage/choice-mafia-v2.png.bak",
    "mobile/homepage/choice-mafia-v2.png",
    "homepage/choice-mafia-v1-extra.png",
    "homepage/choice-mafia-v1.png.bak",
    "mobile/homepage/choice-mafia-v1.png",
  ]) {
    assert.equal(mobileDerivativePathFor(file, new Set([file])), null, file);
  }
});

test("respects dedicated mobile sources for homepage choice art", () => {
  for (const version of ["v1", "v2", "v3"]) {
    for (const family of ["werewolf", "mafia"]) {
      const file = `homepage/choice-${family}-${version}.png`;
      assert.equal(mobileDerivativePathFor(file, new Set([file, `mobile/${file}`])), null);
    }
  }
});

test("keeps new story art and the light invitation within their existing family budgets", () => {
  for (const family of ["werewolf", "mafia"]) {
    const file = `homepage/choice-${family}-v3.png`;
    assert.equal(maxWidthFor(file), 1536);
    assert.equal(webpBudgetKbFor(file), 384);
    assert.equal(mobileBudgetKbFor(file), 220);
  }
  const file = "homepage/invitation-light-v1.png";
  assert.equal(maxWidthFor(file), 1536);
  assert.equal(webpBudgetKbFor(file), 130);
  assert.equal(mobileBudgetKbFor(file), 45);
  assert.equal(mobileDerivativePathFor(file, new Set([file])), "mobile/homepage/invitation-light-v1.webp");
  assert.equal(mobileDerivativePathFor(file, new Set([file, `mobile/${file}`])), null);
});

test("keeps versioned theme-specific choice illustrations compact and mobile-ready", () => {
  for (const family of ["werewolf", "mafia"]) {
    for (const variant of ["dark-v4", "light-v4", "dark-v5", "light-v5"]) {
      const file = `homepage/choice-${family}-${variant}.png`;
      for (const input of [file, path.join("homepage", path.basename(file))]) {
        assert.equal(maxWidthFor(input), 1536);
        assert.equal(webpBudgetKbFor(input), 384);
        assert.equal(mobileBudgetKbFor(input), 220);
        assert.equal(mobileDerivativePathFor(input, new Set([file])), `mobile/${file.replace(/\.png$/, ".webp")}`);
        assert.equal(mobileDerivativePathFor(input, new Set([file, `mobile/${file}`])), null);
      }
    }
  }
  for (const file of ["homepage/choice-mafia-dark-v6.png", "homepage/choice-mafia-system-v4.png", "other/choice-mafia-dark-v4.png"]) {
    assert.equal(maxWidthFor(file), 1920);
    assert.equal(mobileDerivativePathFor(file, new Set([file])), null);
  }
});

for (const version of ["v6", "v7"]) {
  test(`keeps only themed Werewolf ${version} choice art compact and mobile-ready`, () => {
    for (const theme of ["dark", "light"]) {
      const file = `homepage/choice-werewolf-${theme}-${version}.png`;
      for (const input of [file, path.join("homepage", path.basename(file))]) {
        assert.equal(maxWidthFor(input), 1536, input);
        assert.equal(webpBudgetKbFor(input), 384, input);
        assert.equal(mobileBudgetKbFor(input), 220, input);
        assert.equal(mobileDerivativePathFor(input, new Set([file])), `mobile/${file.replace(/\.png$/, ".webp")}`, input);
        assert.equal(mobileDerivativePathFor(input, new Set([file, `mobile/${file}`])), null, input);
      }
    }
  });
}

test("rejects unsupported families, paths and future versions from the Werewolf v6/v7 policy", () => {
  const unsupported = [];
  for (const version of ["v6", "v7"]) {
    unsupported.push(
      `homepage/choice-werewolf-${version}.png`,
      `homepage/choice-mafia-${version}.png`,
      `homepage/choice-werewolf-system-${version}.png`,
    );
    for (const theme of ["dark", "light"]) {
      unsupported.push(
        `homepage/choice-mafia-${theme}-${version}.png`,
        `homepage/choice-other-${theme}-${version}.png`,
        `choice-werewolf-${theme}-${version}.png`,
        `other/choice-werewolf-${theme}-${version}.png`,
        `homepage/nested/choice-werewolf-${theme}-${version}.png`,
        `mobile/homepage/choice-werewolf-${theme}-${version}.png`,
        `homepage/choice-werewolf-${theme}-${version}0.png`,
        `homepage/choice-werewolf-${theme}-${version}-extra.png`,
        `homepage/choice-werewolf-${theme}-${version}.png.bak`,
      );
    }
  }
  for (const theme of ["dark", "light"]) {
    unsupported.push(
      `homepage/choice-werewolf-${theme}-v8.png`,
      `homepage/choice-mafia-${theme}-v8.png`,
    );
  }
  for (const file of unsupported) {
    for (const input of [file, path.join(...file.split("/"))]) {
      assert.equal(maxWidthFor(input), 1920, input);
      assert.equal(webpBudgetKbFor(input), 360, input);
      assert.equal(mobileBudgetKbFor(input), 180, input);
      assert.equal(mobileDerivativePathFor(input, new Set([file])), null, input);
    }
  }
});

test("recreates native desktop and high-resolution mobile WebPs from repository masters in isolation", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "homepage-choice-"));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith("homepage-choice-"));
    await rm(root, { recursive: true, force: true });
  });
  const sourceRoot = path.join(root, "assets/game-art-source/homepage");
  const outputRoot = path.join(root, "apps/web/public/game-art");
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(outputRoot, { recursive: true });
  const originals = new Map();
  // The masters the homepage actually ships; superseded choice versions were retired from the repo.
  for (const file of [
    "choice-mafia-dark-v5.png",
    "choice-mafia-light-v5.png",
    "choice-werewolf-dark-v7.png",
    "choice-werewolf-light-v7.png",
  ]) {
    const source = new URL(`../assets/game-art-source/homepage/${file}`, import.meta.url);
    originals.set(file, await readFile(source));
    await copyFile(source, path.join(sourceRoot, file));
  }

  const runOptimizer = () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./optimize-assets.mjs", import.meta.url))], {
      cwd: root,
      env: { ...process.env, WEBP_QUALITY: "82", ASSET_FILE_CONCURRENCY: "1" },
      encoding: "utf8",
      timeout: 60_000,
      windowsHide: true,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  };

  runOptimizer();
  const firstOutputs = new Map();
  for (const [file, original] of originals) {
    const isCompact = /-(?:v[23]|(?:dark|light)-v[45])\.png$/.test(file)
      || /^choice-werewolf-(?:dark|light)-v[67]\.png$/.test(file);
    assert.ok((await readFile(path.join(sourceRoot, file))).equals(original), `${file}: source unchanged`);
    const sourceMetadata = await sharp(original).metadata();
    assert.equal(sourceMetadata.format, "png");
    const relative = `mobile/homepage/${file.replace(/\.png$/, ".webp")}`;
    const output = path.join(outputRoot, relative);
    assert.ok(existsSync(output), `${relative}: mobile derivative is generated`);
    const encoded = await readFile(output);
    const { width, height, format } = await sharp(encoded).metadata();
    const mobileWidth = Math.min(sourceMetadata.width, isCompact ? 1080 : 720);
    assert.deepEqual({ width, height, format }, { width: mobileWidth, height: Math.round(sourceMetadata.height * mobileWidth / sourceMetadata.width), format: "webp" });
    const { size } = await stat(output);
    assert.ok(size > 0 && size < (isCompact ? 220 * 1024 : 180 * 1024), `${relative}: within mobile budget`);
    t.diagnostic(`${relative}: ${width}x${height}, ${size} bytes`);
    firstOutputs.set(relative, encoded);
    const full = `homepage/${file.replace(/\.png$/, ".webp")}`;
    const fullEncoded = await readFile(path.join(outputRoot, full));
    const fullMetadata = await sharp(fullEncoded).metadata();
    assert.deepEqual(
      { width: fullMetadata.width, height: fullMetadata.height, format: fullMetadata.format },
      { width: Math.min(sourceMetadata.width, isCompact ? 1536 : 1920), height: Math.round(sourceMetadata.height * Math.min(sourceMetadata.width, isCompact ? 1536 : 1920) / sourceMetadata.width), format: "webp" },
    );
    assert.ok(fullEncoded.length > 0 && fullEncoded.length < (isCompact ? 384 * 1024 : 360 * 1024), `${full}: within desktop budget`);
    t.diagnostic(`${full}: ${fullMetadata.width}x${fullMetadata.height}, ${fullEncoded.length} bytes`);
    firstOutputs.set(full, fullEncoded);
    await rm(output);
  }

  runOptimizer();
  for (const [relative, expected] of firstOutputs) {
    assert.deepEqual(await readFile(path.join(outputRoot, relative)), expected, `${relative}: reproducible`);
  }
  const generatedFiles = (await readdir(outputRoot, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(outputRoot, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"));
  assert.deepEqual(generatedFiles.sort(), [...firstOutputs.keys()].sort());
});

test("applies panoramic invitation dimensions and budgets only to its exact source path", () => {
  const file = "homepage/invitation-v1.png";
  for (const input of [file, path.join("homepage", "invitation-v1.png")]) {
    assert.equal(maxWidthFor(input), 1536);
    assert.equal(webpBudgetKbFor(input), 130);
    assert.equal(mobileBudgetKbFor(input), 45);
    assert.equal(mobileDerivativePathFor(input, new Set([file])), "mobile/homepage/invitation-v1.webp");
    assert.equal(mobileDerivativePathFor(input, new Set([file, `mobile/${file}`])), null);
  }

  for (const input of [
    "invitation-v1.png",
    "other/invitation-v1.png",
    "homepage/nested/invitation-v1.png",
    "homepage/invitation-v2.png",
    "homepage/invitation-v10.png",
    "homepage/invitation-v1-extra.png",
    "homepage/invitation-v1.png.bak",
    "mobile/homepage/invitation-v1.png",
  ]) {
    assert.equal(maxWidthFor(input), 1920, input);
    assert.equal(webpBudgetKbFor(input), 360, input);
    assert.equal(mobileBudgetKbFor(input), 180, input);
    assert.equal(mobileDerivativePathFor(input, new Set([input])), null, input);
  }
});

test("reproduces the dark invitation without changing its master", (t) => verifyInvitationReproduction(t, "invitation-v1"));
test("reproduces the light invitation without changing its master", (t) => verifyInvitationReproduction(t, "invitation-light-v1"));

async function verifyInvitationReproduction(t, invitation) {
  const root = await mkdtemp(path.join(tmpdir(), "homepage-invitation-"));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith("homepage-invitation-"));
    await rm(root, { recursive: true, force: true });
  });
  const sourceRoot = path.join(root, "assets/game-art-source/homepage");
  const outputRoot = path.join(root, "apps/web/public/game-art");
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(outputRoot, { recursive: true });
  const source = new URL(`../assets/game-art-source/homepage/${invitation}.png`, import.meta.url);
  const original = await readFile(source);
  const staged = path.join(sourceRoot, `${invitation}.png`);
  await copyFile(source, staged);
  const metadata = await sharp(original).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width / metadata.height, 3, "native panoramic master keeps its aspect ratio");
  assert.ok(metadata.width >= 1536);

  const outputs = new Map();
  for (const pass of [1, 2]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./optimize-assets.mjs", import.meta.url))], {
      cwd: root,
      env: { ...process.env, WEBP_QUALITY: "82", ASSET_FILE_CONCURRENCY: "1" },
      encoding: "utf8",
      timeout: 60_000,
      windowsHide: true,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok((await readFile(staged)).equals(original), `pass ${pass}: source unchanged`);

    for (const [relative, width, height, budget] of [
      [`homepage/${invitation}.webp`, 1536, 512, 130 * 1024],
      [`mobile/homepage/${invitation}.webp`, 960, 320, 45 * 1024],
    ]) {
      const file = path.join(outputRoot, relative);
      const encoded = await readFile(file);
      const actual = await sharp(encoded).metadata();
      assert.deepEqual([actual.width, actual.height, actual.format], [width, height, "webp"]);
      assert.ok(encoded.length > 0 && encoded.length <= budget, `${relative}: within budget`);
      if (pass === 1) {
        outputs.set(relative, encoded);
        t.diagnostic(`${relative}: ${width}x${height}, ${encoded.length} bytes`);
        await rm(file);
      } else {
        assert.deepEqual(encoded, outputs.get(relative), `${relative}: reproducible`);
      }
    }
  }

  const generatedFiles = (await readdir(outputRoot, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(outputRoot, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"));
  assert.deepEqual(generatedFiles.sort(), [...outputs.keys()].sort());
}

test("detects missing and mismatched dedicated mobile WebP derivatives in isolation", async (t) => {
  const root = await temporaryAssetRoot(t);
  const sourceRoot = path.join(root, "source");
  const outputRoot = path.join(root, "output");
  await mkdir(path.join(sourceRoot, "mobile"), { recursive: true });
  await mkdir(path.join(outputRoot, "mobile"), { recursive: true });
  const source = path.join(sourceRoot, "mobile/bg-hero.png");
  const output = path.join(outputRoot, "mobile/bg-hero.webp");
  await sharp({ create: { width: 64, height: 96, channels: 3, background: "#7298ab" } }).png().toFile(source);
  const inspect = (expectedDimensions) => inspectMobileDerivativeConflicts({
    sourceRoot, outputRoot, imageMetadata: (file) => sharp(file).metadata(), expectedDimensions,
  });
  assert.deepEqual(await inspect(), ["bg-hero.png: missing WebP derivative"]);
  await sharp(source).resize({ width: 32 }).webp().toFile(output);
  assert.deepEqual(await inspect(), ["bg-hero.png: expected 64x96, WebP 32x48"]);
  assert.deepEqual(await inspect(new Map([["bg-hero.png", { width: 32, height: 48 }]])), []);
  await sharp(source).webp().toFile(output);
  assert.deepEqual(await inspect(), []);
});
