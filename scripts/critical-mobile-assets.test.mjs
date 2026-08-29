import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

const landingAvif = "apps/web/public/game-art/mobile/bg-landing-hero-composited.avif";
const landingWebp = "apps/web/public/game-art/mobile/bg-landing-hero-composited.webp";

test("keeps the mobile landing hero crop identical across AVIF and WebP", async () => {
  const [avif, webp] = await Promise.all([
    sharp(landingAvif).metadata(),
    sharp(landingWebp).metadata(),
  ]);

  assert.deepEqual(
    { width: webp.width, height: webp.height },
    { width: avif.width, height: avif.height },
  );
  assert.deepEqual(
    { width: avif.width, height: avif.height },
    { width: 640, height: 690 },
  );
});
