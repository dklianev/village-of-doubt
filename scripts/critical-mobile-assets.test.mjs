import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

const landingAvif = "apps/web/public/game-art/mobile/bg-landing-hero-composited.avif";
const landingWebp = "apps/web/public/game-art/mobile/bg-landing-hero-composited.webp";
const landingLogo = "apps/web/public/game-art/mobile/logo-landing-mark.webp";
const werewolfRulesDark = {
  avif: "apps/web/public/game-art/mobile/werewolf/bg-hero-v3.avif",
  webp: "apps/web/public/game-art/mobile/werewolf/bg-hero-v3.webp",
};
const lightFamilyHeroes = ["werewolf", "mafia"].map((family) => ({
  avif: `apps/web/public/game-art/mobile/${family}/bg-hero-light-v1.avif`,
  webp: `apps/web/public/game-art/mobile/${family}/bg-hero-light-v1.webp`,
}));
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

test("publishes a compact 256px landing logo derivative", async () => {
  const [metadata, stats] = await Promise.all([
    sharp(landingLogo).metadata(),
    stat(landingLogo),
  ]);

  assert.deepEqual(
    { width: metadata.width, height: metadata.height, format: metadata.format },
    { width: 256, height: 256, format: "webp" },
  );
  assert.ok(stats.size <= 12 * 1024, `${landingLogo} should remain at or below 12 KB`);
});

test("keeps the dark mobile Werewolf rules hero portrait and format-aligned", async () => {
  const [avif, webp, avifStats, webpStats] = await Promise.all([
    sharp(werewolfRulesDark.avif).metadata(),
    sharp(werewolfRulesDark.webp).metadata(),
    stat(werewolfRulesDark.avif),
    stat(werewolfRulesDark.webp),
  ]);

  assert.deepEqual(
    { width: avif.width, height: avif.height },
    { width: webp.width, height: webp.height },
  );
  assert.deepEqual({ width: avif.width, height: avif.height }, { width: 768, height: 1024 });
  assert.ok(avifStats.size <= 100 * 1024, "The AVIF hero should remain at or below 100 KB");
  assert.ok(webpStats.size <= 90 * 1024, "The WebP fallback should remain at or below 90 KB");
});

test("keeps both light family heroes portrait, crisp and below the mobile transfer budget", async () => {
  for (const hero of lightFamilyHeroes) {
    const [avif, webp, avifStats, webpStats] = await Promise.all([
      sharp(hero.avif).metadata(),
      sharp(hero.webp).metadata(),
      stat(hero.avif),
      stat(hero.webp),
    ]);

    assert.deepEqual(
      { width: avif.width, height: avif.height },
      { width: webp.width, height: webp.height },
    );
    assert.deepEqual({ width: avif.width, height: avif.height }, { width: 768, height: 1024 });
    assert.ok(avifStats.size <= 55 * 1024, `${hero.avif} should remain at or below 55 KB`);
    assert.ok(webpStats.size <= 92 * 1024, `${hero.webp} should remain at or below 92 KB`);
  }
});
