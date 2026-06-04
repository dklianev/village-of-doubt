import { describe, expect, it, vi } from "vitest";
import { PhaseStateMachine, type ClockLike } from "../phase-state-machine.js";

function createClock() {
  const clear = vi.fn();
  const setTimeout = vi.fn((_callback: () => void, _delayMs: number) => ({ clear }));
  return { clock: { setTimeout } satisfies ClockLike, clear };
}

describe("PhaseStateMachine", () => {
  it("schedules timed playable phases", () => {
    const { clock } = createClock();
    const machine = new PhaseStateMachine({ clock, onTimerElapsed: vi.fn() });

    machine.setPhase("day_discussion", 30_000);

    expect(clock.setTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);
  });

  it("does not schedule paused or game-over phases", () => {
    const { clock } = createClock();
    const machine = new PhaseStateMachine({ clock, onTimerElapsed: vi.fn() });

    machine.setPhase("paused", 30_000);
    machine.setPhase("game_over", 30_000);

    expect(clock.setTimeout).not.toHaveBeenCalled();
  });

  it("stores and consumes a paused snapshot", () => {
    const { clock, clear } = createClock();
    const machine = new PhaseStateMachine({ clock, onTimerElapsed: vi.fn() });

    machine.setPhase("voting", 45_000);
    machine.pause({ phase: "voting", remainingMs: 12_000 });

    expect(clear).toHaveBeenCalledOnce();
    expect(machine.getPausedSnapshot()).toEqual({ phase: "voting", remainingMs: 12_000 });
    expect(machine.resume()).toEqual({ phase: "voting", remainingMs: 12_000 });
    expect(machine.getPausedSnapshot()).toBeUndefined();
  });
});
