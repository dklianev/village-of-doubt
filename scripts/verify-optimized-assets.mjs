import { spawnSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { assetDigestsMatch, digestAsset, isPlatformEquivalentAvif } from "./asset-digest.mjs";
import { runAssetGenerators } from "./run-asset-generators.mjs";

const artPaths = ["assets/game-art-source", "apps/web/public/game-art"];
export async function verifyOptimizedAssets({ rootDirectory = process.cwd(), runGenerators = runAssetGenerators } = {}) {
  const before = await inventoryRoots(artPaths, rootDirectory);
  let generatorError;
  try {
    await runGenerators({
      rootDirectory,
      generators: [
        "scripts/optimize-assets.mjs",
        "scripts/generate-critical-mobile-assets.mjs",
        "scripts/generate-phase-rail-assets.mjs",
      ],
    });
  } catch (error) {
    generatorError = error;
  }
  const after = await inventoryRoots(artPaths, rootDirectory);
  const changedByOptimizer = changedPaths(before, after);
  const changedSources = changedByOptimizer.filter(isSourceAsset);
  if (changedSources.length > 0) {
    throw new Error(`Asset generation mutated immutable source masters:\n${changedSources.join("\n")}`, { cause: generatorError });
  }
  if (generatorError) throw generatorError;
  if (changedByOptimizer.length > 0) {
    throw new Error(`Asset optimization is not reproducible; this run changed:\n${changedByOptimizer.join("\n")}`);
  }
  await verifyPairedAssetDimensions({ rootDirectory });
  const restoredAvifs = await restorePlatformAvifEncodings(before, after, rootDirectory);
  return { restoredAvifs };
}

async function main() {
  const { values } = parseArgs({ options: { "check-pairs": { type: "boolean" } } });
  if (values["check-pairs"]) {
    const { pairsChecked } = await verifyPairedAssetDimensions();
    console.log(`Checked ${pairsChecked} AVIF/WebP pairs; dimensions match (read-only, no generators run).`);
    return;
  }
  const { restoredAvifs } = await verifyOptimizedAssets();
  if (restoredAvifs.length > 0) {
    console.log(`Restored ${restoredAvifs.length} platform-specific AVIF containers with identical pixels.`);
  }
  const status = spawnSync(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all", "--", ...artPaths],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  if (status.error) {
    throw status.error;
  }
  if (status.status !== 0) {
    process.stderr.write(status.stderr ?? "");
    process.exit(status.status ?? 1);
  }

  const drift = status.stdout.trim();
  if (drift && process.env.CI) {
    console.error("Asset optimization changed tracked or generated files:");
    console.error(drift);
    console.error("Run pnpm optimize:assets and commit every resulting game-art file.");
    process.exit(1);
  }

  console.log(
    drift
      ? "Optimized game art is reproducible; existing uncommitted art outputs were preserved."
      : "Optimized game art is committed and reproducible.",
  );
}

export async function verifyPairedAssetDimensions({ rootDirectory = process.cwd() } = {}) {
  const runtimeRoot = path.join(rootDirectory, artPaths[1]);
  const entries = await readdir(runtimeRoot, { recursive: true, withFileTypes: true });
  const files = new Set(entries.filter((entry) => entry.isFile() && !/\.tmp-\d+(?:[-.]|$)/.test(entry.name))
    .map((entry) => path.relative(runtimeRoot, path.join(entry.parentPath, entry.name)).split(path.sep).join("/")));
  const failures = [];
  let pairsChecked = 0;
  for (const file of [...files].sort()) {
    if (!file.endsWith(".avif")) continue;
    const stem = file.slice(0, -".avif".length);
    const webp = `${stem}.webp`;
    // Only exact sibling formats are a pair. Mobile, thumbnails and other versions are independent.
    if (!files.has(webp)) continue;
    pairsChecked += 1;
    try {
      const avifMetadata = await sharp(await readFile(path.join(runtimeRoot, file))).metadata();
      const webpMetadata = await sharp(await readFile(path.join(runtimeRoot, webp))).metadata();
      if (avifMetadata.width !== webpMetadata.width || avifMetadata.height !== webpMetadata.height) {
        failures.push(`${stem}: AVIF ${avifMetadata.width}x${avifMetadata.height}, WebP ${webpMetadata.width}x${webpMetadata.height}`);
      }
    } catch (error) {
      failures.push(`${stem}: cannot inspect paired formats: ${error.message}`);
    }
  }
  if (failures.length) throw new Error(`Asset format dimension contract failed:\n${failures.join("\n")}`);
  return { pairsChecked };
}

async function inventory(root, { source = false } = {}) {
  const entries = new Map();
  await visit(root);
  return entries;

  async function visit(directory) {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const filePath = path.join(directory, child.name);
      if (child.isDirectory()) {
        await visit(filePath);
        continue;
      }
      if (!child.isFile()) {
        continue;
      }
      if (!source && /\.tmp-\d+(?:[-.]|$)/.test(child.name)) {
        continue;
      }
      const digest = await digestAsset(filePath);
      entries.set(path.relative(root, filePath).split(path.sep).join("/"), digest);
    }
  }
}

async function inventoryRoots(roots, rootDirectory) {
  const entries = new Map();
  for (const root of roots) {
    const rootEntries = await inventory(path.join(rootDirectory, root), { source: root === artPaths[0] });
    for (const [filePath, digest] of rootEntries) {
      entries.set(`${root}/${filePath}`, digest);
    }
  }
  return entries;
}

export function changedPaths(beforeEntries, afterEntries) {
  const paths = new Set([...beforeEntries.keys(), ...afterEntries.keys()]);
  return [...paths]
    .filter((filePath) => {
      const before = beforeEntries.get(filePath);
      const after = afterEntries.get(filePath);
      return isSourceAsset(filePath)
        ? !before || !after || before.bytes !== after.bytes
        : !assetDigestsMatch(filePath, before, after);
    })
    .sort();
}

export async function restorePlatformAvifEncodings(beforeEntries, afterEntries, rootDirectory = process.cwd()) {
  const restored = [];
  for (const [filePath, beforeDigest] of beforeEntries) {
    const afterDigest = afterEntries.get(filePath);
    if (!filePath.startsWith(`${artPaths[1]}/`) || !isPlatformEquivalentAvif(filePath, beforeDigest, afterDigest)) {
      continue;
    }
    await writeFile(path.join(rootDirectory, filePath), beforeDigest.encoded);
    restored.push(filePath);
  }
  return restored;
}

function isSourceAsset(filePath) {
  return filePath.startsWith(`${artPaths[0]}/`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = error?.exitCode ?? 1;
  });
}
