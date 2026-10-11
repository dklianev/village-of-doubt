import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { assetPath, validateAudio, verifyManifest, publishApproved, isRecordingAuthorized, reusePreparedAudio, AUDIO_LIMITS, NARRATION_VOICES } from "./narration-assets.mjs";

test("paths are local, bounded and preserve all six narrator identities", () => {
  assert.equal(assetPath("witch_moonglow", "shared.personal.finale.jester"), "/audio/narration/v1/witch-moonglow/shared-personal-finale-jester.mp3");
  for (const [voice, cue] of [["../witch", "preview.night"], ["witch", "../preview.night"], ["witch", "https://example.test/a.mp3"], ["unknown", "preview.night"]]) assert.throws(() => assetPath(voice, cue));
});

test("audio acceptance rejects silent, clipped, oversized and unsupported audio", () => {
  const clip = { bytes: 40_000, durationMs: 5000, codec: "mp3", sampleRate: 44100, channels: 1, lufs: -24.5, peakDb: -2 };
  assert.equal(validateAudio(clip), true);
  for (const invalid of [{ durationMs: 20_001 }, { durationMs: NaN }, { bytes: AUDIO_LIMITS.fileBytes + 1 }, { lufs: -Infinity }, { peakDb: 0 }, { channels: 2 }, { codec: "aac" }]) assert.equal(validateAudio({ ...clip, ...invalid }), false);
});

test("publication refuses pending or invented listener approval before reading assets", async () => {
  for (const review of [undefined, { status: "pending" }, { status: "approved", reviewedBy: "automatic", evidence: "technical checks" }, { status: "approved", reviewedBy: "user", evidence: "" }]) {
    await assert.rejects(publishApproved({ version: 1, clips: [{ voice: "classic", cueId: "preview.night", review }] }, "."), /approval/);
  }
});

test("explicit activation preserves pending listening rather than inventing approval", () => {
  const review = { status: "pending", evidence: "Full listening has not taken place." };
  const activation = { status: "authorized-before-listening", authorizedBy: "user", evidence: "Enable these recordings now; listening will follow." };
  assert.equal(isRecordingAuthorized(review, activation), true);
  assert.equal(review.status, "pending");
  assert.equal(review.reviewedBy, undefined);
  for (const invalid of [undefined, {}, { ...activation, authorizedBy: "automatic" }, { ...activation, evidence: " " }, { ...activation, status: "pending" }]) {
    assert.equal(isRecordingAuthorized(review, invalid), false);
  }
  assert.equal(isRecordingAuthorized({ ...review, reviewedBy: "user" }, activation), false);
  assert.equal(isRecordingAuthorized({ status: "approved", reviewedBy: "automatic", evidence: "Measurements" }, activation), false);
});

