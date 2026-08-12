import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  signReleaseManifest,
  validateReleaseManifest,
  verifyReleaseManifestSignature,
} from "./release-manifest.mjs";

const digest = "a".repeat(64);
const commit = "b".repeat(40);

function validManifest() {
  return {
    schemaVersion: 1,
    releaseVersion: commit,
    sourceCommit: commit,
    migrationHead: "0007_cuddly_felicia_hardy",
    createdAt: "2026-07-28T00:00:00.000Z",
    images: {
      web: `ghcr.io/example/project/web@sha256:${digest}`,
      game: `ghcr.io/example/project/game@sha256:${digest}`,
      migrator: `ghcr.io/example/project/migrator@sha256:${digest}`,
    },
  };
}

test("accepts digest-pinned images and a full source commit", () => {
  assert.deepEqual(validateReleaseManifest(validManifest()), validManifest());
});

test("rejects mutable image tags", () => {
  const manifest = validManifest();
  manifest.images.web = "ghcr.io/example/project/web:latest";
  assert.throws(() => validateReleaseManifest(manifest), /immutable container reference/);
});

test("rejects shell metacharacters in release values", () => {
  const manifest = validManifest();
  manifest.migrationHead = "0007_good$(touch bad)";
  assert.throws(() => validateReleaseManifest(manifest), /unsafe or empty/);
});

test("requires a full Git SHA for the release identity", () => {
  const manifest = validManifest();
  manifest.releaseVersion = "main";
  assert.throws(() => validateReleaseManifest(manifest), /full 40-character Git commit SHA/);
});

test("requires the release identity to match the source commit", () => {
  const manifest = validManifest();
  manifest.sourceCommit = "c".repeat(40);
  assert.throws(() => validateReleaseManifest(manifest), /must match sourceCommit/);
});

test("restricts signed releases to the configured GHCR repository", () => {
  assert.doesNotThrow(() => validateReleaseManifest(validManifest(), {
    allowedImagePrefix: "ghcr.io/example/project",
  }));
  assert.throws(
    () => validateReleaseManifest(validManifest(), { allowedImagePrefix: "ghcr.io/other/project" }),
    /allowed image prefix/,
  );
});

test("signs and verifies the canonical release manifest", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const options = { allowedImagePrefix: "ghcr.io/example/project" };
  const signature = signReleaseManifest(validManifest(), privateKey, options);

  assert.equal(verifyReleaseManifestSignature(validManifest(), signature, publicKey, options), true);

  const tampered = validManifest();
  tampered.images.web = `ghcr.io/example/project/web@sha256:${"c".repeat(64)}`;
  assert.throws(
    () => verifyReleaseManifestSignature(tampered, signature, publicKey, options),
    /signature is invalid/,
  );
});
