import { spawnSync } from "node:child_process";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assetDigestsMatch, digestAsset, isPlatformEquivalentAvif } from "./asset-digest.mjs";
import { runAssetGenerators } from "./run-asset-generators.mjs";

const artPaths = ["assets/game-art-source", "apps/web/public/game-art"];
const before = await inventoryRoots(artPaths);

try {
  runAssetGenerators({
    generators: [
      "scripts/optimize-assets.mjs",
      "scripts/generate-critical-mobile-assets.mjs",
      "scripts/generate-phase-rail-assets.mjs",
    ],
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(error?.exitCode ?? 1);
}

const after = await inventoryRoots(artPaths);
const changedByOptimizer = changedPaths(before, after);
if (changedByOptimizer.length > 0) {
  console.error("Asset optimization is not reproducible; this run changed:");
  console.error(changedByOptimizer.join("\n"));
  process.exit(1);
}

const restoredAvifs = await restorePlatformAvifEncodings(before, after);
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

async function inventory(root) {
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
      if (/\.tmp-\d+(?:[-.]|$)/.test(child.name)) {
        continue;
      }
      const digest = await digestAsset(filePath);
      entries.set(path.relative(root, filePath).split(path.sep).join("/"), digest);
    }
  }
}

async function inventoryRoots(roots) {
  const entries = new Map();
  for (const root of roots) {
    const rootEntries = await inventory(root);
    for (const [filePath, digest] of rootEntries) {
      entries.set(`${root}/${filePath}`, digest);
    }
  }
  return entries;
}

function changedPaths(beforeEntries, afterEntries) {
  const paths = new Set([...beforeEntries.keys(), ...afterEntries.keys()]);
  return [...paths]
    .filter((filePath) => !assetDigestsMatch(filePath, beforeEntries.get(filePath), afterEntries.get(filePath)))
    .sort();
}

async function restorePlatformAvifEncodings(beforeEntries, afterEntries) {
  const restored = [];
  for (const [filePath, beforeDigest] of beforeEntries) {
    const afterDigest = afterEntries.get(filePath);
    if (!isPlatformEquivalentAvif(filePath, beforeDigest, afterDigest)) {
      continue;
    }
    await writeFile(filePath, beforeDigest.encoded);
    restored.push(filePath);
  }
  return restored;
}
