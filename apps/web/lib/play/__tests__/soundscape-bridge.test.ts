import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const soundscape = vi.hoisted(() => ({ enterPhase: vi.fn(), stopAll: vi.fn(), stinger: vi.fn() }));
const sound = vi.hoisted(() => ({ enabled: false }));

vi.mock("@/lib/sound", () => ({
  SOUND_CHANGE_EVENT: "werewolf-sound-change",
  getSoundEnabled: () => sound.enabled,
}));

const scene = { mode: "werewolves_classic", phase: "night", narratorVoice: "classic" } as const;
const flush = () => vi.dynamicImportSettled();
const removeListeners: Array<() => void> = [];
let moduleFactory: () => typeof soundscape | Promise<typeof soundscape>;
const setEnabled = (enabled: boolean) => {
  sound.enabled = enabled;
  window.dispatchEvent(new Event("werewolf-sound-change"));
};

function deferImport() {
  let resolve!: (module: typeof soundscape) => void;
  let started!: () => void;
  const promise = new Promise<typeof soundscape>((done) => { resolve = done; });
  const importing = new Promise<void>((done) => { started = done; });
  moduleFactory = () => {
    started();
    return promise;
  };
  return { resolve: () => resolve(soundscape), importing };
}

async function loadBridge() {
  vi.resetModules();
  vi.doMock("@/lib/play/soundscape", moduleFactory);
  return import("../soundscape-bridge");
}

describe("soundscape bridge", () => {
  beforeEach(() => {
    sound.enabled = false;
    soundscape.enterPhase.mockClear();
    soundscape.stopAll.mockClear();
    soundscape.stinger.mockClear();
    moduleFactory = () => soundscape;
    const add = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation((type, listener, options) => {
      add(type, listener, options);
      removeListeners.push(() => window.removeEventListener(type, listener, options));
    });
  });
  afterEach(() => {
    removeListeners.splice(0).forEach((remove) => remove());
    vi.resetModules();
  });

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

  it.each(["before", "after"] as const)("restores only the current phase when re-enabled %s the muted import resolves", async (timing) => {
    const pending = deferImport();
    const bridge = await loadBridge();
    bridge.setSoundScene(scene);
    setEnabled(true);
    await pending.importing;
    setEnabled(false);
    const current = { ...scene, phase: "day_discussion" } as const;
    bridge.setSoundScene(current);
    if (timing === "before") setEnabled(true);
    pending.resolve();
    await flush();
    if (timing === "after") {
      expect(soundscape.enterPhase).not.toHaveBeenCalled();
      setEnabled(true);
      await flush();
    }
    expect(soundscape.enterPhase).toHaveBeenCalledExactlyOnceWith(current);
  });

  it("does not replay old phases or a death after leaving during import", async () => {
    const pending = deferImport();
    const bridge = await loadBridge();
    setEnabled(true);
    bridge.setSoundScene(scene);
    await pending.importing;
    bridge.playSoundStinger("death");
    bridge.setSoundScene({ ...scene, phase: "day_announcement" });
    bridge.setSoundScene(null);
    pending.resolve();
    await flush();
    expect(soundscape.enterPhase).not.toHaveBeenCalled();
    expect(soundscape.stinger).not.toHaveBeenCalled();
  });

  it("joins only the new room's phase when the old room leaves during import", async () => {
    const pending = deferImport();
    const bridge = await loadBridge();
    setEnabled(true);
    bridge.setSoundScene(scene);
    await pending.importing;
    bridge.setSoundScene(null);
    const current = { ...scene, phase: "voting" } as const;
    bridge.setSoundScene(current);
    pending.resolve();
    await flush();
    expect(soundscape.enterPhase).toHaveBeenCalledExactlyOnceWith(current);
    expect(soundscape.stinger).not.toHaveBeenCalled();
  });

  it("drops deaths during import instead of queueing a delayed stinger", async () => {
    const pending = deferImport();
    const bridge = await loadBridge();
    setEnabled(true);
    bridge.setSoundScene(scene);
    await pending.importing;
    bridge.playSoundStinger("death");
    pending.resolve();
    await flush();
    expect(soundscape.stinger).not.toHaveBeenCalled();
    bridge.playSoundStinger("death");
    expect(soundscape.stinger).toHaveBeenCalledExactlyOnceWith("death");
  });

  it("never forwards a death while muted or without an audible table", async () => {
    const bridge = await loadBridge();
    setEnabled(true);
    bridge.setSoundScene(scene);
    await flush();
    setEnabled(false);
    bridge.playSoundStinger("death");
    bridge.setSoundScene(null);
    setEnabled(true);
    bridge.playSoundStinger("death");
    await flush();
    expect(soundscape.stinger).not.toHaveBeenCalled();
  });

  it("silences pending narration and stingers during an explicit preview, then restores only the current scene", async () => {
    const bridge = await loadBridge();
    setEnabled(true);
    bridge.setSoundScene(scene);
    await flush();
    soundscape.enterPhase.mockClear();
    window.dispatchEvent(new CustomEvent("senkite-narration-preview-change", { detail: { active: true } }));
    expect(soundscape.stopAll).toHaveBeenCalled();
    bridge.setSoundScene({ ...scene, phase: "voting" });
    bridge.playSoundStinger("death");
    expect(soundscape.enterPhase).not.toHaveBeenCalled();
    expect(soundscape.stinger).not.toHaveBeenCalled();
    window.dispatchEvent(new CustomEvent("senkite-narration-preview-change", { detail: { active: false } }));
    expect(soundscape.enterPhase).toHaveBeenCalledExactlyOnceWith({ ...scene, phase: "voting" });
  });

  it("a preview started during a lazy import prevents captured speech from starting", async () => {
    const pending = deferImport();
    const bridge = await loadBridge();
    setEnabled(true);
    bridge.setSoundScene(scene);
    await pending.importing;
    window.dispatchEvent(new CustomEvent("senkite-narration-preview-change", { detail: { active: true } }));
    pending.resolve();
    await flush();
    expect(soundscape.enterPhase).not.toHaveBeenCalled();
    expect(soundscape.stopAll).toHaveBeenCalled();
  });
});
