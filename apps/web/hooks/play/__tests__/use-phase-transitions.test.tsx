import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import type { Room } from "@colyseus/sdk";
import type { GamePhase } from "@werewolf/shared";
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
      ({ phase }) => useTestPhaseTransitions({ phase, cueMode: "audio_vibration" }),
      { initialProps: { phase: "lobby" as "lobby" | "night" } },
    );

    expect(result.current.showPhaseTransition).toBe(false);

    rerender({ phase: "night" });

    expect(result.current.showPhaseTransition).toBe(true);
    expect(result.current.phasePulse).toBe(1);
    expect(playCue).toHaveBeenCalledWith("phase-change", { forceSilent: false });
    expect(triggerDeviceCue).toHaveBeenCalledWith("night", false);
  });

  it.each([
    { cueMode: "visual" as const, liveMode: false },
    { cueMode: "silent" as const, liveMode: false },
    { cueMode: "audio_vibration" as const, liveMode: true },
  ])("mutes phase, death and win cues in $cueMode mode (live: $liveMode)", ({ cueMode, liveMode }) => {
    const { result, rerender } = renderHook(
      ({ phase, publicEvents, winnerTeam }) => useTestPhaseTransitions({ phase, publicEvents, winnerTeam, cueMode, liveMode }),
      { initialProps: { phase: "lobby" as "lobby" | "night", publicEvents: [] as Array<{ id: string; type: "death"; messageBg: string }>, winnerTeam: "" } },
    );

    rerender({ phase: "night", publicEvents: [{ id: "death-1", type: "death", messageBg: "Eliminated" }], winnerTeam: "village" });

    expect(result.current.showPhaseTransition).toBe(true);
    expect(result.current.phasePulse).toBe(1);
    expect(playCue).toHaveBeenCalledWith("phase-change", { forceSilent: true });
    expect(playCue).toHaveBeenCalledWith("kill", { forceSilent: true });
    expect(playCue).toHaveBeenCalledWith("win", { forceSilent: true });
    expect(triggerDeviceCue).not.toHaveBeenCalled();
  });

  it("does not replay old phase, death or win cues when audio is enabled", () => {
    const { rerender } = renderHook(
      ({ cueMode, phase, publicEvents, winnerTeam }) => useTestPhaseTransitions({ cueMode, phase, publicEvents, winnerTeam }),
      { initialProps: { cueMode: "visual" as "visual" | "audio_vibration", phase: "lobby" as "lobby" | "night", publicEvents: [] as Array<{ id: string; type: "death"; messageBg: string }>, winnerTeam: "" } },
    );
    const ended = { phase: "night" as const, publicEvents: [{ id: "death-1", type: "death" as const, messageBg: "Eliminated" }], winnerTeam: "village" };
    rerender({ ...ended, cueMode: "visual" });
    vi.mocked(playCue).mockClear();

    rerender({ ...ended, cueMode: "audio_vibration" });

    expect(playCue).not.toHaveBeenCalled();
    expect(triggerDeviceCue).not.toHaveBeenCalled();
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

  it.each(["replacement", "disconnect", "phase change"])("cancels the old countdown on room %s and permits a fresh start", async (change) => {
    vi.useFakeTimers();
    const oldRoom = { send: vi.fn() } as unknown as Room;
    const newRoom = { send: vi.fn() } as unknown as Room;
    const { result, rerender } = renderHook(
      ({ room, phase }) => useTestPhaseTransitions({ room, phase }),
      { initialProps: { room: oldRoom as Room | null, phase: "lobby" as GamePhase } },
    );
    act(() => result.current.requestStartGame());
    await act(async () => vi.advanceTimersByTimeAsync(620));
    expect(result.current.startCountdown).toBe(2);

    rerender({
      room: change === "replacement" ? newRoom : change === "disconnect" ? null : oldRoom,
      phase: change === "phase change" ? "role_reveal" : "lobby",
    });
    await act(async () => vi.advanceTimersByTimeAsync(2000));

    expect(oldRoom.send).not.toHaveBeenCalled();
    expect(newRoom.send).not.toHaveBeenCalled();
    expect(result.current.startCountdown).toBeNull();

    rerender({ room: newRoom, phase: "lobby" });
    act(() => result.current.requestStartGame());
    await act(async () => vi.advanceTimersByTimeAsync(1860));
    expect(newRoom.send).toHaveBeenCalledExactlyOnceWith("startGame");
    expect(oldRoom.send).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("does not schedule a start after the room has left the lobby", async () => {
    vi.useFakeTimers();
    const room = { send: vi.fn() } as unknown as Room;
    const { result } = renderHook(() => useTestPhaseTransitions({ room, phase: "night" }));

    act(() => result.current.requestStartGame());
    await act(async () => vi.advanceTimersByTimeAsync(2000));

    expect(room.send).not.toHaveBeenCalled();
    expect(result.current.startCountdown).toBeNull();
    vi.useRealTimers();
  });

  it("cancels a pending start on unmount", async () => {
    vi.useFakeTimers();
    const room = { send: vi.fn() } as unknown as Room;
    const { result, unmount } = renderHook(() => useTestPhaseTransitions({ room }));
    act(() => result.current.requestStartGame());

    unmount();
    await act(async () => vi.advanceTimersByTimeAsync(2000));

    expect(room.send).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("plays the kill cue only for typed death events", () => {
    const { rerender } = renderHook(
      ({ publicEvents }) => useTestPhaseTransitions({ publicEvents, cueMode: "audio_vibration" }),
      { initialProps: { publicEvents: [] as Array<{ id: string; type: "death" | "system"; messageBg: string }> } },
    );

    rerender({
      publicEvents: [{ id: "event-1", type: "system", messageBg: "Проверка без жертви." }],
    });
    expect(playCue).not.toHaveBeenCalledWith("kill", expect.anything());

    rerender({
      publicEvents: [
        { id: "event-1", type: "system", messageBg: "Проверка без жертви." },
        { id: "event-2", type: "death", messageBg: "Играчът напусна сцената." },
      ],
    });
    expect(playCue).toHaveBeenCalledWith("kill", { forceSilent: false });
  });
});
