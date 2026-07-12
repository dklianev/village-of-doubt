import { existsSync } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const artRoot = path.resolve("apps/web/public/game-art");
const outputRoot = path.join(artRoot, "phase-rail", "v1");
const sourceNames = [
  "icon-phase-lobby.png",
  "icon-phase-role-reveal.png",
  "icon-phase-night.png",
  "icon-phase-day.png",
  "icon-phase-voting.png",
  "icon-phase-resolution.png",
];
const maxBytes = 20 * 1024;

const sharp = await loadSharp();
let totalBytes = 0;

for (const family of ["werewolves", "mafia"]) {
  const sourceRoot = family === "mafia" ? path.join(artRoot, "mafia") : artRoot;
  const familyOutput = path.join(outputRoot, family);
  await mkdir(familyOutput, { recursive: true });

  for (const sourceName of sourceNames) {
    const source = path.join(sourceRoot, sourceName);
    const output = path.join(familyOutput, sourceName.replace(/\.png$/, "-128.webp"));
    await sharp(source)
      .resize(128, 128, { fit: "cover", position: "centre", withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 })
      .toFile(output);

    const bytes = (await stat(output)).size;
    if (bytes > maxBytes) {
      throw new Error(`${path.relative(artRoot, output)} е ${Math.ceil(bytes / 1024)} KB; лимитът е 20 KB.`);
    }
    totalBytes += bytes;
  }
}

console.log(`Generated ${sourceNames.length * 2} phase-rail assets (${Math.ceil(totalBytes / 1024)} KB total).`);

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
