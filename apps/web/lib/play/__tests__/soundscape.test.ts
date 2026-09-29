import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sound = vi.hoisted(() => ({ enabled: true }));
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
    connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    gain: param(), frequency: param(), Q: param(), delayTime: param(),
    type: "", buffer: null as unknown, loop: false,
  };
}
const created = { contexts: 0 };
class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  destination = node();
  constructor() { created.contexts += 1; }
  createGain = vi.fn(node);
  createOscillator = vi.fn(node);
  createBiquadFilter = vi.fn(node);
  createDelay = vi.fn(node);
  createBufferSource = vi.fn(node);
  createBuffer = vi.fn((_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }));
  resume = vi.fn(() => Promise.resolve());
  suspend = vi.fn(() => Promise.resolve());
}

const speech = { speak: vi.fn(), cancel: vi.fn(), voices: [] as Array<{ lang: string; name: string }> };

async function loadSoundscape() {
  vi.resetModules();
  return import("../soundscape");
}

describe("table soundscape", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sound.enabled = true;
    created.contexts = 0;
    speech.speak.mockClear();
    speech.cancel.mockClear();
    speech.voices = [];
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("SpeechSynthesisUtterance", class { lang = ""; voice: unknown = null; rate = 1; pitch = 1; volume = 1; constructor(public text: string) {} });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak: speech.speak, cancel: speech.cancel, getVoices: () => speech.voices, addEventListener: vi.fn() },
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("stays silent and creates no audio while sound is off", async () => {
    sound.enabled = false;
    const soundscape = await loadSoundscape();
    soundscape.enterPhase({ mode: "werewolves_classic", phase: "night", narratorVoice: "classic" });
    expect(created.contexts).toBe(0);
  });

  it("restores the bed on join without narrating, then narrates a real transition in Bulgarian", async () => {
    speech.voices = [{ lang: "en-US", name: "English" }, { lang: "bg-BG", name: "Български" }];
    const soundscape = await loadSoundscape();
    soundscape.enterPhase({ mode: "werewolves_classic", phase: "day_discussion", narratorVoice: "classic" });
    vi.advanceTimersByTime(2000);
    expect(created.contexts).toBe(1);
    expect(speech.speak).not.toHaveBeenCalled();

    soundscape.enterPhase({ mode: "werewolves_classic", phase: "night", narratorVoice: "classic" });
    vi.advanceTimersByTime(1000);
    expect(speech.speak).toHaveBeenCalledTimes(1);
    const utterance = speech.speak.mock.calls[0]![0] as { text: string; lang: string };
    expect(utterance.lang).toBe("bg-BG");
    expect(utterance.text.length).toBeGreaterThan(0);
  });

  it("never reads Bulgarian lines with a foreign voice", async () => {
    speech.voices = [{ lang: "en-US", name: "English" }];
    const soundscape = await loadSoundscape();
    soundscape.enterPhase({ mode: "mafia_free", phase: "day_discussion", narratorVoice: "classic" });
    soundscape.enterPhase({ mode: "mafia_free", phase: "night", narratorVoice: "classic" });
    vi.advanceTimersByTime(1500);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it("cancels narration when the table is silenced", async () => {
    const soundscape = await loadSoundscape();
    soundscape.enterPhase({ mode: "werewolves_classic", phase: "voting", narratorVoice: "classic" });
    soundscape.stopAll();
    expect(speech.cancel).toHaveBeenCalled();
  });
});
