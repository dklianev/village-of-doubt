import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const sourceArtDir = path.resolve("assets/game-art-source");
const gameArtDir = path.resolve("apps/web/public/game-art");
const quality = Number(process.env.WEBP_QUALITY ?? 82);
const args = new Set(process.argv.slice(2));
const reportOnly = args.has("--report-only");

const DERIVATIVE_DIRS = new Set(["thumbs"]);
const PUBLIC_METADATA_PNGS = new Set([
  "legal/faq-hearth-banner.png",
  "legal/privacy-banner.png",
  "legal/report-banner.png",
  "legal/status-banner.png",
  "legal/terms-banner.png",
]);

async function main() {
  if (!existsSync(sourceArtDir)) {
    throw new Error("Липсва assets/game-art-source. PNG master-ите не трябва да живеят в public.");
  }

  if (!reportOnly) {
    await cleanupTemporaryArtifacts(sourceArtDir);
    await cleanupTemporaryArtifacts(gameArtDir);
  }

  sharp.cache(false);
  if (process.platform === "win32") {
    sharp.concurrency(1);
  }
  const files = await listPngs(sourceArtDir);
  const sourceFiles = new Set(files.map(normalizeAssetPath));

  if (reportOnly) {
    await printReport(files);
    return;
  }

  const fileConcurrency = readPositiveInteger(
    process.env.ASSET_FILE_CONCURRENCY,
    process.platform === "win32" ? 2 : 4,
  );
  let completed = 0;
  const results = await mapWithConcurrency(files, fileConcurrency, async (file) => {
    const result = await optimizeAsset(sharp, file, sourceFiles);
    completed += 1;
    if (completed % 25 === 0 || completed === files.length) {
      console.log(`Processed ${completed}/${files.length} source assets.`);
    }
    return result;
  });

  let originalBytes = 0;
  let optimizedBytes = 0;
  let written = 0;
  let trimmedPngBytes = 0;
  let pngBytesAfter = 0;
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
    trimmedPngBytes += result.trimmedPngBytes;
    pngBytesAfter += result.pngBytesAfter;
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
    `Optimized ${written} assets. Source PNG: ${formatBytes(originalBytes)} -> ${formatBytes(
      pngBytesAfter,
    )}; runtime WebP: ${formatBytes(optimizedBytes)}.`,
  );
  console.log(
    `Trimmed source masters by ${formatBytes(trimmedPngBytes)}. Published ${publishedPngs} metadata PNGs ` +
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
  const sourceBudget = sourcePngBudgetKbFor(file);
  let trimmedPngBytes = 0;

  if (sourceBudget > 0 && before > sourceBudget * 1024) {
    const trimmed = await trimSourcePng(sharp, input, file, before, sourceBudget);
    trimmedPngBytes = before - trimmed;
  }

  const pngBytesAfter = (await stat(input)).size;
  const publicPng = path.join(gameArtDir, file);
  let publishedPngBytes = 0;
  let publishedPngs = 0;
  if (shouldPublishPng(file)) {
    await mkdir(path.dirname(publicPng), { recursive: true });
    await copyFile(input, publicPng);
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
    await writeWebp(sharp, input, thumbOutput, file, 520, 90, 74);
    thumbnailBytes = (await stat(thumbOutput)).size;
    thumbnailsWritten = 1;
  }

  const mobileDerivativePath = mobileDerivativePathFor(file, sourceFiles);
  const mobileWidth = mobileDerivativePath ? mobileWidthFor(file) : 0;
  if (mobileDerivativePath && mobileWidth) {
    const mobileOutput = path.join(gameArtDir, mobileDerivativePath);
    await mkdir(path.dirname(mobileOutput), { recursive: true });
    await writeWebp(sharp, input, mobileOutput, file, mobileWidth, mobileBudgetKbFor(file), 70);
    mobileBytes = (await stat(mobileOutput)).size;
    mobileWritten = 1;
  }

  return {
    originalBytes: before,
    optimizedBytes,
    written: createWebp ? 1 : 0,
    trimmedPngBytes,
    pngBytesAfter,
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
  let nextIndex = 0;

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index], index);
    }
  }));

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
    ].join(","),
  );

  for (const file of files) {
    const pngKb = await fileKb(path.join(sourceArtDir, file));
    const webpKb = shouldCreateWebp(file)
      ? await fileKb(path.join(gameArtDir, file.replace(/\.png$/, ".webp")))
      : 0;
    const avifKb = await fileKb(path.join(gameArtDir, file.replace(/\.png$/, ".avif")));
    const pngBudget = sourcePngBudgetKbFor(file);
    const webpBudget = shouldCreateWebp(file) ? webpBudgetKbFor(file) : 0;
    const avifBudget = shouldCreateAvif(file) ? avifBudgetKbFor(file) : 0;
    const overBudget = [
      pngBudget > 0 && pngKb > pngBudget,
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
      ].join(","),
    );
  }
}

