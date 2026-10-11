import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNarrationPlayer } from "../narration-player";

const clip = { src: "/audio/narration/v1/classic-night-a1b2.mp3" };
const recording = (duration = 4) => ({ duration, numberOfChannels: 1, length: duration * 44100 }) as AudioBuffer;
const response = (ok = true, size = 100) => {
  const value = new Response(new Uint8Array(size), { status: ok ? 200 : 404 });
  vi.spyOn(value, "arrayBuffer");
  return value;
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function setup() {
  const sources: Array<ReturnType<typeof node>> = [];
  function node() {
    return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      onended: null as (() => void) | null, buffer: null as AudioBuffer | null, gain: { value: 0 } };
  }
  const context = {
    state: "running",
    createGain: vi.fn(node),
    createBufferSource: vi.fn(() => { const source = node(); sources.push(source); return source; }),
    decodeAudioData: vi.fn(async () => recording()),
  };
  const permitted = { value: true };
  const fetch = vi.fn<typeof globalThis.fetch>(async () => response());
  const onSpeakingChange = vi.fn();
  const player = createNarrationPlayer({ context: context as unknown as AudioContext,
    destination: {} as AudioNode, canPlay: () => permitted.value, fetch, onSpeakingChange });
  return { player, context, sources, fetch, permitted, onSpeakingChange };
}

