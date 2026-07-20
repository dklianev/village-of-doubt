import { describe, expect, it } from "vitest";
import { nextPhaseTransitionArtHref } from "@/lib/play/phase-art";

describe("nextPhaseTransitionArtHref", () => {
  it("preloads the transition artwork shown by the next cinematic phase", () => {
    expect(nextPhaseTransitionArtHref("role_reveal", "werewolves", false)).toBe(
      "/game-art/transition-night-falls.webp",
    );
    expect(nextPhaseTransitionArtHref("night", "mafia", false)).toBe(
      "/game-art/mafia/bg-day-discussion.webp",
    );
    expect(nextPhaseTransitionArtHref("day_discussion", "werewolves", false)).toBe(
      "/game-art/transition-voting-starts.webp",
    );
    expect(nextPhaseTransitionArtHref("voting", "mafia", false)).toBe(
      "/game-art/mafia/bg-resolution.webp",
    );
  });

  it("uses the faction role reveal and mobile transition variants", () => {
    expect(nextPhaseTransitionArtHref("lobby", "mafia", false)).toBe(
      "/game-art/mafia/bg-role-reveal.webp",
    );
    expect(nextPhaseTransitionArtHref("lobby", "werewolves", true)).toBe(
      "/game-art/mobile/bg-role-reveal.webp",
    );
    expect(nextPhaseTransitionArtHref("night", "werewolves", true)).toBe(
      "/game-art/mobile/transition-village-wakes.webp",
    );
    expect(nextPhaseTransitionArtHref("night", "mafia", true)).toBe(
      "/game-art/mobile/mafia/bg-day-discussion.webp",
    );
  });
});
