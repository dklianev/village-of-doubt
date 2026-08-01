import assert from "node:assert/strict";
import test from "node:test";
import { assetDigestsMatch, isPlatformEquivalentAvif } from "./asset-digest.mjs";

test("accepts platform-specific AVIF containers with identical decoded pixels", () => {
  assert.equal(
    assetDigestsMatch("hero.avif", { bytes: "windows", pixels: "same" }, { bytes: "linux", pixels: "same" }),
    true,
  );
});

test("rejects AVIF output when decoded pixels change", () => {
  assert.equal(
    assetDigestsMatch("hero.avif", { bytes: "one", pixels: "before" }, { bytes: "two", pixels: "after" }),
    false,
  );
});

test("keeps lossless and source assets byte-strict", () => {
  assert.equal(assetDigestsMatch("hero.webp", { bytes: "one" }, { bytes: "two" }), false);
  assert.equal(assetDigestsMatch("source.png", { bytes: "same" }, { bytes: "same" }), true);
});

test("identifies only byte-level AVIF encoding drift for restoration", () => {
  assert.equal(
    isPlatformEquivalentAvif("hero.avif", { bytes: "windows", pixels: "same" }, { bytes: "linux", pixels: "same" }),
    true,
  );
  assert.equal(
    isPlatformEquivalentAvif("hero.avif", { bytes: "one", pixels: "before" }, { bytes: "two", pixels: "after" }),
    false,
  );
  assert.equal(isPlatformEquivalentAvif("hero.webp", { bytes: "one" }, { bytes: "two" }), false);
});
