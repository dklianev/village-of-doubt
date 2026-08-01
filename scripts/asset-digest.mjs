import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export async function digestAsset(filePath) {
  const encoded = await readFile(filePath);
  const bytes = createHash("sha256").update(encoded).digest("hex");
  if (path.extname(filePath).toLowerCase() !== ".avif") {
    return { bytes };
  }

  const { data, info } = await sharp(encoded).raw().toBuffer({ resolveWithObject: true });
  const pixels = createHash("sha256")
    .update(`${info.width}x${info.height}x${info.channels}:`)
    .update(data)
    .digest("hex");
  return { bytes, pixels, encoded };
}

export function assetDigestsMatch(filePath, before, after) {
  if (!before || !after) {
    return false;
  }
  return path.extname(filePath).toLowerCase() === ".avif"
    ? before.pixels === after.pixels
    : before.bytes === after.bytes;
}

export function isPlatformEquivalentAvif(filePath, before, after) {
  return path.extname(filePath).toLowerCase() === ".avif"
    && before?.bytes !== after?.bytes
    && before?.pixels === after?.pixels;
}
