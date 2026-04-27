import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const gameArtDir = path.resolve("apps/web/public/game-art");
const quality = Number(process.env.WEBP_QUALITY ?? 82);

async function main() {
  const sharp = await loadSharp();
  const files = (await readdir(gameArtDir)).filter((file) => file.endsWith(".png")).sort();
  let originalBytes = 0;
  let optimizedBytes = 0;
  let written = 0;

  for (const file of files) {
    const input = path.join(gameArtDir, file);
    const output = path.join(gameArtDir, file.replace(/\.png$/, ".webp"));
    const before = (await stat(input)).size;
    const image = sharp(input, { limitInputPixels: false }).rotate();
    const metadata = await image.metadata();
    const maxWidth = maxWidthFor(file);
    const pipeline =
      metadata.width && metadata.width > maxWidth
        ? image.resize({ width: maxWidth, withoutEnlargement: true })
        : image;

    await pipeline.webp({ quality, effort: 6, smartSubsample: true }).toFile(output);
    const after = (await stat(output)).size;
    originalBytes += before;
    optimizedBytes += after;
    written += 1;
  }

  const saved = originalBytes - optimizedBytes;
  console.log(
    `Optimized ${written} assets to WebP. PNG: ${formatBytes(originalBytes)}, WebP: ${formatBytes(
      optimizedBytes,
    )}, saved: ${formatBytes(saved)}.`,
  );
}

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default;
  } catch {
    const pnpmDir = path.resolve("node_modules/.pnpm");
    if (!existsSync(pnpmDir)) {
      throw new Error("sharp не е наличен. Стартирай pnpm install или добави sharp като dev dependency.");
    }

    const entries = await readdir(pnpmDir, { withFileTypes: true });
    const sharpEntry = entries.find((entry) => entry.isDirectory() && entry.name.startsWith("sharp@"));
    if (!sharpEntry) {
      throw new Error("sharp не е намерен в node_modules/.pnpm.");
    }

    const sharpPath = path.join(pnpmDir, sharpEntry.name, "node_modules/sharp/lib/index.js");
    const mod = await import(pathToFileURL(sharpPath).href);
    return mod.default;
  }
}

function maxWidthFor(file) {
  if (file.startsWith("icon-") || file.includes("-sheet")) {
    return 1024;
  }
  if (file.startsWith("role-") || file.startsWith("faction-")) {
    return 1200;
  }
  return 1600;
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
