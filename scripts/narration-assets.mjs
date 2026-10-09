import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const AUDIO_LIMITS = Object.freeze({ fileBytes: 512 * 1024, totalBytes: 32 * 1024 * 1024, durationMs: 20_000 });
export const NARRATION_VOICES = ["classic", "classic_nikolay", "old_villager", "inspector", "witch", "witch_moonglow"];
const root = fileURLToPath(new URL("../", import.meta.url));
const targetLufs = -24.5;
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

export function assetPath(voice, cueId) {
  if (!NARRATION_VOICES.includes(voice) || !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(cueId)) throw new Error("Invalid narration identity");
  return `/audio/narration/v1/${voice.replaceAll("_", "-")}/${cueId.replaceAll(".", "-")}.mp3`;
}

export function validateAudio(measured) {
  return Number.isFinite(measured.durationMs) && measured.durationMs > 0 && measured.durationMs <= AUDIO_LIMITS.durationMs
    && Number.isInteger(measured.bytes) && measured.bytes > 0 && measured.bytes <= AUDIO_LIMITS.fileBytes
    && measured.codec === "mp3" && measured.channels === 1 && measured.sampleRate === 44100
    && Number.isFinite(measured.lufs) && measured.lufs > -40 && measured.lufs < -10
    && Number.isFinite(measured.peakDb) && measured.peakDb <= -1;
}

