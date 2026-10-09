import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNarrationPreview } from "../narration-preview";
import { setSoundEnabled, SOUND_CHANGE_EVENT } from "@/lib/sound";

const mocks = vi.hoisted(() => ({ load: vi.fn(), createPlayer: vi.fn() }));
vi.mock("../narration-assets", () => ({ loadNarrationClip: mocks.load }));
vi.mock("../narration-player", () => ({ createNarrationPlayer: mocks.createPlayer }));
const clip = { src: "/audio/narration/v1/classic/preview-night.mp3", durationMs: 4000, sha256: "a".repeat(64) };
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

describe("explicit narration previews", () => {
  let contexts: Array<{ state: string; destination: AudioNode; resume: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }>;
  let players: Array<{ play: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }>;
  let previews: Array<ReturnType<typeof createNarrationPreview>>;
  function setup() {
    const status = vi.fn();
    const preview = createNarrationPreview(status);
    previews.push(preview);
    return { preview, status };
  }
  beforeEach(() => {
    vi.useFakeTimers();
    contexts = [];
    players = [];
    previews = [];
    mocks.load.mockReset().mockResolvedValue(clip);
    mocks.createPlayer.mockReset().mockImplementation((options) => {
      const player = {
        play: vi.fn(async () => { options.onSpeakingChange(true); return "started"; }),
        stop: vi.fn(), dispose: vi.fn(),
      };
      players.push(player);
      return player;
    });
    vi.stubGlobal("AudioContext", class {
      state = "suspended";
      destination = {} as AudioNode;
      resume = vi.fn(async () => { this.state = "running"; });
      close = vi.fn(async () => { this.state = "closed"; });
      constructor() { contexts.push(this); }
    });
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    localStorage.clear();
    setSoundEnabled(true);
  });
  afterEach(() => {
    previews.forEach((preview) => preview.dispose());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    localStorage.clear();
  });

  it("does nothing before a gesture, resumes synchronously, and never unmutes", async () => {
    const { preview, status } = setup();
    expect(contexts).toHaveLength(0);
    expect(mocks.load).not.toHaveBeenCalled();
    const pending = preview.play("classic_nikolay", "preview.night");
    expect(contexts).toHaveLength(1);
    expect(contexts[0]!.resume).toHaveBeenCalledOnce();
    await pending;
    expect(mocks.load).toHaveBeenCalledWith("classic_nikolay", "preview.night", expect.any(AbortSignal));
    expect(players[0]!.play).toHaveBeenCalledWith(clip, expect.stringContaining("classic_nikolay:preview.night"));
    expect(status).toHaveBeenLastCalledWith("playing");
    setSoundEnabled(false);
    await preview.play("witch", "preview.finale");
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("werewolf-sound")).toBe("off");
  });

  it("refuses hidden, muted and unsupported playback before constructing audio", async () => {
    const { preview } = setup();
    setSoundEnabled(false);
    await preview.play("classic", "preview.night");
    setSoundEnabled(true);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    await preview.play("classic", "preview.night");
    expect(contexts).toHaveLength(0);
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it("reports absent assets and remains retryable", async () => {
    mocks.load.mockResolvedValueOnce(null);
    const { preview, status } = setup();
    await preview.play("witch_moonglow", "preview.finale");
    expect(status).toHaveBeenLastCalledWith("unavailable");
    expect(players[0]!.play).not.toHaveBeenCalled();
    await preview.play("witch_moonglow", "preview.finale");
    expect(status).toHaveBeenLastCalledWith("playing");
  });

  it.each(["stop", "dispose", "mute", "storage", "hidden", "pagehide"])("cancels pending work on %s without a late start", async (action) => {
    const pending = deferred<typeof clip>();
    mocks.load.mockReturnValue(pending.promise);
    const { preview, status } = setup();
    const playing = preview.play("classic", "preview.night");
    await vi.waitFor(() => expect(mocks.load).toHaveBeenCalled());
    const signal = mocks.load.mock.calls[0]![2] as AbortSignal;
    if (action === "stop") preview.stop();
    if (action === "dispose") preview.dispose();
    if (action === "mute") setSoundEnabled(false);
    if (action === "storage") { localStorage.setItem("werewolf-sound", "off"); window.dispatchEvent(new StorageEvent("storage", { key: "werewolf-sound" })); }
    if (action === "hidden") { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); }
    if (action === "pagehide") window.dispatchEvent(new Event("pagehide"));
    expect(signal.aborted).toBe(true);
    await playing;
    pending.resolve(clip);
    await vi.advanceTimersByTimeAsync(1);
    expect(players[0]!.play).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalledWith("playing");
  });

  it("bounds stalled loading and closes its AudioContext on disposal", async () => {
    mocks.load.mockReturnValue(new Promise(() => {}));
    const { preview, status } = setup();
    const playing = preview.play("classic", "preview.night");
    await vi.advanceTimersByTimeAsync(5001);
    await playing;
    expect(status).toHaveBeenLastCalledWith("unavailable");
    preview.dispose();
    expect(contexts[0]!.close).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event(SOUND_CHANGE_EVENT));
  });

  it("stops the preceding preview before another controller starts", async () => {
    const a = setup();
    const b = setup();
    await a.preview.play("classic", "preview.night");
    await b.preview.play("witch", "preview.finale");
    expect(players[0]!.stop).toHaveBeenCalled();
    expect(a.status).toHaveBeenLastCalledWith("idle");
    expect(b.status).toHaveBeenLastCalledWith("playing");
  });

  it("does not start after a rejected AudioContext resume", async () => {
    const { preview, status } = setup();
    const first = preview.play("classic", "preview.night");
    await first;
    contexts[0]!.state = "suspended";
    contexts[0]!.resume.mockRejectedValue(new Error("autoplay rejected"));
    await preview.play("classic", "preview.finale");
    expect(status).toHaveBeenLastCalledWith("unavailable");
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it("resumes an interrupted context synchronously on the next preview gesture", async () => {
    const { preview, status } = setup();
    await preview.play("classic", "preview.night");
    contexts[0]!.state = "interrupted";
    contexts[0]!.resume.mockClear();
    const next = preview.play("witch", "preview.night");
    expect(contexts[0]!.resume).toHaveBeenCalledOnce();
    await next;
    expect(players[0]!.play).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenLastCalledWith("playing");
  });
});
