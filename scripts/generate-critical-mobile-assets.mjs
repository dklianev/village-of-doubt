import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import sharp from "sharp";

export const variants = [
  {
    source: "assets/game-art-source/mobile/bg-landing-hero-composited.png",
    output: "apps/web/public/game-art/mobile/bg-landing-hero-composited.avif",
    format: "avif",
    width: 760,
    height: 820,
    position: "top",
    maxBytes: 96 * 1024,
  },
  {
    source: "assets/game-art-source/mobile/bg-landing-hero-composited.png",
    output: "apps/web/public/game-art/mobile/bg-landing-hero-composited.webp",
    format: "webp",
    width: 760,
    height: 820,
    position: "top",
    maxBytes: 160 * 1024,
  },
  {
    source: "assets/game-art-source/logo-landing-mark.png",
    output: "apps/web/public/game-art/mobile/logo-landing-mark.webp",
    format: "webp",
    width: 256,
    maxBytes: 12 * 1024,
  },
  {
    source: "assets/game-art-source/bg-lobby-tavern.png",
    output: "apps/web/public/game-art/mobile/bg-lobby-tavern.avif",
    width: 960,
    maxBytes: 120 * 1024,
  },
  {
    source: "assets/game-art-source/mafia/bg-lobby-tavern.png",
    output: "apps/web/public/game-art/mobile/mafia/bg-lobby-tavern.avif",
    width: 960,
    maxBytes: 120 * 1024,
  },
  {
    source: "assets/game-art-source/werewolf/bg-hero-v2.png",
    output: "apps/web/public/game-art/mobile/werewolf/bg-hero-v2.avif",
    width: 960,
    maxBytes: 120 * 1024,
  },
  {
    source: "assets/game-art-source/mafia/bg-hero-v2.png",
    output: "apps/web/public/game-art/mobile/mafia/bg-hero-v2.avif",
    width: 960,
    maxBytes: 120 * 1024,
  },
];

export async function generateCriticalMobileAssets({ rootDirectory = process.cwd(), assets = variants } = {}) {
  sharp.cache(false);
  // AVIF auto-tiling depends on thread count; pin it for stable pixels across hosts.
  sharp.concurrency(1);
  let totalBytes = 0;
  for (const variant of assets) {
    const source = path.resolve(rootDirectory, variant.source);
    const output = path.resolve(rootDirectory, variant.output);
    const outputRelative = path.relative(path.resolve(rootDirectory, "apps/web/public/game-art"), output);
    if (source === output || outputRelative.startsWith(`..${path.sep}`) || outputRelative === ".." || path.isAbsolute(outputRelative)) {
      throw new Error(`Refusing to write outside runtime assets or over a source master: ${output}`);
    }
    const resized = sharp(source).rotate().resize({
      width: variant.width,
      ...(variant.height ? { height: variant.height, fit: "cover", position: variant.position ?? "centre" } : {}),
      withoutEnlargement: true,
    });
    const optimized = variant.format === "webp"
      ? await resized.webp({ quality: 78, effort: 6, smartSubsample: true }).toBuffer()
      : await resized.avif({ quality: 55, effort: 7, chromaSubsampling: "4:2:0" }).toBuffer();

    const bytes = optimized.length;
    const maxBytes = variant.maxBytes ?? 120 * 1024;
    if (bytes > maxBytes) {
      throw new Error(`${variant.output}: quality-preserving encoding is ${Math.ceil(bytes / 1024)} KiB; budget is ${Math.ceil(maxBytes / 1024)} KiB.`);
    }
    await mkdir(path.dirname(output), { recursive: true });
    const temporary = `${output}.tmp-${process.pid}`;
    try {
      await writeFile(temporary, optimized);
      await rename(temporary, output);
    } finally {
      await rm(temporary, { force: true });
    }
    totalBytes += bytes;
  }
  return { count: assets.length, totalBytes };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

async function main() {
  // Select by master path, so a registered AVIF/WebP pair is exported together.
  const { values } = parseArgs({ options: { only: { type: "string", multiple: true } } });
  const selected = values.only && new Set(values.only.map((file) => file.replaceAll("\\", "/")));
  const sourcePath = (variant) => variant.source.slice("assets/game-art-source/".length);
  const sources = new Set(variants.map(sourcePath));
  for (const file of selected ?? []) {
    if (!sources.has(file)) throw new Error(`Unknown critical mobile source for --only: ${JSON.stringify(file)}`);
  }
  const assets = selected ? variants.filter((variant) => selected.has(sourcePath(variant))) : variants;
  const { count, totalBytes } = await generateCriticalMobileAssets({ assets });
  console.log(`Generated ${count} critical mobile assets (${Math.ceil(totalBytes / 1024)} KB total).`);
}
