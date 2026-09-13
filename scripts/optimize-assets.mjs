import { existsSync } from "node:fs";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import sharp from "sharp";

const sourceArtDir = path.resolve("assets/game-art-source");
const gameArtDir = path.resolve("apps/web/public/game-art");
const quality = Number(process.env.WEBP_QUALITY ?? 82);

const DERIVATIVE_DIRS = new Set(["thumbs"]);
const PUBLIC_METADATA_PNGS = new Set([
  "legal/faq-hearth-banner.png",
  "legal/privacy-banner.png",
  "legal/report-banner.png",
  "legal/status-banner.png",
  "legal/terms-banner.png",
]);

async function main() {
  // --only takes repeatable, exact PNG paths relative to assets/game-art-source.
  const { values } = parseArgs({ options: {
    "report-only": { type: "boolean" },
    only: { type: "string", multiple: true },
  } });
  const reportOnly = values["report-only"];
  if (!existsSync(sourceArtDir)) {
    throw new Error("Липсва assets/game-art-source. PNG master-ите не трябва да живеят в public.");
  }

  sharp.cache(false);
  if (process.platform === "win32") {
    sharp.concurrency(1);
  }
  const allFiles = await listPngs(sourceArtDir);
  const sourceFiles = new Set(allFiles.map(normalizeAssetPath));
  const selected = values.only && new Set(values.only.map((file) => file.replaceAll("\\", "/")));
  for (const file of selected ?? []) {
    if (!sourceFiles.has(file)) throw new Error(`Unknown source asset for --only: ${JSON.stringify(file)}`);
  }
  const files = selected ? allFiles.filter((file) => selected.has(normalizeAssetPath(file))) : allFiles;

  if (reportOnly) {
    await printReport(files);
    return;
  }

  await mkdir(gameArtDir, { recursive: true });
  if (!selected) await cleanupTemporaryArtifacts(gameArtDir);

  const fileConcurrency = readPositiveInteger(
    process.env.ASSET_FILE_CONCURRENCY,
    process.platform === "win32" ? 2 : 4,
  );
  let completed = 0;
  const results = await mapWithConcurrency(files, fileConcurrency, async (file) => {
    try {
      return await optimizeAsset(sharp, file, sourceFiles);
    } finally {
      completed += 1;
      if (completed % 25 === 0 || completed === files.length) {
        console.log(`Processed ${completed}/${files.length} source assets.`);
      }
    }
  });

  let originalBytes = 0;
  let optimizedBytes = 0;
  let written = 0;
  let avifBytes = 0;
  let avifsWritten = 0;
  let publishedPngBytes = 0;
  let publishedPngs = 0;
  let thumbnailBytes = 0;
  let thumbnailsWritten = 0;
  let mobileBytes = 0;
  let mobileWritten = 0;

  for (const result of results) {
    originalBytes += result.originalBytes;
    optimizedBytes += result.optimizedBytes;
    written += result.written;
    avifBytes += result.avifBytes;
    avifsWritten += result.avifsWritten;
    publishedPngBytes += result.publishedPngBytes;
    publishedPngs += result.publishedPngs;
    thumbnailBytes += result.thumbnailBytes;
    thumbnailsWritten += result.thumbnailsWritten;
    mobileBytes += result.mobileBytes;
    mobileWritten += result.mobileWritten;
  }

  console.log(
    `Optimized ${written} assets. Source PNG: ${formatBytes(originalBytes)} (unchanged, excluded from runtime budgets); runtime WebP: ${formatBytes(optimizedBytes)}.`,
  );
  console.log(
    `Published ${publishedPngs} metadata PNGs ` +
      `(${formatBytes(publishedPngBytes)}) and ${avifsWritten} AVIF assets (${formatBytes(avifBytes)}).`,
  );
  console.log(
    `Generated ${thumbnailsWritten} role thumbnails (${formatBytes(thumbnailBytes)}) and ${mobileWritten} mobile assets (${formatBytes(mobileBytes)}).`,
  );
}

async function cleanupTemporaryArtifacts(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await cleanupTemporaryArtifacts(absolute);
        return;
      }
      if (entry.isFile() && /\.tmp-\d+(?:[-.]|$)/.test(entry.name)) {
        await rm(absolute, { force: true });
      }
    }),
  );
}

