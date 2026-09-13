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
  mobileDerivativePathFor,
  webpBudgetKbFor,
} from "./optimize-assets.mjs";

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
      const file = `${directory}/table-inlay-${family}-v1.png`;
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

test("preserves restored master resolution within category limits", () => {
  assert.equal(maxWidthFor("bg-night-phase.png"), 2560);
  assert.equal(maxWidthFor("auth/account-dossier.png"), 1920);
  assert.equal(maxWidthFor("homepage/choice-werewolf-light-v7.png"), 1536);
  assert.equal(maxWidthFor("role-seer.png"), 1100);
  assert.equal(maxWidthFor("faction-village.png"), 1920);
  assert.equal(webpBudgetKbFor("faction-village.png"), 360);
  assert.equal(webpBudgetKbFor("bg-night-phase.png"), 400);
  assert.equal(webpBudgetKbFor("icon-ability-bless.png"), 220);
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
  for (const version of ["v1", "v2", "v3", "dark-v4", "light-v4", "dark-v5", "light-v5"]) {
    for (const family of ["werewolf", "mafia"]) {
      const file = `choice-${family}-${version}.png`;
      const source = new URL(`../assets/game-art-source/homepage/${file}`, import.meta.url);
      originals.set(file, await readFile(source));
      await copyFile(source, path.join(sourceRoot, file));
    }
  }
  for (const version of ["v6", "v7"]) {
    for (const theme of ["dark", "light"]) {
      const file = `choice-werewolf-${theme}-${version}.png`;
      const source = new URL(`../assets/game-art-source/homepage/${file}`, import.meta.url);
      originals.set(file, await readFile(source));
      await copyFile(source, path.join(sourceRoot, file));
    }
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
