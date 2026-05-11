import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

const gameArtDir = path.resolve("apps/web/public/game-art");
const quality = Number(process.env.WEBP_QUALITY ?? 82);

async function main() {
  const sharp = await loadSharp();
  const files = await listPngs(gameArtDir);
  let originalBytes = 0;
  let optimizedBytes = 0;
  let written = 0;
  let thumbnailBytes = 0;
  let thumbnailsWritten = 0;
  let mobileBytes = 0;
  let mobileWritten = 0;

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

    if (shouldCreateRoleThumbnail(file)) {
      const thumbOutput = path.join(gameArtDir, "thumbs", file.replace(/\.png$/, ".webp"));
      await mkdir(path.dirname(thumbOutput), { recursive: true });
      await sharp(input, { limitInputPixels: false })
        .rotate()
        .resize({ width: 520, withoutEnlargement: true })
        .webp({ quality: 74, effort: 6, smartSubsample: true })
        .toFile(thumbOutput);
      thumbnailBytes += (await stat(thumbOutput)).size;
      thumbnailsWritten += 1;
    }

    const mobileWidth = mobileWidthFor(file);
    if (mobileWidth) {
      const mobileOutput = path.join(gameArtDir, "mobile", file.replace(/\.png$/, ".webp"));
      await mkdir(path.dirname(mobileOutput), { recursive: true });
      await sharp(input, { limitInputPixels: false })
        .rotate()
        .resize({ width: mobileWidth, withoutEnlargement: true })
        .webp({ quality: 70, effort: 6, smartSubsample: true })
        .toFile(mobileOutput);
      mobileBytes += (await stat(mobileOutput)).size;
      mobileWritten += 1;
    }
  }

  const saved = originalBytes - optimizedBytes;
  console.log(
    `Optimized ${written} assets to WebP. PNG: ${formatBytes(originalBytes)}, WebP: ${formatBytes(
      optimizedBytes,
    )}, saved: ${formatBytes(saved)}.`,
  );
  console.log(
    `Generated ${thumbnailsWritten} role thumbnails (${formatBytes(thumbnailBytes)}) and ${mobileWritten} mobile assets (${formatBytes(mobileBytes)}).`,
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
  const basename = path.basename(file);

  if (basename.startsWith("icon-") || basename.includes("-sheet")) {
    return 1024;
  }
  if (basename.startsWith("role-") || basename.startsWith("faction-")) {
    return 1200;
  }
  return 1600;
}

function shouldCreateRoleThumbnail(file) {
  const basename = path.basename(file);
  return (basename.startsWith("role-") && !basename.includes("-sheet")) || basename === "card-back-secret.png";
}

function mobileWidthFor(file) {
  const basename = path.basename(file);
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

async function listPngs(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
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

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
