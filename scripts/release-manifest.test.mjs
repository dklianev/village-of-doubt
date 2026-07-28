import assert from "node:assert/strict";
import test from "node:test";
import { validateReleaseManifest } from "./release-manifest.mjs";

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