describe("prerecorded narration channel", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("does not fetch or create sources before consent or while the context is suspended", async () => {
    const { player, permitted, fetch, context } = setup();
    permitted.value = false;
    expect(await player.play(clip, "one")).toBe("skipped");
    permitted.value = true;
    context.state = "suspended";
    expect(await player.play(clip, "one")).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
    expect(context.createBufferSource).not.toHaveBeenCalled();
  });

  it.each(["https://elevenlabs.io/file.mp3", "//example.com/file.mp3", "/api/private.mp3", "/audio/narration/../secret.mp3", "/audio/narration/x.mp3?token=secret", "data:audio/mp3;base64,abc", "/audio/narration/x%2fy.mp3"])("refuses a non-catalog asset path: %s", async (src) => {
    const { player, fetch } = setup();
    expect(await player.play({ src }, "one")).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("plays only once for a confirmed occurrence and reuses the buffer on the next one", async () => {
    const { player, fetch, context, sources, onSpeakingChange } = setup();
    expect(await player.play(clip, "room-a:round-1:night", 0.6)).toBe("started");
    expect(context.createGain.mock.results[0]!.value.gain.value).toBe(0.6);
    expect(fetch).toHaveBeenCalledWith(clip.src, expect.objectContaining({ credentials: "omit", redirect: "error" }));
    expect(onSpeakingChange).toHaveBeenLastCalledWith(true);
    sources[0]!.onended!();
    expect(onSpeakingChange).toHaveBeenLastCalledWith(false);
    expect(await player.play(clip, "room-a:round-1:night")).toBe("skipped");
    expect(await player.play(clip, "room-a:round-2:night")).toBe("started");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    player.dispose();
  });

  it("deduplicates a pending occurrence without restarting its fetch", async () => {
    const { player, fetch } = setup();
    const loading = deferred<Response>();
    fetch.mockReturnValue(loading.promise);
    const first = player.play(clip, "one");
    expect(await player.play(clip, "one")).toBe("skipped");
    loading.resolve(response());
    expect(await first).toBe("started");
    expect(fetch).toHaveBeenCalledTimes(1);
    player.dispose();
  });

  it("cancels fetch immediately on stop and ignores a late response", async () => {
    const { player, fetch, sources } = setup();
    const loading = deferred<Response>();
    fetch.mockReturnValue(loading.promise);
    const playing = player.play(clip, "one");
    const signal = fetch.mock.calls[0]![1]!.signal!;
    player.stop();
    expect(signal.aborted).toBe(true);
    expect(await playing).toBe("cancelled");
    loading.resolve(response());
    await vi.advanceTimersByTimeAsync(1);
    expect(sources).toHaveLength(0);
  });

  it("does not start or cache a decode that finishes after cancellation", async () => {
    const { player, context, fetch, sources } = setup();
    const decoding = deferred<AudioBuffer>();
    context.decodeAudioData.mockReturnValueOnce(decoding.promise);
    const playing = player.play(clip, "one");
    await vi.advanceTimersByTimeAsync(0);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    player.stop();
    expect(await playing).toBe("cancelled");
    decoding.resolve(recording());
    await vi.advanceTimersByTimeAsync(0);
    expect(sources).toHaveLength(0);
    expect(await player.play(clip, "two")).toBe("started");
    expect(fetch).toHaveBeenCalledTimes(2);
    player.dispose();
  });

  it("checks permission again after decode", async () => {
    const { player, context, permitted, sources } = setup();
    const decoding = deferred<AudioBuffer>();
    context.decodeAudioData.mockReturnValue(decoding.promise);
    const playing = player.play(clip, "one");
    await vi.advanceTimersByTimeAsync(0);
    permitted.value = false;
    decoding.resolve(recording());
    expect(await playing).toBe("cancelled");
    expect(sources).toHaveLength(0);
  });

  it("supersedes a pending phase without cancelling the new request", async () => {
    const { player, fetch, sources } = setup();
    const old = deferred<Response>();
    fetch.mockReturnValueOnce(old.promise);
    const first = player.play(clip, "night");
    const next = player.play({ src: "/audio/narration/v1/day.mp3" }, "day");
    expect(await first).toBe("cancelled");
    expect(await next).toBe("started");
    old.resolve(response());
    await vi.advanceTimersByTimeAsync(0);
    expect(sources).toHaveLength(1);
    player.dispose();
  });

  it("stops a playing clip before another starts and restores ducking on disposal", async () => {
    const { player, sources, onSpeakingChange } = setup();
    await player.play(clip, "one");
    await player.play(clip, "two");
    expect(sources[0]!.stop).toHaveBeenCalled();
    expect(sources[0]!.disconnect).toHaveBeenCalled();
    expect(sources[0]!.onended).toBeNull();
    expect(onSpeakingChange.mock.calls.map(([value]) => value)).toEqual([true, false, true]);
    player.dispose();
    expect(onSpeakingChange).toHaveBeenLastCalledWith(false);
    expect(await player.play(clip, "three")).toBe("skipped");
  });

  it("times out even a non-abortable decode and never plays it later", async () => {
    const { player, context, sources } = setup();
    const decoding = deferred<AudioBuffer>();
    context.decodeAudioData.mockReturnValue(decoding.promise);
    const playing = player.play(clip, "one");
    await vi.advanceTimersByTimeAsync(2001);
    expect(await playing).toBe("unavailable");
    decoding.resolve(recording());
    await vi.advanceTimersByTimeAsync(0);
    expect(sources).toHaveLength(0);
  });

  it("handles a failed request without poisoning retry", async () => {
    const { player, fetch } = setup();
    fetch.mockRejectedValueOnce(new Error("offline"));
    expect(await player.play(clip, "one")).toBe("unavailable");
    expect(await player.play(clip, "one")).toBe("started");
    player.dispose();
  });

  it("reports a deadline consistently when fetch rejects on abort", async () => {
    const { player, fetch } = setup();
    fetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const playing = player.play(clip, "one");
    await vi.advanceTimersByTimeAsync(2001);
    expect(await playing).toBe("unavailable");
  });

  it("rejects an advertised oversized file before buffering it", async () => {
    const { player, fetch } = setup();
    const file = response();
    file.headers.set("content-length", String(512 * 1024 + 1));
    fetch.mockResolvedValue(file);
    expect(await player.play(clip, "one")).toBe("unavailable");
    expect(file.arrayBuffer).not.toHaveBeenCalled();
  });

  it("does not replay a disposed request even if its response arrives later", async () => {
    const { player, fetch, sources } = setup();
    const loading = deferred<Response>();
    fetch.mockReturnValue(loading.promise);
    const playing = player.play(clip, "one");
    player.dispose();
    expect(await playing).toBe("cancelled");
    loading.resolve(response());
    await vi.advanceTimersByTimeAsync(0);
    expect(sources).toHaveLength(0);
  });

  it("stops current audio if a duplicate arrives after permission was revoked", async () => {
    const { player, permitted, sources } = setup();
    await player.play(clip, "one");
    permitted.value = false;
    expect(await player.play(clip, "one")).toBe("skipped");
    expect(sources[0]!.stop).toHaveBeenCalled();
    player.dispose();
  });

  it.each([0, Number.NaN, Number.NEGATIVE_INFINITY])("does not load audio at invalid or silent volume %s", async (volume) => {
    const { player, fetch } = setup();
    expect(await player.play(clip, "one", volume)).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("contains speaking callback errors and limits gain to one", async () => {
    const { player, onSpeakingChange, context } = setup();
    onSpeakingChange.mockImplementation(() => { throw new Error("UI unavailable"); });
    expect(await player.play(clip, "one", 3)).toBe("started");
    expect(context.createGain.mock.results[0]!.value.gain.value).toBe(1);
    expect(() => player.dispose()).not.toThrow();
  });

  it.each([0, 21, Number.NaN, Number.POSITIVE_INFINITY])("rejects an invalid decoded duration %s", async (duration) => {
    const { player, context, sources } = setup();
    context.decodeAudioData.mockResolvedValue(recording(duration));
    expect(await player.play(clip, "one")).toBe("unavailable");
    expect(sources).toHaveLength(0);
  });

  it("rejects a bad HTTP response, an empty file and an oversized file", async () => {
    const { player, fetch, context } = setup();
    fetch.mockResolvedValueOnce(response(false));
    expect(await player.play(clip, "one")).toBe("unavailable");
    fetch.mockResolvedValueOnce(response(true, 0));
    expect(await player.play(clip, "two")).toBe("unavailable");
    fetch.mockResolvedValueOnce(response(true, 512 * 1024 + 1));
    expect(await player.play(clip, "three")).toBe("unavailable");
    expect(context.decodeAudioData).not.toHaveBeenCalled();
  });

  it("evicts old buffers instead of retaining the entire catalog", async () => {
    const { player, fetch } = setup();
    for (let index = 0; index < 5; index++) {
      await player.play({ src: `/audio/narration/v1/clip-${index}.mp3` }, `cue-${index}`);
    }
    await player.play({ src: "/audio/narration/v1/clip-0.mp3" }, "cue-again");
    expect(fetch).toHaveBeenCalledTimes(6);
    player.dispose();
  });

  it("cleans up a clip whose browser never fires ended", async () => {
    const { player, sources, onSpeakingChange } = setup();
    await player.play(clip, "one");
    await vi.advanceTimersByTimeAsync(4501);
    expect(sources[0]!.disconnect).toHaveBeenCalled();
    expect(onSpeakingChange).toHaveBeenLastCalledWith(false);
    player.dispose();
  });

  it("cleans up and allows retry when Web Audio start throws", async () => {
    const { player, context, sources } = setup();
    const create = context.createBufferSource.getMockImplementation()!;
    context.createBufferSource.mockImplementationOnce(() => {
      const source = create();
      source.start.mockImplementation(() => { throw new Error("interrupted"); });
      return source;
    });
    expect(await player.play(clip, "one")).toBe("unavailable");
    expect(sources[0]!.disconnect).toHaveBeenCalled();
    expect(await player.play(clip, "one")).toBe("started");
    player.dispose();
  });

  it("runs a personal-finale continuation only on a natural end, never cancellation", async () => {
    const { player, sources } = setup();
    const ended = vi.fn();
    await player.play(clip, "main", 0.8, ended);
    player.stop();
    expect(ended).not.toHaveBeenCalled();
    await player.play(clip, "next", 0.8, ended);
    sources[1]!.onended!();
    expect(ended).toHaveBeenCalledTimes(1);
    player.dispose();
  });

  it("does not run a continuation after permission was revoked or on the cleanup watchdog", async () => {
    const { player, sources, permitted } = setup();
    const ended = vi.fn();
    await player.play(clip, "main", 0.8, ended);
    permitted.value = false;
    sources[0]!.onended!();
    permitted.value = true;
    await player.play(clip, "next", 0.8, ended);
    await vi.advanceTimersByTimeAsync(4501);
    expect(ended).not.toHaveBeenCalled();
    player.dispose();
  });

  it("does not allow a preview and a table narration channel to overlap", async () => {
    const table = setup();
    const preview = setup();
    await table.player.play(clip, "table");
    await preview.player.play(clip, "preview");
    expect(table.sources[0]!.stop).toHaveBeenCalled();
    table.player.dispose();
    preview.player.dispose();
  });

  it("refuses audio whose checksum differs from the reviewed manifest", async () => {
    const { webcrypto } = await import("node:crypto");
    vi.stubGlobal("crypto", webcrypto);
    const { player, context } = setup();
    expect(await player.play({ ...clip, sha256: "0".repeat(64) }, "one")).toBe("unavailable");
    expect(context.decodeAudioData).not.toHaveBeenCalled();
    player.dispose();
    vi.unstubAllGlobals();
  });

  it("plays checksum-verified audio and rejects an invalid checksum before fetching", async () => {
    const { webcrypto, createHash } = await import("node:crypto");
    vi.stubGlobal("crypto", webcrypto);
    const { player, fetch } = setup();
    expect(await player.play({ ...clip, sha256: "not-a-hash" }, "bad")).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
    const sha256 = createHash("sha256").update(new Uint8Array(100)).digest("hex");
    expect(await player.play({ ...clip, sha256 }, "one")).toBe("started");
    player.dispose();
    vi.unstubAllGlobals();
  });
});
