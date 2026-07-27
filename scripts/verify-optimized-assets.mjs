import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const artPath = "apps/web/public/game-art";
const before = await inventory(artPath);

const optimize = spawnSync(process.execPath, ["scripts/optimize-assets.mjs"], {
  cwd: process.cwd(),
  stdio: "inherit",
});

if (optimize.error) {
  throw optimize.error;
}
if (optimize.status !== 0) {
  process.exit(optimize.status ?? 1);
}

const after = await inventory(artPath);
const changedByOptimizer = changedPaths(before, after);
if (changedByOptimizer.length > 0) {
  console.error("Asset optimization is not reproducible; this run changed:");
  console.error(changedByOptimizer.join("\n"));
  process.exit(1);
}

const status = spawnSync(
  "git",
  ["status", "--porcelain=v1", "--untracked-files=all", "--", artPath],
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
      const digest = createHash("sha256").update(await readFile(filePath)).digest("hex");
      entries.set(path.relative(root, filePath).split(path.sep).join("/"), digest);
    }
  }
}

function changedPaths(beforeEntries, afterEntries) {
  const paths = new Set([...beforeEntries.keys(), ...afterEntries.keys()]);
  return [...paths]
    .filter((filePath) => beforeEntries.get(filePath) !== afterEntries.get(filePath))
    .sort();
}
