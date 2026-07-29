import { existsSync } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const variants = [
  {
    source: "assets/game-art-source/mobile/bg-landing-hero-composited.png",
    output: "apps/web/public/game-art/mobile/bg-landing-hero-composited.avif",
    width: 640,
    height: 690,
    position: "top",
  },
  {
    source: "assets/game-art-source/werewolf/bg-hero-v2.png",
    output: "apps/web/public/game-art/mobile/werewolf/bg-hero-v2.avif",
    width: 640,
  },
  {
    source: "assets/game-art-source/mafia/bg-hero-v2.png",
    output: "apps/web/public/game-art/mobile/mafia/bg-hero-v2.avif",
    width: 640,
  },
];

const sharp = await loadSharp();
let totalBytes = 0;

for (const variant of variants) {
  await mkdir(path.dirname(variant.output), { recursive: true });
  await sharp(variant.source)
    .resize({
      width: variant.width,
      ...(variant.height ? { height: variant.height, fit: "cover", position: variant.position ?? "centre" } : {}),
      withoutEnlargement: true,
    })
    .avif({ quality: 42, effort: 7, chromaSubsampling: "4:2:0" })
    .toFile(variant.output);

  const bytes = (await stat(variant.output)).size;
  if (bytes > 32 * 1024) {
    throw new Error(`${variant.output} е ${Math.ceil(bytes / 1024)} KB; лимитът е 32 KB.`);
  }
  totalBytes += bytes;
}

console.log(`Generated ${variants.length} critical mobile AVIF assets (${Math.ceil(totalBytes / 1024)} KB total).`);

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
