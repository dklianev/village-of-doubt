import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

describe.each(["werewolves", "mafia"])("%s reusable role frame", (family) => {
  it.each([
    ["assets/game-art-source", "png"],
    ["apps/web/public/game-art", "webp"],
  ])("keeps real transparent pixels in %s", async (directory, extension) => {
    const file = resolve(root, directory!, `frames/frame-${family}-v1.${extension}`);
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);
    expect(info.width / info.height).toBeCloseTo(2 / 3, 3);
    expect(info.width).toBeGreaterThanOrEqual(1024);

    let transparent = 0;
    let visible = 0;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] === 0) transparent += 1;
      if (data[index]! > 127) visible += 1;
    }
    expect(transparent / (info.width * info.height)).toBeGreaterThan(0.85);
    expect(visible).toBeGreaterThan(500);

    // The overlay cannot tint faces or hide them behind a generated checkerboard.
    for (let y = Math.floor(info.height * 0.2); y < info.height * 0.8; y += 7) {
      for (let x = Math.floor(info.width * 0.2); x < info.width * 0.8; x += 7) {
        expect(data[(y * info.width + x) * 4 + 3]).toBe(0);
      }
    }
  });
});