async function optimizeAsset(sharp, file, sourceFiles) {
  const input = path.join(sourceArtDir, file);
  const before = (await stat(input)).size;
  const publicPng = path.join(gameArtDir, file);
  let publishedPngBytes = 0;
  let publishedPngs = 0;
  if (shouldPublishPng(file)) {
    await writeRasterWithBudget({
      sharp, input, output: publicPng,
      maxWidth: isOpenGraphSource(file) ? 1200 : 1280,
      maxHeight: isOpenGraphSource(file) ? 630 : 1280,
      budgetKb: publishedPngBudgetKbFor(file),
      qualities: [90, 85, 80],
      encode: (pipeline, q) => pipeline.png({ compressionLevel: 9, palette: true, quality: q, effort: 10, adaptiveFiltering: true }),
    });
    publishedPngBytes = (await stat(publicPng)).size;
    publishedPngs = 1;
  } else {
    await rm(publicPng, { force: true });
  }

  const output = path.join(gameArtDir, file.replace(/\.png$/, ".webp"));
  const createWebp = shouldCreateWebp(file);
  if (createWebp) {
    await writeWebp(sharp, input, output, file, maxWidthFor(file), webpBudgetKbFor(file));
  } else {
    await rm(output, { force: true });
  }
  const optimizedBytes = createWebp ? (await stat(output)).size : 0;
  let avifBytes = 0;
  let avifsWritten = 0;
  let thumbnailBytes = 0;
  let thumbnailsWritten = 0;
  let mobileBytes = 0;
  let mobileWritten = 0;

  if (shouldCreateAvif(file)) {
    const avifOutput = path.join(gameArtDir, file.replace(/\.png$/, ".avif"));
    await writeAvif(sharp, input, avifOutput, file, maxWidthFor(file), avifBudgetKbFor(file));
    avifBytes = (await stat(avifOutput)).size;
    avifsWritten = 1;
  } else if (isOpenGraphSource(file)) {
    await rm(path.join(gameArtDir, file.replace(/\.png$/, ".avif")), { force: true });
  }

  if (shouldCreateRoleThumbnail(file)) {
    const thumbOutput = path.join(gameArtDir, "thumbs", file.replace(/\.png$/, ".webp"));
    await mkdir(path.dirname(thumbOutput), { recursive: true });
    await writeWebp(sharp, input, thumbOutput, file, 520, thumbnailBudgetKbFor(file), 74);
    thumbnailBytes = (await stat(thumbOutput)).size;
    thumbnailsWritten = 1;
  }

  const mobileDerivativePath = mobileDerivativePathFor(file, sourceFiles);
  const mobileWidth = mobileDerivativePath ? mobileWidthFor(file) : 0;
  if (mobileDerivativePath && mobileWidth) {
    const mobileOutput = path.join(gameArtDir, mobileDerivativePath);
    await mkdir(path.dirname(mobileOutput), { recursive: true });
    await writeWebp(sharp, input, mobileOutput, file, mobileWidth, mobileBudgetKbFor(file), 78);
    mobileBytes = (await stat(mobileOutput)).size;
    mobileWritten = 1;
    if (isPlaySceneV2(file)) {
      const mobileAvifOutput = mobileOutput.replace(/\.webp$/, ".avif");
      await writeAvif(sharp, input, mobileAvifOutput, `mobile/${normalizeAssetPath(file)}`, mobileWidth, mobileBudgetKbFor(file));
      mobileBytes += (await stat(mobileAvifOutput)).size;
      mobileWritten += 1;
    }
  }

  return {
    originalBytes: before,
    optimizedBytes,
    written: createWebp ? 1 : 0,
    avifBytes,
    avifsWritten,
    publishedPngBytes,
    publishedPngs,
    thumbnailBytes,
    thumbnailsWritten,
    mobileBytes,
    mobileWritten,
  };
}

