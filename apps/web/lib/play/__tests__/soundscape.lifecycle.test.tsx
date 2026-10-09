import { act, cleanup, render } from "@testing-library/react";
import { Activity, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SoundscapeHost as Host } from "@/components/play/SoundscapeHost";
import type { SoundScene } from "../soundscape";

// Keep cue selection, coordination, byte loading and playback real; only assets and audio are fixtures.
vi.mock("../narration-assets", async (original) => ({
  ...await original<typeof import("../narration-assets")>(),
  loadNarrationClip: async (voice: string, cue: string) => ({
    src: `/audio/narration/v1/${voice}/${cue.replaceAll(".", "-")}.mp3`,
  }),
}));

const recording = { duration: 4, numberOfChannels: 1, length: 32000 } as AudioBuffer;
function param() {
  return { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() };
}
function node() {
  return { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    gain: param(), frequency: param(), Q: param(), delayTime: param(),
    type: "", loop: false, buffer: null as AudioBuffer | null, onended: null as (() => void) | null };
}
let audio: FakeAudioContext;
class FakeAudioContext {
  state = "running";
  currentTime = 0;
  sampleRate = 8000;
  destination = node();
  sources: ReturnType<typeof node>[] = [];
  constructor() { audio = this; }
  createGain = vi.fn(node);
  createBiquadFilter = vi.fn(node);
  createDelay = vi.fn(node);
  createSource = () => { const source = node(); this.sources.push(source); return source; };
  createBufferSource = vi.fn(this.createSource);
  createOscillator = vi.fn(this.createSource);
  createBuffer = vi.fn((_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }));
  decodeAudioData = vi.fn(async (_bytes: ArrayBuffer) => recording);
  resume = vi.fn(async () => { this.state = "running"; });
  suspend = vi.fn(async () => { this.state = "suspended"; });
}
type Props = ComponentProps<typeof Host>;
const snapshot = (phase: SoundScene["phase"]): Props["snapshot"] => ({
  mode: "werewolves_classic", phase, round: 2, votingCycle: 1, narratorVoice: "classic", winnerTeam: "",
  players: [], publicEvents: [],
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const narrationSources = () => audio.sources.filter((source) => source.buffer === recording);
const flush = async (ms = 0) => {
  await act(async () => {
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(ms);
  });
};
const setHidden = (hidden: boolean) => {
  vi.spyOn(document, "hidden", "get").mockReturnValue(hidden);
  document.dispatchEvent(new Event("visibilitychange"));
};
const removeListeners: Array<() => void> = [];
let SoundscapeHost: typeof Host;
let fetchAudio: ReturnType<typeof vi.fn<typeof fetch>>;

async function mount(mode: SoundScene["mode"] = "werewolves_classic") {
  let props: Props = { snapshot: { ...snapshot("lobby"), mode }, room: { roomId: "synthetic-room-a", state: {} },
    connected: true, liveMode: false, cueMode: "audio_vibration" };
  let activity: "visible" | "hidden" = "visible";
  const tree = () => <Activity mode={activity}><SoundscapeHost {...props} /></Activity>;
  const view = render(tree());
  await flush();
  const update = (next: Partial<Props>) => { props = { ...props, ...next }; view.rerender(tree()); };
  return {
    ...view,
    update,
    phase: (phase: SoundScene["phase"], values: Partial<Props["snapshot"]> = {}) => {
      update({ snapshot: { ...props.snapshot, phase, ...values } });
    },
    activity: (next: typeof activity) => { activity = next; view.rerender(tree()); },
  };
}

describe("narration host-to-player lifecycle", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem("werewolf-sound", "on");
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    for (const target of [window, document] as EventTarget[]) {
      const add = target.addEventListener.bind(target);
      vi.spyOn(target, "addEventListener").mockImplementation((type, listener, options) => {
        add(type, listener, options);
        removeListeners.push(() => target.removeEventListener(type, listener, options));
      });
    }
    fetchAudio = vi.fn<typeof fetch>(async () => new Response(new Uint8Array(100)));
    vi.stubGlobal("fetch", fetchAudio);
    vi.stubGlobal("AudioContext", FakeAudioContext);
    ({ SoundscapeHost } = await import("@/components/play/SoundscapeHost"));
  });
  afterEach(() => {
    cleanup();
    removeListeners.splice(0).forEach((remove) => remove());
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it.each(["werewolves_classic", "mafia_free", "mafia_sport"] as const)("plays only the correct public phase clip for %s", async (mode) => {
    const table = await mount(mode);
    const phases: SoundScene["phase"][] = ["role_reveal", "first_night", "night", "day_announcement", "day_discussion"];
    if (mode === "mafia_sport") phases.push("nomination", "defense");
    phases.push("voting", "resolution");
    if (mode === "werewolves_classic") phases.push("hunter_revenge", "mayor_successor");
    expect(fetchAudio).not.toHaveBeenCalled();
    for (const phase of phases) {
      table.phase(phase);
      await flush(1000);
      const family = mode === "werewolves_classic" ? "werewolves" : "mafia";
      expect(fetchAudio).toHaveBeenLastCalledWith(`/audio/narration/v1/classic/${family}-phase-${phase.replaceAll("_", "-")}.mp3`, expect.any(Object));
      const sources = narrationSources();
      expect(sources.at(-1)!.start).toHaveBeenCalledOnce();
      expect(sources.slice(0, -1).every((source) => source.stop.mock.calls.length > 0)).toBe(true);
    }
    expect(narrationSources()).toHaveLength(phases.length);
    table.phase("paused");
    await flush(1000);
    expect(narrationSources()).toHaveLength(phases.length);
    expect(narrationSources().at(-1)!.stop).toHaveBeenCalledOnce();
  });

  it("deduplicates snapshots and reconnect, but accepts a fresh ballot cycle", async () => {
    const table = await mount();
    table.phase("voting");
    await flush(1000);
    table.phase("voting");
    await flush(1000);
    table.update({ connected: false });
    table.update({ connected: true, room: { roomId: "synthetic-room-a", state: {} } });
    await flush(1000);
    expect(narrationSources()).toHaveLength(1);
    expect(narrationSources()[0]!.stop).toHaveBeenCalledOnce();
    table.phase("voting", { votingCycle: 2 });
    await flush(1000);
    expect(narrationSources()).toHaveLength(2);
  });

  it.each(["Activity", "visibility"] as const)("stops speech on %s hide and returns without replaying hidden phases", async (kind) => {
    const table = await mount();
    table.phase("night");
    await flush(1000);
    if (kind === "Activity") table.activity("hidden");
    else setHidden(true);
    expect(narrationSources()[0]!.stop).toHaveBeenCalledOnce();
    table.phase("day_announcement");
    await flush(1000);
    if (kind === "Activity") table.activity("visible");
    else setHidden(false);
    await flush(1000);
    expect(narrationSources()).toHaveLength(1);
    table.phase("day_discussion");
    await flush(1000);
    expect(narrationSources()).toHaveLength(2);
  });

  it("does not queue narration while audio is locked or replay it on unlock", async () => {
    const table = await mount();
    audio.state = "suspended";
    audio.resume.mockRejectedValue(new Error("Autoplay blocked"));
    table.phase("night");
    await flush(1000);
    expect(fetchAudio).not.toHaveBeenCalled();
    audio.resume.mockImplementation(async () => { audio.state = "running"; });
    window.dispatchEvent(new Event("pointerdown"));
    table.phase("night");
    await flush(1000);
    expect(fetchAudio).not.toHaveBeenCalled();
    table.phase("day_announcement");
    await flush(1000);
    expect(narrationSources()).toHaveLength(1);
  });

  it.each(["delay", "fetch", "decode", "playing"] as const)("room departure cancels %s audio and rejects late completion", async (stage) => {
    const table = await mount();
    const response = deferred<Response>();
    const decode = deferred<AudioBuffer>();
    if (stage === "fetch") fetchAudio.mockReturnValueOnce(response.promise);
    if (stage === "decode") audio.decodeAudioData.mockReturnValueOnce(decode.promise);
    table.phase("night");
    if (stage !== "delay") await flush(1000);
    const signal = fetchAudio.mock.calls[0]?.[1]?.signal;
    table.update({ room: null });
    if (stage === "fetch" || stage === "decode") expect(signal?.aborted).toBe(true);
    if (stage === "playing") expect(narrationSources()[0]!.stop).toHaveBeenCalledOnce();
    response.resolve(new Response(new Uint8Array(100)));
    decode.resolve(recording);
    await flush(5000);
    expect(narrationSources()).toHaveLength(stage === "playing" ? 1 : 0);
    if (stage === "delay") expect(fetchAudio).not.toHaveBeenCalled();
  });

  it.each(["fetch", "playing"] as const)("voice switch cancels %s speech without replaying the same occurrence", async (stage) => {
    const table = await mount();
    const pending = deferred<Response>();
    if (stage === "fetch") fetchAudio.mockReturnValueOnce(pending.promise);
    table.phase("night");
    await flush(1000);
    const signal = fetchAudio.mock.calls[0]![1]!.signal!;
    table.phase("night", { narratorVoice: "witch_moonglow" });
    if (stage === "fetch") expect(signal.aborted).toBe(true);
    else expect(narrationSources()[0]!.stop).toHaveBeenCalledOnce();
    pending.resolve(new Response(new Uint8Array(100)));
    await flush(1000);
    expect(fetchAudio).toHaveBeenCalledTimes(1);
    table.phase("day_announcement");
    await flush(1000);
    expect(fetchAudio).toHaveBeenLastCalledWith("/audio/narration/v1/witch_moonglow/werewolves-phase-day-announcement.mp3", expect.any(Object));
    expect(narrationSources()).toHaveLength(stage === "playing" ? 2 : 1);
  });

  it("rapid scene changes play only the latest phase and cannot revive an old decode", async () => {
    const table = await mount();
    const pending = deferred<AudioBuffer>();
    audio.decodeAudioData.mockReturnValueOnce(pending.promise);
    table.phase("night");
    await flush(1000);
    table.phase("day_announcement");
    await flush(200);
    table.phase("day_discussion");
    await flush(200);
    table.phase("voting");
    await flush(1000);
    pending.resolve(recording);
    await flush();
    expect(fetchAudio).toHaveBeenCalledTimes(2);
    expect(fetchAudio).toHaveBeenLastCalledWith("/audio/narration/v1/classic/werewolves-phase-voting.mp3", expect.any(Object));
    expect(narrationSources()).toHaveLength(1);
  });

  it("does not inspect private fields or infer a cue from event text", async () => {
    const table = await mount();
    const privateRead = vi.fn(() => { throw new Error("Private state must not select narration"); });
    const next: Props["snapshot"] = { ...snapshot("night"), publicEvents: [{ id: "synthetic-note", type: "system", messageBg: "synthetic private-looking result" }] };
    Object.defineProperties(next, { privateRole: { get: privateRead }, privateState: { get: privateRead }, terminalResult: { get: privateRead } });
    table.update({ snapshot: next });
    await flush(1000);
    table.update({ snapshot: { ...next, publicEvents: [] } });
    await flush(1000);
    expect(privateRead).not.toHaveBeenCalled();
    expect(fetchAudio).toHaveBeenCalledExactlyOnceWith("/audio/narration/v1/classic/werewolves-phase-night.mp3", expect.any(Object));
  });
});
