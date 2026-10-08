import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SoundScene } from "../soundscape";
import type { createNarrationPlayer } from "../narration-player";

const sound = vi.hoisted(() => ({ enabled: true }));
const recorded = vi.hoisted(() => ({
  create: vi.fn<(options: Parameters<typeof createNarrationPlayer>[0]) => void>(),
  play: vi.fn(), stop: vi.fn(), load: vi.fn(),
}));
vi.mock("../narration-player", () => ({ createNarrationPlayer: (options: Parameters<typeof createNarrationPlayer>[0]) => {
  recorded.create(options);
  return { play: recorded.play, stop: recorded.stop };
} }));
vi.mock("../narration-assets", () => ({ loadNarrationClip: recorded.load }));
vi.mock("@/lib/sound", () => ({
  SOUND_CHANGE_EVENT: "werewolf-sound-change",
  getSoundEnabled: () => sound.enabled,
}));

function param() {
  return {
    value: 0,
    setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}
function node() {
  return {
    connect: vi.fn(), disconnect: vi.fn(), start: vi.fn<(when?: number, offset?: number) => void>(), stop: vi.fn<(when?: number) => void>(),
    gain: param(), frequency: param(), Q: param(), delayTime: param(),
    type: "", buffer: null as unknown, loop: false,
    onended: null as (() => void) | null,
  };
}
const created = { contexts: 0, last: null as FakeAudioContext | null };
class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  state: AudioContextState | "interrupted" = "running";
  destination = node();
  sources: ReturnType<typeof node>[] = [];
  constructor() {
    created.contexts += 1;
    created.last = this;
  }
  createGain = vi.fn(node);
  createSource = () => {
    const source = node();
    this.sources.push(source);
    return source;
  };
  createOscillator = vi.fn(this.createSource);
  createBiquadFilter = vi.fn(node);
  createDelay = vi.fn(node);
  createBufferSource = vi.fn(this.createSource);
  createBuffer = vi.fn((_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }));
  resume = vi.fn(() => Promise.resolve());
  suspend = vi.fn(() => Promise.resolve());
}

const speech = { speak: vi.fn(), cancel: vi.fn(), voices: [] as Array<{ lang: string; name: string }> };
let synth: EventTarget;
const removeListeners: Array<() => void> = [];
const scene = (phase: SoundScene["phase"], mode: SoundScene["mode"] = "mafia_free"): SoundScene => ({
  mode, phase, narratorVoice: "classic",
  narration: { gameId: "room-a", round: 2, votingCycle: 1, participantIds: ["a", "b"] },
});
const sources = (audio: FakeAudioContext) => audio.sources;
const setEnabled = (enabled: boolean) => {
  sound.enabled = enabled;
  window.dispatchEvent(new Event("werewolf-sound-change"));
};
const setHidden = (hidden: boolean) => {
  vi.spyOn(document, "hidden", "get").mockReturnValue(hidden);
  document.dispatchEvent(new Event("visibilitychange"));
};

async function loadSoundscape() {
  vi.resetModules();
  return import("../soundscape");
}

