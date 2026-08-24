import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCueMode } from "@/hooks/play/use-cue-mode";
import { playCue, setSoundEnabled } from "@/lib/sound";
import { triggerDeviceCue } from "@/lib/play/device-cues";

vi.mock("@/lib/sound", () => ({
  playCue: vi.fn(),
  setSoundEnabled: vi.fn(),
}));

vi.mock("@/lib/play/device-cues", () => ({
  isCueMode: (value: unknown) => value === "silent" || value === "visual" || value === "audio_vibration",
  triggerDeviceCue: vi.fn(),
}));

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
    window.localStorage.clear();
    vi.mocked(playCue).mockClear();
    vi.mocked(setSoundEnabled).mockClear();
    vi.mocked(triggerDeviceCue).mockClear();
  });

  it("loads a saved cue mode", async () => {
    window.localStorage.setItem("werewolf-cue-mode", "audio_vibration");

    const { result } = renderHook(() => useCueMode({ tempoProfile: "normal", phase: "lobby", liveMode: false }));

    await waitFor(() => expect(result.current.cueMode).toBe("audio_vibration"));
  });

  it("forces silent mode for live tempo rooms", async () => {
    window.localStorage.setItem("werewolf-cue-mode", "audio_vibration");

    const { result } = renderHook(() => useCueMode({ tempoProfile: "live", phase: "lobby", liveMode: true }));

    await waitFor(() => expect(result.current.cueMode).toBe("silent"));
  });

  it("persists audio vibration and triggers the current phase cue", () => {
    const { result } = renderHook(() => useCueMode({ tempoProfile: "normal", phase: "night", liveMode: false }));

    act(() => result.current.changeCueMode("audio_vibration"));

    expect(window.localStorage.getItem("werewolf-cue-mode")).toBe("audio_vibration");
    expect(setSoundEnabled).toHaveBeenCalledWith(true);
    expect(triggerDeviceCue).toHaveBeenCalledWith("night", false);
    expect(playCue).toHaveBeenCalledWith("phase-change", { forceSilent: false });
  });

  it("turns sound off when switching to silent mode", () => {
    const { result } = renderHook(() => useCueMode({ tempoProfile: "normal", phase: "day_discussion", liveMode: false }));

    act(() => result.current.changeCueMode("silent"));

    expect(window.localStorage.getItem("werewolf-cue-mode")).toBe("silent");
    expect(setSoundEnabled).toHaveBeenCalledWith(false);
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