test("activation authorization does not bypass source integrity", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "narration-authorization-"));
  try {
    const source = path.join(directory, "original.mp3");
    await writeFile(source, "synthetic changed original");
    await assert.rejects(publishApproved({ version: 1,
      activation: { status: "authorized-before-listening", authorizedBy: "user", evidence: "Enable without final listening." },
      clips: [{ voice: "classic", cueId: "werewolves.phase.night", source, sourceSha256: "0".repeat(64), review: { status: "pending" } }],
    }, directory), /original has changed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reusing a measured take preserves bytes and refuses changed files or invalid measurements", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "narration-prepared-"));
  try {
    const original = Buffer.from("synthetic original bytes");
    const prepared = Buffer.from("synthetic prepared bytes");
    const hash = bytes => createHash("sha256").update(bytes).digest("hex");
    const source = path.join(directory, "original.mp3");
    const preparedSource = path.join(directory, "prepared.mp3");
    const destination = path.join(directory, "public", "recording.mp3");
    await writeFile(source, original);
    await writeFile(preparedSource, prepared);
    const measurements = {
      original: { bytes: original.length, sha256: hash(original), durationMs: 5000, lufs: -22, peakDb: -2 },
      prepared: { bytes: prepared.length, sha256: hash(prepared), durationMs: 5000, codec: "mp3", channels: 1, sampleRate: 44100, lufs: -24.5, peakDb: -4.5 }, gainDb: -2.5,
    };
    const clip = { source, preparedSource, sourceSha256: hash(original), measurements };
    assert.deepEqual(await reusePreparedAudio(clip, destination), measurements);
    assert.deepEqual(await readFile(destination), prepared);
    for (const altered of [{ lufs: -30 }, { durationMs: 21_000 }, { peakDb: 0 }]) {
      await assert.rejects(reusePreparedAudio({ ...clip, measurements: { ...measurements, prepared: { ...measurements.prepared, ...altered } } }, destination), /measurements/);
    }
    await assert.rejects(reusePreparedAudio({ ...clip, measurements: { ...measurements, original: { ...measurements.original, durationMs: NaN } } }, destination), /measurements/);
    await writeFile(preparedSource, "tampered recording");
    await assert.rejects(reusePreparedAudio(clip, destination), /measured files/);
    await writeFile(preparedSource, prepared);
    await writeFile(source, "tampered original");
    await assert.rejects(reusePreparedAudio(clip, destination), /measured files/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("manifest verifies actual local hashes and rejects duplicate, external and missing assets", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "narration-assets-"));
  try {
    const src = assetPath("classic", "preview.night");
    const bytes = Buffer.from("synthetic test bytes");
    await mkdir(path.dirname(path.join(directory, src)), { recursive: true });
    await writeFile(path.join(directory, src), bytes);
    const clip = { src, sha256: createHash("sha256").update(bytes).digest("hex"), durationMs: 5000 };
    const manifest = { version: 1, voices: { classic: { "preview.night": clip } } };
    assert.equal((await verifyManifest(manifest, directory)).count, 1);
    await assert.rejects(verifyManifest({ ...manifest, voices: { classic: { "preview.night": { ...clip, src: "https://example.test/a.mp3" } } } }, directory));
    await assert.rejects(verifyManifest({ ...manifest, voices: { classic: { "preview.night": { ...clip, sha256: "0".repeat(64) } } } }, directory));
    const second = assetPath("classic", "preview.finale");
    await writeFile(path.join(directory, second), bytes);
    await assert.rejects(verifyManifest({ ...manifest, voices: { classic: { "preview.night": clip, "preview.finale": { ...clip, src: second } } } }, directory), /duplicate/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the released package covers every runtime cue for every narrator with recorded authorization", async () => {
  const read = async relative => JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));
  const catalog = await read("../assets/narration-source/catalog.v1.json");
  const manifest = await read("../apps/web/public/audio/narration/manifest.v1.json");
  const release = await read("../assets/narration-source/release.v1.json");
  const expected = ["preview.night", ...catalog.cues.filter(cue => cue.kind !== "preview").map(cue => cue.id)].sort();
  assert.deepEqual(Object.keys(manifest.voices).sort(), [...NARRATION_VOICES].sort());
  assert.equal(release.clips.length, expected.length * NARRATION_VOICES.length);
  for (const voice of NARRATION_VOICES) {
    assert.deepEqual(Object.keys(manifest.voices[voice]).sort(), expected);
    for (const cueId of expected) {
      const matches = release.clips.filter(clip => clip.voice === voice && clip.cueId === cueId);
      assert.equal(matches.length, 1, `${voice}/${cueId} provenance`);
      const clip = matches[0];
      assert.equal(isRecordingAuthorized(clip.review, release.activation), true);
      assert.equal(validateAudio(clip.prepared), true);
      assert.equal(clip.prepared.sha256, manifest.voices[voice][cueId].sha256);
      assert.equal(clip.prepared.durationMs, manifest.voices[voice][cueId].durationMs);
    }
  }
});
