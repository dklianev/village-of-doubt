import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCueMode } from "@/hooks/play/use-cue-mode";
import { getSoundEnabled, playCue, setSoundEnabled } from "@/lib/sound";
import { triggerDeviceCue } from "@/lib/play/device-cues";

vi.mock("@/lib/sound", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/sound")>(),
  playCue: vi.fn(),
}));

vi.mock("@/lib/play/device-cues", () => ({
  isCueMode: (value: unknown) => value === "silent" || value === "visual" || value === "audio_vibration",
  triggerDeviceCue: vi.fn(),
}));

const SAVED_MODE = "werewolf-cue-mode";

describe("useCueMode", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    vi.mocked(playCue).mockClear();
    vi.mocked(triggerDeviceCue).mockClear();
  });

  it("keeps a header mute when the room loads a saved sound mode", async () => {
    window.localStorage.setItem(SAVED_MODE, "audio_vibration");
    setSoundEnabled(false);

    const { result } = renderHook(() => useCueMode({ tempoProfile: "normal", phase: "lobby", liveMode: false }));

    await waitFor(() => expect(result.current.cueMode).toBe("visual"));
    expect(getSoundEnabled()).toBe(false);
  });

  it("keeps header sound on when the room's saved mode is quiet", async () => {
    setSoundEnabled(true);

    const { result } = renderHook(() => useCueMode({ tempoProfile: "normal", phase: "lobby", liveMode: false }));

    await waitFor(() => expect(result.current.cueMode).toBe("audio_vibration"));
    expect(getSoundEnabled()).toBe(true);
    expect(playCue).not.toHaveBeenCalled();
    expect(triggerDeviceCue).not.toHaveBeenCalled();
  });

  it("follows the header sound toggle while the room is open", async () => {
    window.localStorage.setItem(SAVED_MODE, "silent");
    const { result } = renderHook(() => useCueMode({ tempoProfile: "normal", phase: "night", liveMode: false }));
    await waitFor(() => expect(result.current.cueMode).toBe("silent"));

    act(() => setSoundEnabled(true));
    expect(result.current.cueMode).toBe("audio_vibration");

    act(() => setSoundEnabled(false));
    expect(result.current.cueMode).toBe("silent");
  });

  it.each([
    ["visual", "visual"],
    ["silent", "silent"],
    ["invalid", "visual"],
    [null, "visual"],
  ])("shows the saved quiet mode %s while sound is off", async (saved, shown) => {
    if (saved !== null) window.localStorage.setItem(SAVED_MODE, saved);

    const { result } = renderHook(() => useCueMode({ tempoProfile: "normal", phase: "night", liveMode: false }));

    await waitFor(() => expect(result.current.cueMode).toBe(shown));
    expect(getSoundEnabled()).toBe(false);
    expect(playCue).not.toHaveBeenCalled();
  });

  it("silences live rooms without overwriting the device sound preference", async () => {
    window.localStorage.setItem(SAVED_MODE, "audio_vibration");
    setSoundEnabled(true);
    const { result, rerender } = renderHook(
      ({ tempoProfile, liveMode }) => useCueMode({ tempoProfile, phase: "night", liveMode }),
      { initialProps: { tempoProfile: "live", liveMode: true } },
    );

    expect(result.current.cueMode).toBe("silent");
    act(() => result.current.changeCueMode("audio_vibration"));
    expect(result.current.cueMode).toBe("silent");
    expect(getSoundEnabled()).toBe(true);
    expect(window.localStorage.getItem(SAVED_MODE)).toBe("audio_vibration");
    expect(playCue).not.toHaveBeenCalled();
    expect(triggerDeviceCue).not.toHaveBeenCalled();

    rerender({ tempoProfile: "normal", liveMode: false });
    await waitFor(() => expect(result.current.cueMode).toBe("audio_vibration"));
  });

  it("turns device sound on with audio vibration and plays the current phase cue", () => {
    const { result } = renderHook(() => useCueMode({ tempoProfile: "normal", phase: "night", liveMode: false }));

    act(() => result.current.changeCueMode("audio_vibration"));

    expect(result.current.cueMode).toBe("audio_vibration");
    expect(window.localStorage.getItem(SAVED_MODE)).toBe("audio_vibration");
    expect(getSoundEnabled()).toBe(true);
    expect(triggerDeviceCue).toHaveBeenCalledWith("night", false);
    expect(playCue).toHaveBeenCalledWith("phase-change", { forceSilent: false });
  });

  it.each(["visual", "silent"] as const)("turns device sound off when switching to %s", (mode) => {
    setSoundEnabled(true);
    const { result } = renderHook(() => useCueMode({ tempoProfile: "normal", phase: "day_discussion", liveMode: false }));

    act(() => result.current.changeCueMode(mode));

    expect(result.current.cueMode).toBe(mode);
    expect(window.localStorage.getItem(SAVED_MODE)).toBe(mode);
    expect(getSoundEnabled()).toBe(false);
    expect(playCue).not.toHaveBeenCalled();
    expect(triggerDeviceCue).not.toHaveBeenCalled();
  });

  it("keeps working when browser storage is blocked", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });

    const { result } = renderHook(() => useCueMode({ tempoProfile: "normal", phase: "night", liveMode: false }));
    await waitFor(() => expect(result.current.cueMode).toBe("visual"));
    expect(() => act(() => result.current.changeCueMode("silent"))).not.toThrow();
  });
});
