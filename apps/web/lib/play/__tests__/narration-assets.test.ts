import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseNarrationManifest, readNarrationBytes } from "../narration-assets";

const cue = "mafia.phase.night";
const clip = { src: "/audio/narration/v1/classic/mafia-phase-night.mp3", durationMs: 4000, sha256: "a".repeat(64) };
const manifest = () => ({ version: 1, voices: { classic: { [cue]: clip } } });

describe("reviewed narration manifest", () => {
  beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("accepts partial reviewed catalogs without requiring unavailable final clips", () => {
    expect(parseNarrationManifest(manifest())?.classic?.[cue]).toEqual(clip);
    expect(parseNarrationManifest({ version: 1, voices: {} })).toEqual({});
  });

  it.each([
    { src: "https://example.com/file.mp3" }, { src: "/audio/narration/v1/witch/mafia-phase-night.mp3" },
    { src: `${clip.src}?token=secret` }, { durationMs: 0 }, { durationMs: 20001 },
    { durationMs: Number.NaN }, { sha256: "bad" },
  ])("rejects an invalid manifest entry %j", change => {
    expect(parseNarrationManifest({ version: 1, voices: { classic: { [cue]: { ...clip, ...change } } } })).toBeNull();
  });

  it("supports all six runtime directories and rejects traversal/unknown voices", () => {
    for (const voice of ["classic", "classic_nikolay", "old_villager", "inspector", "witch", "witch_moonglow"]) {
      const src = `/audio/narration/v1/${voice.replaceAll("_", "-")}/preview-night.mp3`;
      expect(parseNarrationManifest({ version: 1, voices: { [voice]: { "preview.night": { ...clip, src } } } })?.[voice]?.["preview.night"]?.src).toBe(src);
    }
    expect(parseNarrationManifest({ version: 1, voices: { stranger: {} } })).toBeNull();
    expect(parseNarrationManifest({ version: 1, voices: { classic: { "../../other": clip } } })).toBeNull();
  });

  it("lazily fetches once, caches only validated data and has no missing-voice fallback", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(manifest())));
    vi.stubGlobal("fetch", fetch);
    const { loadNarrationClip } = await import("../narration-assets");
    expect(fetch).not.toHaveBeenCalled();
    expect(await loadNarrationClip("classic", cue)).toEqual(clip);
    expect(await loadNarrationClip("witch", cue)).toBeNull();
    expect(await loadNarrationClip("classic", "mafia.finale.mafia")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/audio/narration/manifest.v1.json", expect.objectContaining({ credentials: "omit", redirect: "error" }));
  });

  it("handles absent and malformed manifests silently and can retry a later transition", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(new Response("bad json")).mockResolvedValueOnce(new Response(JSON.stringify(manifest())));
    vi.stubGlobal("fetch", fetch);
    const { loadNarrationClip } = await import("../narration-assets");
    expect(await loadNarrationClip("classic", cue)).toBeNull();
    expect(await loadNarrationClip("classic", cue)).toBeNull();
    expect(await loadNarrationClip("classic", cue)).toEqual(clip);
  });

  it("cancels a pending load and ignores even an unabortable late response", async () => {
    let resolve!: (value: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);
    const { loadNarrationClip } = await import("../narration-assets");
    const controller = new AbortController();
    const pending = loadNarrationClip("classic", cue, controller.signal);
    controller.abort();
    expect(await pending).toBeNull();
    resolve(new Response(JSON.stringify(manifest())));
    await vi.advanceTimersByTimeAsync(0);
    fetch.mockResolvedValueOnce(new Response("", { status: 404 }));
    expect(await loadNarrationClip("classic", cue)).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("times out a stuck fetch without leaking a pending caller", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { loadNarrationClip } = await import("../narration-assets");
    const pending = loadNarrationClip("classic", cue);
    await vi.advanceTimersByTimeAsync(1501);
    expect(await pending).toBeNull();
  });

  it("never fetches for an already aborted caller", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { loadNarrationClip } = await import("../narration-assets");
    const controller = new AbortController(); controller.abort();
    expect(await loadNarrationClip("classic", cue, controller.signal)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("bounds streamed bytes without trusting content-length", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(11)); }, cancel });
    expect(await readNarrationBytes(new Response(body), 10, new AbortController().signal)).toBeNull();
    expect(cancel).toHaveBeenCalled();
  });
});
