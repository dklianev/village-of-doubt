import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { inspectMobileDerivativeConflicts, mobileDerivativePathFor } from "./optimize-assets.mjs";

test("does not overwrite a dedicated mobile source with a desktop derivative", () => {
  const sources = new Set([
    "werewolf/bg-hero-light-v1.png",
    "mobile/werewolf/bg-hero-light-v1.png",
  ]);

  assert.equal(
    mobileDerivativePathFor("werewolf/bg-hero-light-v1.png", sources),
    null,
  );
  assert.equal(
    mobileDerivativePathFor("werewolf/bg-hero-v2.png", sources),
    "mobile/werewolf/bg-hero-v2.webp",
  );
});

test("detects mismatched dedicated mobile WebP derivatives", async () => {
  const conflicts = await inspectMobileDerivativeConflicts({
    sourceRoot: "assets/game-art-source",
    outputRoot: "apps/web/public/game-art",
    imageMetadata: (file) => sharp(file).metadata(),
  });

  assert.deepEqual(conflicts, []);
});