async function trimSourcePng(sharp, input, file, beforeBytes, budgetKb) {
  const baseWidth = sourcePngWidthFor(file);
  const widths = uniqueNumbers([
    baseWidth,
    Math.round(baseWidth * 0.85),
    Math.round(baseWidth * 0.72),
    Math.round(baseWidth * 0.6),
    720,
    640,
    560,
  ]).filter((width) => width >= 420);
  const qualities = [78, 70, 62, 54];
  let bestTmp = "";
  let bestBytes = beforeBytes;

  for (const width of widths) {
    for (const qualityValue of qualities) {
      const candidate = `${input}.tmp-${process.pid}-${width}-${qualityValue}.png`;
      await sharp(input, { limitInputPixels: false })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .png({ compressionLevel: 9, palette: true, quality: qualityValue, effort: 10, adaptiveFiltering: true })
        .toFile(candidate);

      const candidateBytes = (await stat(candidate)).size;
      if (candidateBytes < bestBytes) {
        if (bestTmp) await rm(bestTmp, { force: true });
        bestTmp = candidate;
        bestBytes = candidateBytes;
      } else {
        await rm(candidate, { force: true });
      }

      if (candidateBytes <= budgetKb * 1024) {
        await rename(bestTmp, input);
        return candidateBytes;
      }
    }
  }

  if (bestTmp && bestBytes < beforeBytes) {
    await rename(bestTmp, input);
    return bestBytes;
  }

  if (bestTmp) await rm(bestTmp, { force: true });
  return beforeBytes;
}

async function writeWebp(sharp, input, output, file, maxWidth, budgetKb, preferredQuality = quality) {
  await writeRasterWithBudget({
    sharp,
    input,
    output,
    maxWidth,
    budgetKb,
    qualities: qualitySteps(preferredQuality, 48),
    encode: (pipeline, q) => pipeline.webp({ quality: q, effort: 6, smartSubsample: true }),
  });
}

async function writeAvif(sharp, input, output, file, maxWidth, budgetKb) {
  await writeRasterWithBudget({
    sharp,
    input,
    output,
    maxWidth,
    budgetKb,
    qualities: [60, 54, 48, 42, 36],
    encode: (pipeline, q) => pipeline.avif({ quality: q, effort: 6 }),
  });
}

