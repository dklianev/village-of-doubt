import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceArtRoot = path.resolve("assets/game-art-source");
const artRoot = path.resolve("apps/web/public/game-art");
const railOutputRoot = path.join(artRoot, "phase-rail", "v1");
const boardOutputRoot = path.join(artRoot, "phase-board", "v1");
const sourceNames = [
  "icon-phase-lobby.png",
  "icon-phase-role-reveal.png",
  "icon-phase-night.png",
  "icon-phase-day.png",
  "icon-phase-voting.png",
  "icon-phase-resolution.png",
];
const railMaxBytes = 20 * 1024;
const boardVariants = [
  { width: 560, height: 400, maxBytes: 56 * 1024 },
  { width: 1120, height: 800, maxBytes: 180 * 1024 },
];

let totalBytes = 0;

for (const family of ["werewolves", "mafia"]) {
  const sourceRoot = family === "mafia" ? path.join(sourceArtRoot, "mafia") : sourceArtRoot;
  const railFamilyOutput = path.join(railOutputRoot, family);
  const boardFamilyOutput = path.join(boardOutputRoot, family);
  await Promise.all([
    mkdir(railFamilyOutput, { recursive: true }),
    mkdir(boardFamilyOutput, { recursive: true }),
  ]);

  for (const sourceName of sourceNames) {
    const source = path.join(sourceRoot, sourceName);
    const railOutput = path.join(railFamilyOutput, sourceName.replace(/\.png$/, "-128.webp"));
    await sharp(source)
      .resize(128, 128, { fit: "cover", position: "centre", withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 })
      .toFile(railOutput);
    const railBytes = (await stat(railOutput)).size;
    if (railBytes > railMaxBytes) {
      throw new Error(`${path.relative(artRoot, railOutput)} е ${Math.ceil(railBytes / 1024)} KB; лимитът е 20 KB.`);
    }
    totalBytes += railBytes;
    for (const variant of boardVariants) {
      const boardOutput = path.join(boardFamilyOutput, sourceName.replace(/\.png$/, `-${variant.width}.webp`));
      await sharp(source)
        .resize(variant.width, variant.height, { fit: "cover", position: "centre", withoutEnlargement: true })
        .webp({ quality: 74, effort: 6 })
        .toFile(boardOutput);
      const boardBytes = (await stat(boardOutput)).size;
      if (boardBytes > variant.maxBytes) {
        throw new Error(`${path.relative(artRoot, boardOutput)} е ${Math.ceil(boardBytes / 1024)} KB; лимитът е ${variant.maxBytes / 1024} KB.`);
      }
      totalBytes += boardBytes;
    }
  }
}

console.log(`Generated ${sourceNames.length * 2 * (boardVariants.length + 1)} phase assets (${Math.ceil(totalBytes / 1024)} KB total).`);