async function mapWithConcurrency(values, concurrency, worker) {
  const results = new Array(values.length);
  const failures = new Array(values.length);
  let nextIndex = 0;

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await worker(values[index], index);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures[index] = new Error(`${normalizeAssetPath(values[index])}: ${message}`, { cause: error });
      }
    }
  }));

  const errors = failures.filter(Boolean);
  if (errors.length) {
    throw new AggregateError(errors, `${errors.length} assets failed:\n${errors.map((error) => error.message).join("\n")}`);
  }
  return results;
}

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function printReport(files) {
  console.log(
    [
      "path",
      "png_kb",
      "webp_kb",
      "avif_kb",
      "png_budget_kb",
      "webp_budget_kb",
      "avif_budget_kb",
      "status",
      "runtime_png_kb",
      "runtime_png_budget_kb",
    ].join(","),
  );

  for (const file of files) {
    const pngKb = await fileKb(path.join(sourceArtDir, file));
    const webpKb = shouldCreateWebp(file)
      ? await fileKb(path.join(gameArtDir, file.replace(/\.png$/, ".webp")))
      : 0;
    const avifKb = await fileKb(path.join(gameArtDir, file.replace(/\.png$/, ".avif")));
    const pngBudget = 0;
    const runtimePngKb = shouldPublishPng(file) ? await fileKb(path.join(gameArtDir, file)) : 0;
    const runtimePngBudget = publishedPngBudgetKbFor(file);
    const webpBudget = shouldCreateWebp(file) ? webpBudgetKbFor(file) : 0;
    const avifBudget = shouldCreateAvif(file) ? avifBudgetKbFor(file) : 0;
    const overBudget = [
      runtimePngBudget > 0 && runtimePngKb > runtimePngBudget,
      webpBudget > 0 && webpKb > webpBudget,
      avifBudget > 0 && avifKb > avifBudget,
    ].some(Boolean);

    console.log(
      [
        csv(file.split(path.sep).join("/")),
        pngKb.toFixed(1),
        webpKb.toFixed(1),
        avifKb.toFixed(1),
        pngBudget,
        webpBudget,
        avifBudget,
        overBudget ? "over-budget" : "ok",
        runtimePngKb.toFixed(1),
        runtimePngBudget,
      ].join(","),
    );
  }
}

export async function writeWebp(sharp, input, output, file, maxWidth, budgetKb, preferredQuality = quality) {
  await writeRasterWithBudget({
    sharp,
    input,
    output,
    maxWidth,
    budgetKb,
    qualities: webpQualityStepsFor(file, { preferredQuality }),
    encode: (pipeline, q) => pipeline.webp({ quality: q, effort: 6, smartSubsample: true }),
  });
}

export async function writeAvif(sharp, input, output, file, maxWidth, budgetKb) {
  await writeRasterWithBudget({
    sharp,
    input,
    output,
    maxWidth,
    budgetKb,
    qualities: avifQualityStepsFor(file),
    encode: (pipeline, q) => pipeline.avif({ quality: q, effort: 6 }),
  });
}

async function writeRasterWithBudget({ sharp, input, output, maxWidth, maxHeight, budgetKb, qualities, encode }) {
  const sourceRelative = path.relative(sourceArtDir, path.resolve(output));
  if (path.resolve(input) === path.resolve(output)
    || (!sourceRelative.startsWith(`..${path.sep}`) && sourceRelative !== ".." && !path.isAbsolute(sourceRelative))) {
    throw new Error(`Refusing to write a runtime derivative over a source master: ${output}`);
  }
  await mkdir(path.dirname(output), { recursive: true });
  const tmp = `${output}.tmp-${process.pid}${path.extname(output)}`;
  let bestBytes = Number.POSITIVE_INFINITY;
  try {
    for (const q of qualities) {
      const pipeline = sharp(input, { limitInputPixels: false }).rotate()
        .resize({ width: maxWidth, height: maxHeight, fit: "inside", withoutEnlargement: true });
      await encode(pipeline, q).toFile(tmp);
      const bytes = (await stat(tmp)).size;
      bestBytes = Math.min(bestBytes, bytes);
      if (budgetKb === 0 || bytes <= budgetKb * 1024) {
        await rename(tmp, output);
        return { bytes, quality: q };
      }
    }
    throw new Error(`${output}: budget ${budgetKb} KiB cannot be met at quality floor ${qualities.at(-1)} `
      + `without reducing dimensions (smallest encoding ${(bestBytes / 1024).toFixed(1)} KiB).`);
  } finally {
    await rm(tmp, { force: true });
  }
}

function qualitySteps(start, floor) {
  if (!Number.isFinite(start) || start < 1 || start > 100) {
    throw new Error(`Invalid image quality: ${start}`);
  }
  const steps = [];
  for (let q = Math.max(Math.round(start), floor); q > floor; q -= 4) {
    steps.push(q);
  }
  return [...steps, floor];
}

export function webpQualityStepsFor(file, { preferredQuality = quality } = {}) {
  return qualitySteps(preferredQuality, 70);
}

export function avifQualityStepsFor(file) {
  return qualitySteps(60, normalizeAssetPath(file).startsWith("mobile/") ? 50 : 55);
}

