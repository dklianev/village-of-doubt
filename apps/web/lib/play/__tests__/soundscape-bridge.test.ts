import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const soundscape = vi.hoisted(() => ({ enterPhase: vi.fn(), stopAll: vi.fn(), stinger: vi.fn() }));
const sound = vi.hoisted(() => ({ enabled: false }));

vi.mock("@/lib/play/soundscape", () => soundscape);
vi.mock("@/lib/sound", () => ({
  SOUND_CHANGE_EVENT: "werewolf-sound-change",
  getSoundEnabled: () => sound.enabled,
}));

const scene = { mode: "werewolves_classic", phase: "night", narratorVoice: "classic" } as const;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function loadBridge() {
  vi.resetModules();
  return import("../soundscape-bridge");
}

describe("soundscape bridge", () => {
  beforeEach(() => {
    sound.enabled = false;
    soundscape.enterPhase.mockClear();
    soundscape.stopAll.mockClear();
    soundscape.stinger.mockClear();
  });
  afterEach(() => vi.resetModules());

  it("does not load the synthesiser while sound is off", async () => {
    const bridge = await loadBridge();
    bridge.setSoundScene(scene);
    bridge.playSoundStinger("death");
    await flush();
    expect(soundscape.enterPhase).not.toHaveBeenCalled();
    expect(soundscape.stinger).not.toHaveBeenCalled();
  });

  it("enters the current phase once sound is on and silences the table on null", async () => {
    sound.enabled = true;
    const bridge = await loadBridge();
    bridge.setSoundScene(scene);
    await flush();
    expect(soundscape.enterPhase).toHaveBeenCalledWith(scene);

    bridge.playSoundStinger("death");
    bridge.setSoundScene(null);
    await flush();
    expect(soundscape.stinger).toHaveBeenCalledWith("death");
    expect(soundscape.stopAll).toHaveBeenCalledTimes(1);
  });

  it("starts the remembered phase when sound is switched on mid-phase", async () => {
    const bridge = await loadBridge();
    bridge.setSoundScene(scene);
    await flush();
    expect(soundscape.enterPhase).not.toHaveBeenCalled();

    sound.enabled = true;
    window.dispatchEvent(new Event("werewolf-sound-change"));
    await flush();
    expect(soundscape.enterPhase).toHaveBeenCalledWith(scene);
  });
});
