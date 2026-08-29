import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

const landingAvif = "apps/web/public/game-art/mobile/bg-landing-hero-composited.avif";
const landingWebp = "apps/web/public/game-art/mobile/bg-landing-hero-composited.webp";
const landingCardVariants = [
  {
    avif: "apps/web/public/game-art/mobile/bg-lobby-tavern.avif",
    webp: "apps/web/public/game-art/mobile/bg-lobby-tavern.webp",
  },
  {
    avif: "apps/web/public/game-art/mobile/mafia/bg-lobby-tavern.avif",
    webp: "apps/web/public/game-art/mobile/mafia/bg-lobby-tavern.webp",
  },
];

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

test("publishes compact AVIF sources for both mobile landing cards", async () => {
  for (const variant of landingCardVariants) {
    const [avif, webp] = await Promise.all([
      sharp(variant.avif).metadata(),
      sharp(variant.webp).metadata(),
    ]);
    const [avifStats, webpStats] = await Promise.all([stat(variant.avif), stat(variant.webp)]);

    assert.deepEqual(
      { width: avif.width, height: avif.height },
      { width: webp.width, height: webp.height },
    );
    assert.deepEqual({ width: avif.width, height: avif.height }, { width: 960, height: 540 });
    assert.ok(
      avifStats.size < webpStats.size,
      `${variant.avif} should remain smaller than its WebP fallback`,
    );
  }
});