export function maxWidthFor(file) {
  const basename = path.basename(file);

  if (/^mobile\/play\/bg-play-(?:werewolves|mafia)-(?:day|night)-v2\.png$/.test(normalizeAssetPath(file))) {
    return 960;
  }

  // The dense map needs a small, explicit runtime reduction to fit 400 KiB at Q70+.
  if (normalizeAssetPath(file) === "village-map.png") {
    return 1200;
  }
  if (isHomepageInvitation(file)) {
    return 1536;
  }
  if (isCompactHomepageChoice(file)) {
    return 1536;
  }
  if (isMobilePortraitFamilyHero(file)) {
    return 1152;
  }
  if (basename.startsWith("portrait-")) {
    return 560;
  }
  if (basename.startsWith("icon-") || basename.includes("-sheet")) {
    return 960;
  }
  if (basename.startsWith("role-")) {
    return 1100;
  }
  if (basename.startsWith("bg-")) {
    return 2560;
  }
  return 1920;
}

export function webpBudgetKbFor(file) {
  const basename = path.basename(file);
  if (isHomepageInvitation(file)) {
    return 130;
  }
  if (isCompactHomepageChoice(file)) {
    return 384;
  }
  if (isMobilePortraitFamilyHero(file)) {
    return 384;
  }
  if (basename.startsWith("portrait-")) {
    return 110;
  }
  if (basename.startsWith("icon-")) {
    return 220;
  }
  if (basename.startsWith("role-") || basename.includes("-sheet")) {
    return 220;
  }
  if (isHeroLike(file)) {
    return 400;
  }
  return 360;
}

export function avifBudgetKbFor(file) {
  if (isMobilePortraitFamilyHero(file)) {
    return 256;
  }
  return Math.min(360, webpBudgetKbFor(file));
}

function isMobilePortraitFamilyHero(file) {
  const normalized = normalizeAssetPath(file);
  return /^mobile\/(?:werewolf|mafia)\/bg-hero-light-v1\.png$/.test(normalized)
    || /^mobile\/(?:werewolf|mafia)\/bg-hero-v3\.png$/.test(normalized);
}

function isCompactHomepageChoice(file) {
  const normalized = normalizeAssetPath(file);
  return /^homepage\/choice-(?:werewolf|mafia)-(?:v[23]|(?:dark|light)-v[45])\.png$/.test(normalized)
    || /^homepage\/choice-werewolf-(?:dark|light)-v[67]\.png$/.test(normalized);
}

function isHomepageInvitation(file) {
  return /^homepage\/invitation-(?:light-)?v1\.png$/.test(normalizeAssetPath(file));
}

export function mobileBudgetKbFor(file) {
  if (normalizeAssetPath(file) === "village-map.png") {
    return 288;
  }
  if (isHomepageInvitation(file)) {
    return 45;
  }
  if (isCompactHomepageChoice(file)) {
    return 220;
  }
  return Math.min(180, webpBudgetKbFor(file));
}

export function thumbnailBudgetKbFor(file) {
  return normalizeAssetPath(file) === "card-back-secret.png" ? 120 : 90;
}

export function shouldCreateRoleThumbnail(file) {
  const basename = path.basename(file);
  return (basename.startsWith("role-") && !basename.includes("-sheet")) || basename === "card-back-secret.png";
}

export function shouldCreateAvif(file) {
  return !isOpenGraphSource(file) && (isHeroLike(file)
    || /^(?:mobile\/)?play\/table-inlay-(?:werewolves-v1|mafia-v[12])\.png$/.test(normalizeAssetPath(file)));
}

function isPlaySceneV2(file) {
  return /^play\/bg-play-(?:werewolves|mafia)-(?:day|night)-v2\.png$/.test(normalizeAssetPath(file));
}

function shouldCreateWebp(file) {
  return !isOpenGraphSource(file);
}

function shouldPublishPng(file) {
  const normalized = file.split(path.sep).join("/");
  return isOpenGraphSource(file) || PUBLIC_METADATA_PNGS.has(normalized);
}

export function publishedPngBudgetKbFor(file) {
  return shouldPublishPng(file) ? 500 : 0;
}

function isOpenGraphSource(file) {
  return file.split(path.sep).join("/").startsWith("og/");
}

