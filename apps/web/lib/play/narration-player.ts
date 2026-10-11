import { readNarrationBytes } from "./narration-assets";

export interface NarrationClip {
  src: string;
  sha256?: string;
}

export type NarrationPlaybackResult = "started" | "skipped" | "cancelled" | "unavailable";

interface NarrationPlayerOptions {
  context: AudioContext;
  destination: AudioNode;
  canPlay: () => boolean;
  onSpeakingChange?: (speaking: boolean) => void;
  fetch?: typeof fetch;
}

const MAX_ENCODED_BYTES = 512 * 1024;
const MAX_DECODED_BYTES = 8 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 4;
const MAX_RECENT_OCCURRENCES = 16;
const LOAD_TIMEOUT_MS = 2_000;
const LOCAL_AUDIO_PATH = /^\/audio\/narration\/[a-z0-9][a-z0-9/_-]*\.(?:mp3|ogg|opus|wav)$/;
let stopOtherChannel: (() => void) | null = null;

/** A single local recording channel. The owner stops it on phase, room, mute and visibility changes. */
export function createNarrationPlayer(options: NarrationPlayerOptions) {
  const { context, destination } = options;
  const fetchAudio = options.fetch ?? globalThis.fetch;
  const cache = new Map<string, AudioBuffer>();
  const recentOccurrences = new Set<string>();
  let cacheBytes = 0;
  let revision = 0;
  let disposed = false;
  let pending: { occurrence: string; cancel: () => void } | null = null;
  let active: { source: AudioBufferSourceNode; gain: GainNode; cleanupTimer: ReturnType<typeof setTimeout>; onEnded: (() => void) | undefined } | null = null;

  function allowed() {
    return !disposed && context.state === "running" && options.canPlay();
  }

  function announce(speaking: boolean) {
    try { options.onSpeakingChange?.(speaking); } catch { /* Audio must not interrupt the table. */ }
  }

  function finish(ended = false) {
    const playing = active;
    if (!playing) return;
    active = null;
    clearTimeout(playing.cleanupTimer);
    playing.source.onended = null;
    try { playing.source.stop(); } catch { /* The recording may already have ended. */ }
    playing.source.disconnect();
    playing.gain.disconnect();
    announce(false);
    if (ended && allowed()) {
      try { playing.onEnded?.(); } catch { /* A follow-up must not interrupt the table. */ }
    }
  }

  function stop() {
    revision += 1;
    pending?.cancel();
    pending = null;
    finish();
  }

  function remember(src: string, buffer: AudioBuffer) {
    const bytes = buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
    if (bytes > MAX_DECODED_BYTES) return;
    while (cache.size >= MAX_CACHE_ENTRIES || cacheBytes + bytes > MAX_DECODED_BYTES) {
      const oldest = cache.entries().next().value;
      if (!oldest) break;
      cache.delete(oldest[0]);
      cacheBytes -= oldest[1].length * oldest[1].numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
    }
    cache.set(src, buffer);
    cacheBytes += bytes;
  }

  async function load(clip: NarrationClip, signal: AbortSignal, current: () => boolean) {
    const { src, sha256 } = clip;
    const cacheKey = `${src}:${sha256 ?? ""}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      cache.delete(cacheKey);
      cache.set(cacheKey, cached);
      return cached;
    }
    const response = await fetchAudio(src, { signal, credentials: "omit", redirect: "error" });
    const advertisedBytes = Number(response.headers.get("content-length"));
    if (!response.ok || advertisedBytes > MAX_ENCODED_BYTES || !current()) return null;
    const bytes = await readNarrationBytes(response, MAX_ENCODED_BYTES, signal);
    if (!bytes || !current()) return null;
    if (sha256) {
      if (!globalThis.crypto?.subtle) return null;
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      if (actual !== sha256 || !current()) return null;
    }
    const buffer = await context.decodeAudioData(bytes);
    if (!current() || !Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.duration > 20
      || buffer.numberOfChannels < 1 || buffer.numberOfChannels > 2
      || buffer.length * buffer.numberOfChannels * 4 > MAX_DECODED_BYTES) return null;
    remember(cacheKey, buffer);
    return buffer;
  }

  async function play(clip: NarrationClip, occurrence: string, volume = 0.85, onEnded?: () => void): Promise<NarrationPlaybackResult> {
    if (disposed) return "skipped";
    if (!allowed()) {
      stop();
      return "skipped";
    }
    if (occurrence && (pending?.occurrence === occurrence || recentOccurrences.has(occurrence))) return "skipped";
    stop();
    if (!occurrence || !LOCAL_AUDIO_PATH.test(clip.src) || !Number.isFinite(volume) || volume <= 0
      || (clip.sha256 !== undefined && !/^[a-f0-9]{64}$/.test(clip.sha256))) return "skipped";
    if (stopOtherChannel !== stop) stopOtherChannel?.();
    stopOtherChannel = stop;
    const requestRevision = revision;
    const controller = new AbortController();
    const current = () => revision === requestRevision && !controller.signal.aborted && allowed();
    let cancel!: () => void;
    const cancellation = new Promise<"cancelled" | "unavailable">((resolve) => {
      cancel = () => { controller.abort(); resolve("cancelled"); };
    });
    pending = { occurrence, cancel };
    let timeout!: ReturnType<typeof setTimeout>;
    let expired = false;
    const deadline = new Promise<"unavailable">((resolve) => {
      timeout = setTimeout(() => { expired = true; controller.abort(); resolve("unavailable"); }, LOAD_TIMEOUT_MS);
    });
    let source: AudioBufferSourceNode | null = null;
    let gain: GainNode | null = null;
    try {
      // Decode cannot be aborted. Race the whole load and recheck identity after every await.
      const result = await Promise.race([load(clip, controller.signal, current), cancellation, deadline]);
      if (typeof result === "string") return result;
      if (!current()) return "cancelled";
      if (!result) return "unavailable";
      source = context.createBufferSource();
      gain = context.createGain();
      source.buffer = result;
      gain.gain.value = Math.min(volume, 1);
      source.connect(gain);
      gain.connect(destination);
      const playingSource = source;
      source.onended = () => { if (active?.source === playingSource) finish(true); };
      source.start();
      active = {
        source,
        gain,
        onEnded,
        cleanupTimer: setTimeout(() => { if (active?.source === playingSource) finish(); }, result.duration * 1000 + 500),
      };
      recentOccurrences.add(occurrence);
      if (recentOccurrences.size > MAX_RECENT_OCCURRENCES) recentOccurrences.delete(recentOccurrences.values().next().value!);
      announce(true);
      return "started";
    } catch {
      if (source) {
        source.onended = null;
        try { source.stop(); } catch { /* Start may have failed. */ }
        source.disconnect();
      }
      gain?.disconnect();
      return expired || current() ? "unavailable" : "cancelled";
    } finally {
      clearTimeout(timeout);
      if (revision === requestRevision) pending = null;
    }
  }

  function dispose() {
    disposed = true;
    stop();
    cache.clear();
    cacheBytes = 0;
    recentOccurrences.clear();
    if (stopOtherChannel === stop) stopOtherChannel = null;
  }

  return { play, stop, dispose };
}
