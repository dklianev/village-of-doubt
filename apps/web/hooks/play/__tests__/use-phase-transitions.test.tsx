import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { usePhaseTransitions } from "@/hooks/play/use-phase-transitions";
import { playCue } from "@/lib/sound";
import { triggerDeviceCue } from "@/lib/play/device-cues";

vi.mock("@/lib/sound", () => ({
  playCue: vi.fn(),
}));

vi.mock("@/lib/play/device-cues", () => ({
  triggerDeviceCue: vi.fn(),
}));

function useTestPhaseTransitions(
  props: Partial<Parameters<typeof usePhaseTransitions>[0]> = {},
) {
  const suppressNextPhasePulseRef = useRef(false);
  return usePhaseTransitions({
    room: null,
    phase: "lobby",
    publicEvents: [],
    winnerTeam: "",
    liveMode: false,
    cueMode: "visual",
    suppressNextPhasePulseRef,
    ...props,
  });
}

describe("usePhaseTransitions", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(playCue).mockClear();
    vi.mocked(triggerDeviceCue).mockClear();
  });

  it("pulses and plays a phase cue when the phase changes", () => {
    const { result, rerender } = renderHook(
      ({ phase }) => useTestPhaseTransitions({ phase }),
      { initialProps: { phase: "lobby" as "lobby" | "night" } },
    );

    expect(result.current.showPhaseTransition).toBe(false);

    rerender({ phase: "night" });

    expect(result.current.showPhaseTransition).toBe(true);
    expect(result.current.phasePulse).toBe(1);
    expect(playCue).toHaveBeenCalledWith("phase-change", { forceSilent: false });
  });

  it("suppresses the first phase pulse after reconnect", () => {
    function useSuppressedPhase(phase: "lobby" | "night") {
      const suppressNextPhasePulseRef = useRef(true);
      return usePhaseTransitions({
        room: null,
        phase,
        publicEvents: [],
        winnerTeam: "",
        liveMode: false,
        cueMode: "visual",
        suppressNextPhasePulseRef,
      });
    }

    const { result, rerender } = renderHook(
      ({ phase }) => useSuppressedPhase(phase),
      { initialProps: { phase: "lobby" as "lobby" | "night" } },
    );

    rerender({ phase: "night" });

    expect(result.current.showPhaseTransition).toBe(false);
    expect(result.current.phasePulse).toBe(0);
    expect(playCue).not.toHaveBeenCalledWith("phase-change", expect.anything());
  });

  it("runs the start-game countdown before sending startGame", async () => {
    vi.useFakeTimers();
    const room = { send: vi.fn() };
    const { result } = renderHook(() => useTestPhaseTransitions({ room: room as never }));

    act(() => result.current.requestStartGame());

    expect(result.current.startCountdown).toBe(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(620);
    });
    expect(result.current.startCountdown).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1240);
    });
    expect(room.send).toHaveBeenCalledWith("startGame");
    expect(result.current.startCountdown).toBeNull();
    vi.useRealTimers();
  });
});
