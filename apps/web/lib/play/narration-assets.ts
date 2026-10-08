import type { NarratorVoice } from "@werewolf/shared";

export interface RecordedNarrationClip {
  src: string;
  durationMs: number;
  sha256: string;
}

const VOICES = new Set(["classic", "classic_nikolay", "old_villager", "inspector", "witch", "witch_moonglow"]);
const CUE_ID = /^[a-z]+(?:\.[a-z]+)+$/;
const MAX_MANIFEST_BYTES = 128 * 1024;
let cached: Record<string, Record<string, RecordedNarrationClip>> | null = null;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** The published manifest allows authorized recordings, never the source script catalog. */
export function parseNarrationManifest(value: unknown): typeof cached {
  if (!record(value) || value.version !== 1 || !record(value.voices)
    || Object.keys(value.voices).length > VOICES.size) return null;
  const voices: NonNullable<typeof cached> = Object.create(null);
  for (const [voice, entries] of Object.entries(value.voices)) {
    if (!VOICES.has(voice) || !record(entries) || Object.keys(entries).length > 64) return null;
    const clips: Record<string, RecordedNarrationClip> = Object.create(null);
    for (const [cue, clip] of Object.entries(entries)) {
      const src = `/audio/narration/v1/${voice.replaceAll("_", "-")}/${cue.replaceAll(".", "-")}.mp3`;
      if (!CUE_ID.test(cue) || !record(clip) || clip.src !== src
        || typeof clip.durationMs !== "number" || !Number.isFinite(clip.durationMs)
        || clip.durationMs <= 0 || clip.durationMs > 20_000
        || typeof clip.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(clip.sha256)) return null;
      clips[cue] = { src, durationMs: clip.durationMs, sha256: clip.sha256 };
    }
    voices[voice] = clips;
  }
  return voices;
}

/** Enforce the byte limit while streaming, not only after an unbounded response has been buffered. */
export async function readNarrationBytes(response: Response, limit: number, signal: AbortSignal): Promise<ArrayBuffer | null> {
  if (!response.ok || signal.aborted || Number(response.headers.get("content-length")) > limit || !response.body) {
    void response.body?.cancel().catch(() => undefined);
    return null;
  }
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { cancel(); return null; }
      chunks.push(value);
    }
    if (signal.aborted || !size) return null;
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes.buffer;
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

export async function loadNarrationClip(voice: NarratorVoice, cueId: string, signal?: AbortSignal): Promise<RecordedNarrationClip | null> {
  if (!VOICES.has(voice) || !CUE_ID.test(cueId) || signal?.aborted) return null;
  if (cached) return cached[voice]?.[cueId] ?? null;
  const controller = new AbortController();
  let cancel!: () => void;
  const cancelled = new Promise<null>((resolve) => {
    cancel = () => { controller.abort(); resolve(null); };
  });
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(cancel, 1500);
  try {
    return await Promise.race([cancelled, (async () => {
      const response = await fetch("/audio/narration/manifest.v1.json", {
        signal: controller.signal, credentials: "omit", redirect: "error", cache: "no-cache",
      });
      const bytes = await readNarrationBytes(response, MAX_MANIFEST_BYTES, controller.signal);
      if (!bytes || controller.signal.aborted) return null;
      const manifest = parseNarrationManifest(JSON.parse(new TextDecoder().decode(bytes)));
      if (!manifest || controller.signal.aborted) return null;
      cached = manifest;
      return manifest[voice]?.[cueId] ?? null;
    })()]);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
