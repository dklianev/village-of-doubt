import { describe, expect, it } from "vitest";
import { arePhaseSlicesEqual, arePlayerListsEqual } from "@/lib/play/equality";
import type { PhaseSlice, PublicPlayer } from "@/lib/play/types";

describe("play room slice comparators", () => {
  it("keeps equal phase slices stable", () => {
    const phase: PhaseSlice = { phase: "day_discussion", round: 2, phaseEndsAt: 1234 };

    expect(arePhaseSlicesEqual(phase, { ...phase })).toBe(true);
    expect(arePhaseSlicesEqual(phase, { ...phase, phase: "voting" })).toBe(false);
  });

  it("detects player list changes without replacing equal lists", () => {
    const first = player({ userId: "u1", displayName: "Анна", ready: true });
    const second = player({ userId: "u2", displayName: "Борис" });

    expect(arePlayerListsEqual([first, second], [{ ...first }, { ...second }])).toBe(true);
    expect(arePlayerListsEqual([first, second], [first, { ...second, actedThisPhase: true }])).toBe(false);
  });
});

function player(overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    userId: "u1",
    displayName: "Играч",
    connected: true,
    ready: false,
    playing: true,
    alive: true,
    host: false,
    narrator: false,
    acceptedFullNarrator: false,
    mayor: false,
    hasVoted: false,
    actedThisPhase: false,
    revealedRole: "",
    ...overrides,
  };
}
