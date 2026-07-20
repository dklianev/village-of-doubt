import { describe, expect, it } from "vitest";
import { playerStatusBadge } from "@/lib/play/player-display";
import type { PublicPlayer } from "@/lib/play/types";

const player: PublicPlayer = {
  userId: "u1",
  displayName: "Анна",
  connected: true,
  ready: true,
  playing: true,
  alive: true,
  host: false,
  narrator: false,
  acceptedFullNarrator: true,
  mayor: false,
  hasVoted: false,
  actedThisPhase: false,
  revealedRole: "",
};

describe("playerStatusBadge", () => {
  it("keeps night participation neutral regardless of the legacy action flag", () => {
    expect(playerStatusBadge(player, "night")).toBe("в играта");
    expect(playerStatusBadge({ ...player, actedThisPhase: true }, "first_night")).toBe("в играта");
  });
});