function run(binary, args) {
  const result = spawnSync(process.env[binary.toUpperCase()] || binary, args, { encoding: "utf8", windowsHide: true, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`${binary} failed: ${result.error?.message ?? result.stderr.slice(-800)}`);
  return result;
}

export async function inspectAudio(file) {
  const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", file]).stdout);
  const analysis = run("ffmpeg", ["-hide_banner", "-nostdin", "-nostats", "-i", file, "-af", `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:print_format=json`, "-f", "null", "-"]).stderr;
  const start = analysis.lastIndexOf("{");
  if (start < 0) throw new Error("Missing audio measurements");
  const loudness = JSON.parse(analysis.slice(start, analysis.indexOf("}", start) + 1));
  const stream = probe.streams.find((entry) => entry.codec_type === "audio");
  const bytes = await readFile(file);
  return { sha256: sha256(bytes), bytes: bytes.length, durationMs: Math.round(Number(probe.format.duration) * 1000), codec: stream?.codec_name, channels: stream?.channels, sampleRate: Number(stream?.sample_rate), lufs: Number(loudness.input_i), peakDb: Number(loudness.input_tp) };
}

export async function prepareAudio(source, destination) {
  const original = await inspectAudio(source);
  if (!Number.isFinite(original.lufs) || !Number.isFinite(original.peakDb) || original.peakDb >= 0 || original.durationMs > AUDIO_LIMITS.durationMs) throw new Error("Invalid original audio");
  const gainDb = Math.min(targetLufs - original.lufs, -1.5 - original.peakDb);
  await mkdir(path.dirname(destination), { recursive: true });
  run("ffmpeg", ["-y", "-hide_banner", "-nostdin", "-v", "error", "-i", source, "-map_metadata", "-1", "-af", `volume=${gainDb.toFixed(2)}dB`, "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", destination]);
  const prepared = await inspectAudio(destination);
  if (!validateAudio(prepared) || Math.abs(original.durationMs - prepared.durationMs) > 150 || Math.abs(prepared.lufs - targetLufs) > 1) throw new Error("Prepared audio failed duration, level, format or size checks");
  return { original, prepared, gainDb: Number(gainDb.toFixed(2)) };
}

export async function verifyManifest(manifest, publicRoot) {
  if (manifest?.version !== 1 || !manifest.voices || typeof manifest.voices !== "object" || Array.isArray(manifest.voices)) throw new Error("Invalid manifest");
  const catalog = JSON.parse(await readFile(path.join(root, "assets/narration-source/catalog.v1.json"), "utf8"));
  const cueIds = new Set(catalog.cues.map((cue) => cue.id));
  let totalBytes = 0;
  const hashes = new Set();
  let count = 0;
  for (const [voice, cues] of Object.entries(manifest.voices)) {
    if (!NARRATION_VOICES.includes(voice) || !cues || typeof cues !== "object" || Array.isArray(cues)) throw new Error("Invalid manifest voice");
    for (const [cueId, clip] of Object.entries(cues)) {
      if (!cueIds.has(cueId) || !clip || clip.src !== assetPath(voice, cueId) || !/^[a-f0-9]{64}$/.test(clip.sha256) || !Number.isFinite(clip.durationMs) || clip.durationMs <= 0 || clip.durationMs > AUDIO_LIMITS.durationMs) throw new Error("Invalid manifest clip");
      const file = path.join(publicRoot, clip.src);
      const info = await stat(file);
      if (!info.isFile() || info.size <= 0 || info.size > AUDIO_LIMITS.fileBytes) throw new Error("Audio file exceeds budget");
      const hash = sha256(await readFile(file));
      if (hash !== clip.sha256 || hashes.has(hash)) throw new Error("Audio hash mismatch or duplicate recording");
      hashes.add(hash);
      totalBytes += info.size;
      count += 1;
    }
  }
  if (totalBytes > AUDIO_LIMITS.totalBytes) throw new Error("Total narration audio exceeds budget");
  return { count, bytes: totalBytes, remainingBytes: AUDIO_LIMITS.totalBytes - totalBytes };
}

export function isRecordingAuthorized(review, activation) {
  if (review?.status === "approved") {
    return review.reviewedBy === "user" && typeof review.evidence === "string" && !!review.evidence.trim();
  }
  // Explicit activation is not evidence that the user listened to this recording.
  return review?.status === "pending" && review.reviewedBy == null
    && activation?.status === "authorized-before-listening" && activation.authorizedBy === "user"
    && typeof activation.evidence === "string" && !!activation.evidence.trim();
}

export async function reusePreparedAudio(clip, destination) {
  const measured = clip.measurements;
  if (!measured || !validateAudio(measured.prepared)
    || !Number.isFinite(measured.original?.lufs) || !Number.isFinite(measured.original?.peakDb)
    || !Number.isFinite(measured.original?.durationMs) || measured.original.durationMs <= 0
    || measured.original.durationMs > AUDIO_LIMITS.durationMs
    || measured.original.peakDb >= 0 || !Number.isFinite(measured.gainDb)
    || Math.abs(measured.original.durationMs - measured.prepared.durationMs) > 150
    || Math.abs(measured.prepared.lufs - targetLufs) > 1) throw new Error("Invalid prepared measurements");
  const original = await readFile(clip.source);
  const prepared = await readFile(clip.preparedSource);
  if (sha256(original) !== clip.sourceSha256 || clip.sourceSha256 !== measured.original.sha256
    || original.length !== measured.original.bytes || prepared.length !== measured.prepared.bytes
    || sha256(prepared) !== measured.prepared.sha256) throw new Error("Prepared recording no longer matches measured files");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, prepared);
  return measured;
}

export async function publishApproved(plan, publicRoot) {
  if (plan?.version !== 1 || !Array.isArray(plan.clips) || !plan.clips.length) throw new Error("Missing approved recordings");
  const manifest = { version: 1, voices: {} };
  const provenance = { version: 1, provider: "ElevenLabs", model: "eleven_v4_exp", language: "bg", targetLufs, clips: [] };
  if (plan.activation) provenance.activation = plan.activation;
  const identities = new Set();
  for (const clip of plan.clips) {
    const src = assetPath(clip.voice, clip.cueId);
    if (identities.has(src) || !isRecordingAuthorized(clip.review, plan.activation)) throw new Error("Recording lacks listener approval or explicit activation authorization, or repeats an identity");
    identities.add(src);
    if (sha256(await readFile(clip.source)) !== clip.sourceSha256) throw new Error("Approved original has changed");
    const destination = path.join(publicRoot, src);
    const measured = clip.preparedSource ? await reusePreparedAudio(clip, destination) : await prepareAudio(clip.source, destination);
    manifest.voices[clip.voice] ??= {};
    manifest.voices[clip.voice][clip.cueId] = { src, durationMs: measured.prepared.durationMs, sha256: measured.prepared.sha256 };
    provenance.clips.push({ voice: clip.voice, cueId: clip.cueId, voiceId: clip.voiceId, sourceSha256: clip.sourceSha256, review: clip.review, ...measured });
  }
  await verifyManifest(manifest, publicRoot);
  const directory = path.join(publicRoot, "audio/narration");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "manifest.v1.json"), `${JSON.stringify(manifest)}\n`);
  return provenance;
}

