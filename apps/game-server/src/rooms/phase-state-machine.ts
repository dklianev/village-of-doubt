import type { GamePhase } from "@werewolf/shared";

export interface ClockLike {
  setTimeout(callback: () => void, delayMs: number): { clear: () => void };
}

export interface PhaseStateMachineOptions {
  clock: ClockLike;
  onTimerElapsed: () => void;
}

export interface PausedPhaseSnapshot {
  phase: GamePhase;
  remainingMs: number;
}

export class PhaseStateMachine {
  private readonly clock: ClockLike;
  private readonly onTimerElapsed: () => void;
  private phaseTimer: ReturnType<ClockLike["setTimeout"]> | undefined;
  private pausedSnapshot: PausedPhaseSnapshot | undefined;

  constructor({ clock, onTimerElapsed }: PhaseStateMachineOptions) {
    this.clock = clock;
    this.onTimerElapsed = onTimerElapsed;
  }

  setPhase(phase: GamePhase, durationMs: number) {
    this.clearTimer();
    if (durationMs > 0 && phase !== "paused" && phase !== "game_over") {
      this.phaseTimer = this.clock.setTimeout(this.onTimerElapsed, durationMs);
    }
  }

  pause(snapshot: PausedPhaseSnapshot) {
    this.clearTimer();
    this.pausedSnapshot = snapshot;
  }

  resume() {
    const snapshot = this.pausedSnapshot;
    this.pausedSnapshot = undefined;
    return snapshot;
  }

  getPausedSnapshot() {
    return this.pausedSnapshot;
  }

  clearTimer() {
    this.phaseTimer?.clear();
    this.phaseTimer = undefined;
  }

  dispose() {
    this.clearTimer();
    this.pausedSnapshot = undefined;
  }
}
