import { existsSync } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
const boardMaxBytes = 48 * 1024;

const sharp = await loadSharp();
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
    const boardOutput = path.join(boardFamilyOutput, sourceName.replace(/\.png$/, "-560.webp"));
    await sharp(source)
      .resize(128, 128, { fit: "cover", position: "centre", withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 })
      .toFile(railOutput);
    await sharp(source)
      .resize(560, 400, { fit: "cover", position: "centre", withoutEnlargement: true })
      .webp({ quality: 64, effort: 6 })
      .toFile(boardOutput);

    const railBytes = (await stat(railOutput)).size;
    const boardBytes = (await stat(boardOutput)).size;
    if (railBytes > railMaxBytes) {
      throw new Error(`${path.relative(artRoot, railOutput)} е ${Math.ceil(railBytes / 1024)} KB; лимитът е 20 KB.`);
    }
    if (boardBytes > boardMaxBytes) {
      throw new Error(`${path.relative(artRoot, boardOutput)} е ${Math.ceil(boardBytes / 1024)} KB; лимитът е 48 KB.`);
    }
    totalBytes += railBytes + boardBytes;
  }
}

console.log(`Generated ${sourceNames.length * 4} phase assets (${Math.ceil(totalBytes / 1024)} KB total).`);

async function loadSharp() {
  try {
    const mod = await import("sharp");
    return mod.default;
  } catch {
    const pnpmDir = path.resolve("node_modules/.pnpm");
    if (!existsSync(pnpmDir)) {
      throw new Error("sharp не е наличен. Стартирай pnpm install.");
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