describe("table soundscape", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sound.enabled = true;
    created.contexts = 0;
    created.last = null;
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    for (const target of [window, document] as EventTarget[]) {
      const add = target.addEventListener.bind(target);
      vi.spyOn(target, "addEventListener").mockImplementation((type, listener, options) => {
        add(type, listener, options);
        removeListeners.push(() => target.removeEventListener(type, listener, options));
      });
    }
    speech.speak.mockClear();
    speech.cancel.mockClear();
    speech.voices = [];
    recorded.create.mockReset();
    recorded.play.mockReset().mockResolvedValue("started");
    recorded.stop.mockReset();
    recorded.load.mockReset().mockImplementation(async (voice: string, cue: string) => ({
      src: `/audio/narration/v1/${voice.replaceAll("_", "-")}/${cue.replaceAll(".", "-")}.mp3`, durationMs: 4000, sha256: "a".repeat(64),
    }));
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("SpeechSynthesisUtterance", class { lang = ""; voice: unknown = null; rate = 1; pitch = 1; volume = 1; constructor(public text: string) {} });
    synth = Object.assign(new EventTarget(), { speak: speech.speak, cancel: speech.cancel, getVoices: () => speech.voices });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: synth,
    });
  });
  afterEach(() => {
    removeListeners.splice(0).forEach((remove) => remove());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("stays silent and creates no audio while sound is off", async () => {
    sound.enabled = false;
    const soundscape = await loadSoundscape();
    soundscape.enterPhase({ mode: "werewolves_classic", phase: "night", narratorVoice: "classic" });
    expect(created.contexts).toBe(0);
  });

  it("restores the bed on join without fetching speech, then plays a recorded public transition", async () => {
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("day_discussion", "werewolves_classic"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(created.contexts).toBe(1);
    expect(recorded.load).not.toHaveBeenCalled();

    soundscape.enterPhase(scene("night", "werewolves_classic"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(recorded.load).toHaveBeenCalledWith("classic", "werewolves.phase.night", expect.any(AbortSignal));
    expect(recorded.play).toHaveBeenCalledTimes(1);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it("matches preview voice gain at the destination while keeping ambience on its ducked master", async () => {
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("day_discussion"));
    const audio = created.last!;
    const nextBedGainIndex = audio.createGain.mock.results.length;
    soundscape.enterPhase(scene("night"));
    await vi.advanceTimersByTimeAsync(1000);

    const options = recorded.create.mock.calls[0]![0];
    const master = audio.createGain.mock.results[0]!.value;
    const bed = audio.createGain.mock.results[nextBedGainIndex]!.value;
    expect(options.context).toBe(audio);
    expect(options.destination).toBe(audio.destination);
    expect(recorded.play).toHaveBeenCalledWith(expect.any(Object), expect.any(String), 0.85, expect.any(Function));
    expect(master.gain.value).toBe(0.55);
    expect(master.connect).toHaveBeenCalledWith(audio.destination);
    expect(bed.connect).toHaveBeenCalledWith(master);
    expect(options.canPlay()).toBe(true);

    options.onSpeakingChange!(true);
    expect(bed.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.35, audio.currentTime + 0.12);
    options.onSpeakingChange!(false);
    expect(bed.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(1, audio.currentTime + 0.4);
    expect(master.gain.value).toBe(0.55);

    setEnabled(false);
    expect(options.canPlay()).toBe(false);
    expect(recorded.stop).toHaveBeenCalled();
  });

  it("never reads Bulgarian lines with a foreign voice", async () => {
    speech.voices = [{ lang: "en-US", name: "English" }];
    const soundscape = await loadSoundscape();
    soundscape.enterPhase({ mode: "mafia_free", phase: "day_discussion", narratorVoice: "classic" });
    soundscape.enterPhase({ mode: "mafia_free", phase: "night", narratorVoice: "classic" });
    vi.advanceTimersByTime(1500);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it("schedules no ambience while audio is suspended, so nothing bursts out on resume", async () => {
    const soundscape = await loadSoundscape();
    soundscape.enterPhase({ mode: "werewolves_classic", phase: "night", narratorVoice: "classic" });
    const audio = created.last!;
    audio.state = "suspended";
    const beforeHidden = audio.createOscillator.mock.calls.length;
    vi.advanceTimersByTime(8000);
    expect(audio.createOscillator.mock.calls.length).toBe(beforeHidden);

    audio.state = "running";
    vi.advanceTimersByTime(2000);
    expect(audio.createOscillator.mock.calls.length).toBeGreaterThan(beforeHidden);
  });

  it("cancels narration when the table is silenced", async () => {
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("day_discussion"));
    soundscape.enterPhase(scene("voting"));
    await vi.advanceTimersByTimeAsync(1000);
    soundscape.stopAll();
    expect(recorded.stop).toHaveBeenCalled();
  });

  it.each(["mute", "stopAll"] as const)("cancels scheduled bells, death sounds and ambient transients on %s", async (action) => {
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("lobby"));
    soundscape.enterPhase(scene("night"));
    soundscape.stinger("death");
    vi.advanceTimersByTime(500);
    const audio = created.last!;
    const transients = sources(audio).filter((source) => source.stop.mock.calls.length > 0);
    expect(transients.length).toBeGreaterThan(7);
    expect(transients.some((source) => source.start.mock.calls.some(([at]) => (at ?? 0) > audio.currentTime))).toBe(true);

    if (action === "mute") setEnabled(false);
    else soundscape.stopAll();

    for (const source of transients) {
      expect(source.stop).toHaveBeenLastCalledWith();
      expect(source.disconnect).toHaveBeenCalled();
    }
    const count = sources(audio).length;
    vi.advanceTimersByTime(5000);
    expect(sources(audio)).toHaveLength(count);
  });

  it("cancels both the night voices and their vibrato sources", async () => {
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("day_discussion", "werewolves_classic"));
    soundscape.enterPhase(scene("night", "werewolves_classic"));
    const transients = sources(created.last!).filter((source) => source.stop.mock.calls.length > 0);
    expect(transients).toHaveLength(4);
    soundscape.stopAll();
    for (const source of transients) expect(source.stop).toHaveBeenLastCalledWith();
  });

  it("releases ended transient sources instead of retaining them until leave", async () => {
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("lobby"));
    soundscape.stinger("death");
    const transients = sources(created.last!);
    for (const source of transients) {
      expect(source.onended).toBeTypeOf("function");
      source.onended!();
      expect(source.disconnect).toHaveBeenCalledTimes(1);
    }
    soundscape.stopAll();
    for (const source of transients) expect(source.stop).toHaveBeenCalledTimes(1);
  });

  it("does not resume, schedule sounds or narrate hidden phases and restores the latest bed quietly", async () => {
    speech.voices = [{ lang: "bg-BG", name: "Bulgarian" }];
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("night"));
    const audio = created.last!;
    setHidden(true);
    expect(audio.suspend).toHaveBeenCalledTimes(1);
    const resumes = audio.resume.mock.calls.length;
    const count = sources(audio).length;
    soundscape.enterPhase(scene("day_announcement"));
    soundscape.stinger("death");
    window.dispatchEvent(new Event("pointerdown"));
    window.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(1200);
    expect(audio.resume).toHaveBeenCalledTimes(resumes);
    expect(sources(audio)).toHaveLength(count);
    expect(speech.speak).not.toHaveBeenCalled();

    setHidden(false);
    expect(sources(audio).length).toBeGreaterThan(count);
    expect(sources(audio).slice(count).every((source) => source.stop.mock.calls.length === 0)).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it("waits for visibility before creating audio when joining a hidden table", async () => {
    setHidden(true);
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("night"));
    soundscape.enterPhase(scene("day_announcement"));
    expect(created.contexts).toBe(0);
    setHidden(false);
    expect(created.contexts).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it("queues resume behind a pending suspension when visibility returns before state updates", async () => {
    speech.voices = [{ lang: "bg-BG", name: "Bulgarian" }];
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("night"));
    const audio = created.last!;
    let finishSuspend!: () => void;
    const suspension = new Promise<void>((resolve) => {
      finishSuspend = () => {
        audio.state = "suspended";
        resolve();
      };
    });
    audio.suspend.mockImplementation(() => suspension);
    audio.resume.mockClear();
    audio.resume.mockImplementation(() => suspension.then(() => { audio.state = "running"; }));

    setHidden(true);
    expect(audio.state).toBe("running");
    soundscape.enterPhase(scene("day_announcement"));
    expect(audio.resume).not.toHaveBeenCalled();
    setHidden(false);
    expect(audio.resume).toHaveBeenCalledTimes(1);
    expect(sources(audio).every((source) => source.stop.mock.calls.length === 0)).toBe(true);

    finishSuspend();
    await suspension;
    expect(audio.state).toBe("running");
    vi.advanceTimersByTime(1000);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it.each(["pointerdown", "keydown", "phase", "visibility", "sound"] as const)("recovers an interrupted context through %s without replaying transients", async (trigger) => {
    speech.voices = [{ lang: "bg-BG", name: "Bulgarian" }];
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("day_discussion"));
    const audio = created.last!;
    audio.state = "interrupted";
    audio.resume.mockClear();
    audio.resume.mockImplementation(() => Promise.resolve().then(() => { audio.state = "running"; }));

    if (trigger === "phase") soundscape.enterPhase(scene("day_announcement"));
    else if (trigger === "visibility") {
      setHidden(true);
      setHidden(false);
    } else if (trigger === "sound") {
      setEnabled(false);
      setEnabled(true);
    } else window.dispatchEvent(new Event(trigger));

    expect(audio.resume).toHaveBeenCalledTimes(1);
    expect(audio.state).toBe("interrupted");
    const count = sources(audio).length;
    soundscape.stinger("death");
    expect(sources(audio)).toHaveLength(count);
    expect(sources(audio).every((source) => source.stop.mock.calls.length === 0)).toBe(true);
    await audio.resume.mock.results[0]!.value;
    expect(audio.state).toBe("running");
    vi.advanceTimersByTime(1000);
    expect(speech.speak).not.toHaveBeenCalled();
    const resumedCount = sources(audio).length;
    soundscape.stinger("death");
    expect(sources(audio)).toHaveLength(resumedCount + 3);
  });

  it.each(["hidden", "muted", "left", "closed"] as const)("does not retry context recovery while %s", async (condition) => {
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("day_discussion"));
    const audio = created.last!;
    audio.state = "interrupted";
    if (condition === "hidden") setHidden(true);
    else if (condition === "muted") setEnabled(false);
    else if (condition === "left") soundscape.stopAll();
    else audio.state = "closed";
    audio.resume.mockClear();

    window.dispatchEvent(new Event("pointerdown"));
    window.dispatchEvent(new Event("keydown"));
    if (condition !== "left") soundscape.enterPhase(scene("day_announcement"));
    if (condition !== "hidden") setHidden(false);
    expect(audio.resume).not.toHaveBeenCalled();
    soundscape.stinger("death");
    vi.advanceTimersByTime(1000);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it.each(["suspended", "blocked", "interrupted"] as const)("drops phase and death stingers while audio is %s", async (state) => {
    speech.voices = [{ lang: "bg-BG", name: "Bulgarian" }];
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("day_discussion"));
    const audio = created.last!;
    audio.state = state === "interrupted" ? "interrupted" : "suspended";
    if (state === "blocked") audio.resume.mockRejectedValue(new Error("Autoplay blocked"));
    const count = sources(audio).length;
    soundscape.enterPhase(scene("day_announcement"));
    soundscape.stinger("death");
    vi.advanceTimersByTime(1000);
    expect(sources(audio)).toHaveLength(count);
    expect(speech.speak).not.toHaveBeenCalled();

    audio.state = "running";
    soundscape.enterPhase(scene("day_announcement"));
    expect(sources(audio)).toHaveLength(count);
    vi.advanceTimersByTime(1000);
    expect(speech.speak).not.toHaveBeenCalled();
    soundscape.stinger("death");
    expect(sources(audio).length).toBeGreaterThan(count);
  });

  it.each(["mute", "leave", "hidden", "phase"] as const)("aborts a pending recording on %s so an old line cannot reach the next scene", async (action) => {
    let resolve!: (value: unknown) => void;
    recorded.load.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("day_discussion"));
    soundscape.enterPhase(scene("night"));
    await vi.advanceTimersByTimeAsync(1000);
    const signal = recorded.load.mock.calls[0]![2] as AbortSignal;
    if (action === "mute") {
      setEnabled(false);
      setEnabled(true);
    } else if (action === "leave") {
      soundscape.stopAll();
      soundscape.enterPhase(scene("day_discussion"));
    } else if (action === "hidden") {
      setHidden(true);
      setHidden(false);
    } else {
      soundscape.enterPhase(scene("day_announcement"));
    }
    expect(signal.aborted).toBe(true);
    resolve({ src: "/audio/narration/v1/classic/mafia-phase-night.mp3" });
    await vi.advanceTimersByTimeAsync(0);
    expect(recorded.play).not.toHaveBeenCalled();
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it("keeps a pending current recording through duplicate state updates", async () => {
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("day_discussion"));
    soundscape.enterPhase(scene("night"));
    soundscape.enterPhase(scene("night"));
    await vi.advanceTimersByTimeAsync(1000);
    soundscape.enterPhase(scene("night"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(recorded.play).toHaveBeenCalledTimes(1);
    expect(recorded.stop).not.toHaveBeenCalled();
  });

  it.each(["mute", "leave", "hidden"] as const)("cancels the narrator delay on %s even when the same scene is restored", async (action) => {
    speech.voices = [{ lang: "bg-BG", name: "Bulgarian" }];
    const soundscape = await loadSoundscape();
    const night = scene("night");
    soundscape.enterPhase(scene("day_discussion"));
    soundscape.enterPhase(night);
    if (action === "mute") {
      setEnabled(false);
      setEnabled(true);
    } else if (action === "leave") {
      soundscape.stopAll();
      soundscape.enterPhase(night);
    } else {
      setHidden(true);
      setHidden(false);
    }
    await vi.advanceTimersByTimeAsync(1000);
    expect(recorded.play).not.toHaveBeenCalled();
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it("does not substitute a greeting or browser speech when the final recording is absent", async () => {
    recorded.load.mockResolvedValue(null);
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("day_discussion"));
    soundscape.enterPhase(scene("night"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(recorded.load).toHaveBeenCalledTimes(1);
    expect(recorded.play).not.toHaveBeenCalled();
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it("baselines a new room and resumes quietly after reconnect", async () => {
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("night"));
    const other = { ...scene("voting"), narration: { ...scene("voting").narration!, gameId: "room-b" } };
    soundscape.enterPhase(other);
    await vi.advanceTimersByTimeAsync(1000);
    expect(recorded.play).not.toHaveBeenCalled();
    soundscape.stopAll();
    soundscape.enterPhase(other);
    await vi.advanceTimersByTimeAsync(1000);
    expect(recorded.play).not.toHaveBeenCalled();
  });

  it("plays the Jester addition only after a verified main finale ends", async () => {
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("resolution"));
    const end = scene("game_over");
    end.narration = { ...end.narration!, winnerTeam: "mafia", terminalResultGameId: "room-a", terminalResultRound: 2, terminalResult: {
      winnerTeam: "mafia", winnerPlayerIds: ["a"], personalWinnerPlayerIds: ["b"],
      finalRoles: [{ userId: "a", role: "mafioso" }, { userId: "b", role: "jester" }],
    } };
    soundscape.enterPhase(end);
    await vi.advanceTimersByTimeAsync(1000);
    expect(recorded.load).toHaveBeenCalledExactlyOnceWith("classic", "mafia.finale.mafia", expect.any(AbortSignal));
    const ended = recorded.play.mock.calls[0]![3] as () => void;
    ended();
    await vi.advanceTimersByTimeAsync(0);
    expect(recorded.load).toHaveBeenLastCalledWith("classic", "shared.personal.finale.jester", expect.any(AbortSignal));
    expect(recorded.play).toHaveBeenCalledTimes(2);
    soundscape.enterPhase(end);
    await vi.advanceTimersByTimeAsync(1000);
    expect(recorded.play).toHaveBeenCalledTimes(2);
  });

  it("cancels an old finale continuation when a new room takes over", async () => {
    const soundscape = await loadSoundscape();
    soundscape.enterPhase(scene("resolution"));
    const end = scene("game_over");
    end.narration = { ...end.narration!, winnerTeam: "mafia", terminalResultGameId: "room-a", terminalResultRound: 2, terminalResult: {
      winnerTeam: "mafia", winnerPlayerIds: ["a"], personalWinnerPlayerIds: ["b"],
      finalRoles: [{ userId: "a", role: "mafioso" }, { userId: "b", role: "jester" }],
    } };
    soundscape.enterPhase(end);
    await vi.advanceTimersByTimeAsync(1000);
    const ended = recorded.play.mock.calls[0]![3] as () => void;
    soundscape.stopAll();
    soundscape.enterPhase(scene("lobby"));
    ended();
    await vi.advanceTimersByTimeAsync(0);
    expect(recorded.load).toHaveBeenCalledTimes(1);
  });
});
