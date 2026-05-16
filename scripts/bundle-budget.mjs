import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

const root = process.cwd();
const BUDGETS = {
  totalJsKb: 550,
  totalCssKb: 70,
  largestRouteKb: 140,
  largestArtAssetKb: 800,
};

const failures = [];

const jsDir = path.join(root, "apps/web/.next/static/chunks");
if (existsSync(jsDir)) {
  const jsFiles = listFilesRecursive(jsDir).filter((file) => file.endsWith(".js"));
  const totalJs = sumGzipKb(jsDir, jsFiles);
  const largestJs = largestGzipKb(jsDir, jsFiles);
  console.log(`Total JS gzip: ${totalJs} KB (budget: ${BUDGETS.totalJsKb} KB)`);
  console.log(`Largest JS gzip: ${largestJs.size} KB (${largestJs.file ?? "няма"})`);
  if (totalJs > BUDGETS.totalJsKb) {
    failures.push(`Total JS gzip ${totalJs} KB > budget ${BUDGETS.totalJsKb} KB`);
  }
  if (largestJs.size > BUDGETS.largestRouteKb) {
    failures.push(`Largest JS chunk gzip ${largestJs.file} ${largestJs.size} KB > budget ${BUDGETS.largestRouteKb} KB`);
  }
}

const cssDir = path.join(root, "apps/web/.next/static/css");
if (existsSync(cssDir)) {
  const cssFiles = listFilesRecursive(cssDir).filter((file) => file.endsWith(".css"));
  const totalCss = sumGzipKb(cssDir, cssFiles);
  console.log(`Total CSS gzip: ${totalCss} KB (budget: ${BUDGETS.totalCssKb} KB)`);
  if (totalCss > BUDGETS.totalCssKb) {
    failures.push(`Total CSS gzip ${totalCss} KB > budget ${BUDGETS.totalCssKb} KB`);
  }
}

const artDir = path.join(root, "apps/web/public/game-art");
if (existsSync(artDir)) {
  const artFiles = listFilesRecursive(artDir).filter((file) => file.endsWith(".webp"));
  const largest = artFiles
    .map((file) => ({ file, size: fileSizeKb(path.join(artDir, file)) }))
    .sort((left, right) => right.size - left.size)[0];
  console.log(`Largest optimized art: ${largest?.file ?? "няма"} (${largest?.size ?? 0} KB)`);
  if (largest && largest.size > BUDGETS.largestArtAssetKb) {
    failures.push(`Largest optimized art ${largest.file} ${largest.size} KB > budget ${BUDGETS.largestArtAssetKb} KB`);
  }
}

if (failures.length > 0) {
  console.error("\nBudget violations:");
  for (const failure of failures) {
    console.error(`  ✗ ${failure}`);
  }
  process.exit(1);
}

console.log("\n✓ All budgets within thresholds");

function sumGzipKb(baseDir, files) {
  return roundKb(
    files.reduce((sum, file) => {
      const buffer = readFileSync(path.join(baseDir, file));
      return sum + gzipSync(buffer).byteLength;
    }, 0),
  );
}

function largestGzipKb(baseDir, files) {
  return files
    .map((file) => {
      const buffer = readFileSync(path.join(baseDir, file));
      return { file, size: roundKb(gzipSync(buffer).byteLength) };
    })
    .sort((left, right) => right.size - left.size)[0] ?? { file: null, size: 0 };
}

function fileSizeKb(filePath) {
  return roundKb(statSync(filePath).size);
}

function roundKb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}

function listFilesRecursive(dir, prefix = "") {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFilesRecursive(absolute, relative);
    }
    return entry.isFile() ? [relative] : [];
  });
}