async function main() {
  const [command, sourceRoot, onlyVoice] = process.argv.slice(2);
  if (command === "publish" && sourceRoot) {
    const plan = JSON.parse(await readFile(path.resolve(sourceRoot), "utf8"));
    const provenance = await publishApproved(plan, path.join(root, "apps/web/public"));
    await writeFile(path.join(root, "assets/narration-source/release.v1.json"), `${JSON.stringify(provenance, null, 2)}\n`);
    console.log(JSON.stringify({ published: provenance.clips.length }));
    return;
  }
  if (command === "verify") {
    const publicRoot = path.join(root, "apps/web/public");
    const manifest = JSON.parse(await readFile(path.join(publicRoot, "audio/narration/manifest.v1.json"), "utf8"));
    console.log(JSON.stringify(await verifyManifest(manifest, publicRoot)));
    return;
  }
  if (command !== "prepare" || !sourceRoot) throw new Error("Usage: narration-assets.mjs prepare <production-dir> | publish <approval.json> | verify");
  const directory = path.resolve(sourceRoot);
  const plan = JSON.parse(await readFile(path.join(directory, "jobs.json"), "utf8"));
  if (onlyVoice && !NARRATION_VOICES.includes(onlyVoice)) throw new Error("Unknown voice filter");
  const reportFile = path.join(directory, onlyVoice ? `technical-report.${onlyVoice}.json` : "technical-report.json");
  let previous;
  try { previous = JSON.parse(await readFile(reportFile, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const report = { version: 1, targetLufs, processing: "Constant gain only; no compression, EQ, denoise, music or added effects", acceptance: "Technical measurements only; pronunciation and performance require listening", clips: [] };
  for (const job of plan.jobs.filter((job) => !onlyVoice || job.voice.id === onlyVoice)) {
    const takes = [];
    for (const take of [1, 2]) {
      const source = path.join(directory, "originals", `${job.key}-take-${take}.mp3`);
      const destination = path.join(directory, "prepared", `${job.key}-take-${take}.mp3`);
      try {
        const saved = previous?.version === 1 && previous.targetLufs === targetLufs
          ? previous.clips.find((clip) => clip.voice === job.voice.id && clip.cueId === job.cueId)?.takes.find((item) => item.take === take)
          : null;
        // Reuse measurements only when both measured files are byte-for-byte unchanged.
        if (saved?.status === "technical-pass" && saved.source === source && saved.file === destination
          && validateAudio(saved.prepared) && sha256(await readFile(source)) === saved.original.sha256
          && sha256(await readFile(destination)) === saved.prepared.sha256) {
          takes.push(saved);
          continue;
        }
        const measurements = await prepareAudio(source, destination);
        takes.push({ take, source, file: destination, ...measurements, status: "technical-pass", listening: "pending" });
      } catch (error) {
        takes.push({ take, status: "failed", reason: error.message });
      }
    }
    report.clips.push({ voice: job.voice.id, cueId: job.cueId, text: job.text, inputText: job.inputText, voiceId: job.voice.voiceId, takes });
    await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ voice: job.voice.id, cue: job.cueId, passed: takes.filter((take) => take.status === "technical-pass").length }));
  }
  if (report.clips.some((clip) => !clip.takes.some((take) => take.status === "technical-pass"))) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