async function writeRasterWithBudget({ sharp, input, output, maxWidth, budgetKb, qualities, encode }) {
  await mkdir(path.dirname(output), { recursive: true });
  const tmp = `${output}.tmp-${process.pid}${path.extname(output)}`;
  let bestTmp = "";
  let bestBytes = Number.POSITIVE_INFINITY;

  for (const q of qualities) {
    const candidate = `${tmp}.${q}`;
    const image = sharp(input, { limitInputPixels: false }).rotate();
    const metadata = await image.metadata();
    const pipeline = metadata.width && metadata.width > maxWidth ? image.resize({ width: maxWidth, withoutEnlargement: true }) : image;
    await encode(pipeline, q).toFile(candidate);
    const bytes = (await stat(candidate)).size;

    if (bytes < bestBytes) {
      if (bestTmp) await rm(bestTmp, { force: true });
      bestTmp = candidate;
      bestBytes = bytes;
    } else {
      await rm(candidate, { force: true });
    }

    if (budgetKb === 0 || bytes <= budgetKb * 1024) {
      break;
    }
  }

  await rename(bestTmp, output);
}

function qualitySteps(start, floor) {
  const steps = [];
  for (let q = start; q >= floor; q -= 8) {
    steps.push(q);
  }
  return steps;
}

function uniqueNumbers(values) {
  return [...new Set(values)].sort((a, b) => b - a);
}

function maxWidthFor(file) {
  const basename = path.basename(file);

  if (basename.startsWith("portrait-")) {
    return 560;
  }
  if (basename.startsWith("icon-") || basename.includes("-sheet")) {
    return 960;
  }
  if (basename.startsWith("role-") || basename.startsWith("faction-")) {
    return 1100;
  }
  if (isHeroLike(file)) {
    return 1440;
  }
  return 1400;
}

function sourcePngWidthFor(file) {
  const basename = path.basename(file);
  if (basename.startsWith("portrait-")) {
    return 560;
  }
  if (basename.startsWith("icon-")) {
    return 720;
  }
  if (basename.startsWith("role-") || basename.startsWith("faction-")) {
    return 900;
  }
  if (basename.includes("-sheet")) {
    return 1024;
  }
  if (isHeroLike(file)) {
    return 1280;
  }
  return 960;
}

function sourcePngBudgetKbFor(file) {
  if (path.basename(file).startsWith("portrait-")) {
    return 240;
  }
  return 500;
}

function webpBudgetKbFor(file) {
  const basename = path.basename(file);
  if (basename.startsWith("portrait-")) {
    return 110;
  }
  if (basename.startsWith("icon-")) {
    return 150;
  }
  if (basename.startsWith("role-") || basename.startsWith("faction-") || basename.includes("-sheet")) {
    return 220;
  }
  if (isHeroLike(file)) {
    return 500;
  }
  return 360;
}

function avifBudgetKbFor(file) {
  return Math.min(360, webpBudgetKbFor(file));
}

function mobileBudgetKbFor(file) {
  return Math.min(180, webpBudgetKbFor(file));
}

function shouldCreateRoleThumbnail(file) {
  const basename = path.basename(file);
  return (basename.startsWith("role-") && !basename.includes("-sheet")) || basename === "card-back-secret.png";
}

function shouldCreateAvif(file) {
  return !isOpenGraphSource(file) && isHeroLike(file);
}

function shouldCreateWebp(file) {
  return !isOpenGraphSource(file);
}

function shouldPublishPng(file) {
  const normalized = file.split(path.sep).join("/");
  return isOpenGraphSource(file) || PUBLIC_METADATA_PNGS.has(normalized);
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

function mobileWidthFor(file) {
  const normalized = normalizeAssetPath(file);
  const basename = path.basename(file);

  if (normalized.startsWith("mobile/")) {
    return 0;
  }
  if (normalized.startsWith("auth/")) {
    return 960;
  }
  if (
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

export async function inspectMobileDerivativeConflicts({ sourceRoot, outputRoot, imageMetadata }) {
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
    if (
      sourceMetadata.width !== derivativeMetadata.width
      || sourceMetadata.height !== derivativeMetadata.height
    ) {
      conflicts.push(
        `${normalizeAssetPath(file)}: source ${sourceMetadata.width}x${sourceMetadata.height}, `
          + `WebP ${derivativeMetadata.width}x${derivativeMetadata.height}`,
      );
    }
  }

  return conflicts;
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