function isHeroLike(file) {
  const normalized = file.split(path.sep).join("/");
  const basename = path.basename(file);
  return (
    basename.startsWith("bg-") ||
    basename.startsWith("transition-") ||
    basename.startsWith("screen-") ||
    basename.startsWith("empty-") ||
    basename.startsWith("og-") ||
    basename.includes("banner") ||
    basename === "village-map.png" ||
    basename === "texture-parchment.png" ||
    basename === "card-back-secret.png" ||
    normalized.startsWith("legal/") ||
    normalized.startsWith("account/") ||
    normalized.startsWith("faq/")
  );
}

export function mobileWidthFor(file) {
  const normalized = normalizeAssetPath(file);
  const basename = path.basename(file);

  if (normalized.startsWith("mobile/")) {
    return 0;
  }
  if (isHomepageInvitation(file)) {
    return 960;
  }
  if (isCompactHomepageChoice(file)) {
    return 1080;
  }
  if (normalized.startsWith("auth/")) {
    return 960;
  }
  if (
    /^homepage\/choice-(?:werewolf|mafia)-v1\.png$/.test(normalized) ||
    basename === "sign-in-table.png" ||
    basename === "tutorial-day-scene.png" ||
    basename === "tutorial-night-scene.png"
  ) {
    return 720;
  }
  if (
    basename.startsWith("bg-") ||
    basename.startsWith("transition-") ||
    basename.startsWith("screen-") ||
    basename.startsWith("empty-") ||
    basename === "village-map.png"
  ) {
    return 960;
  }
  if (
    basename.startsWith("texture-") ||
    basename.includes("-sheet") ||
    basename === "logo-app-mark.png" ||
    basename === "narrator-kit.png"
  ) {
    return 640;
  }
  if (basename.startsWith("faction-") || basename.startsWith("event-")) {
    return 720;
  }
  return 0;
}

export function mobileDerivativePathFor(file, sourceFiles) {
  const normalized = normalizeAssetPath(file);
  if (!mobileWidthFor(normalized)) {
    return null;
  }

  const mobileSource = `mobile/${normalized}`;
  if (sourceFiles.has(mobileSource)) {
    return null;
  }

  return mobileSource.replace(/\.png$/, ".webp");
}

export async function inspectMobileDerivativeConflicts({
  sourceRoot,
  outputRoot,
  imageMetadata,
  expectedDimensions = new Map(),
}) {
  const mobileSourceRoot = path.join(sourceRoot, "mobile");
  if (!existsSync(mobileSourceRoot)) {
    return [];
  }

  const mobileSources = await listPngs(mobileSourceRoot);
  const conflicts = [];
  for (const file of mobileSources) {
    const source = path.join(mobileSourceRoot, file);
    const derivative = path.join(outputRoot, "mobile", file.replace(/\.png$/, ".webp"));
    if (!existsSync(derivative)) {
      conflicts.push(`${normalizeAssetPath(file)}: missing WebP derivative`);
      continue;
    }

    const [sourceMetadata, derivativeMetadata] = await Promise.all([
      imageMetadata(source),
      imageMetadata(derivative),
    ]);
    const normalizedFile = normalizeAssetPath(file);
    const expected = expectedDimensions.get(normalizedFile)
      ?? expectedRasterDimensions(sourceMetadata, `mobile/${normalizedFile}`);
    if (
      expected.width !== derivativeMetadata.width
      || expected.height !== derivativeMetadata.height
    ) {
      conflicts.push(
        `${normalizedFile}: expected ${expected.width}x${expected.height}, `
          + `WebP ${derivativeMetadata.width}x${derivativeMetadata.height}`,
      );
    }
  }

  return conflicts;
}

function expectedRasterDimensions(metadata, file) {
  const maxWidth = maxWidthFor(file);
  if (!metadata.width || !metadata.height || metadata.width <= maxWidth) {
    return metadata;
  }

  return {
    width: maxWidth,
    height: Math.round(metadata.height * (maxWidth / metadata.width)),
  };
}

function normalizeAssetPath(file) {
  return file.split(path.sep).join("/");
}

async function listPngs(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isDirectory() && DERIVATIVE_DIRS.has(entry.name)) {
        return [];
      }

      const relative = path.join(prefix, entry.name);
      const absolute = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return listPngs(absolute, relative);
      }

      return entry.isFile() && entry.name.endsWith(".png") ? [relative] : [];
    }),
  );

  return files.flat().sort();
}

async function fileKb(file) {
  try {
    return (await stat(file)).size / 1024;
  } catch {
    return 0;
  }
}

function csv(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
