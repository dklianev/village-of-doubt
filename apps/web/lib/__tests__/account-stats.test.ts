import { describe, expect, it } from "vitest";
import { computePlayerStats } from "../account-stats";

function game(id: string, winnerTeam: string, endedAt: string) {
  return {
    id,
    code: id,
    hostId: null,
    roomVisibility: "private" as const,
    config: {},
    status: "ended",
    winnerTeam,
    startedAt: null,
    endedAt: new Date(endedAt),
    eventCount: 0,
  };
}

describe("computePlayerStats", () => {
  it("uses the authoritative persisted won outcome for Lovers and Jester", () => {
    const stats = computePlayerStats([
      { game: game("lovers", "lovers", "2026-07-01T00:00:00Z"), role: "seer", won: true },
      { game: game("jester", "village", "2026-07-02T00:00:00Z"), role: "jester", won: true },
      { game: game("lost", "village", "2026-07-03T00:00:00Z"), role: "seer", won: false },
    ], null);

    expect(stats).toMatchObject({
      totalGames: 3,
      totalWins: 2,
      winRate: 67,
      longestStreak: 2,
      villageWins: 0,
      threatWins: 0,
    });
  });

  it("does not infer a win from the final winner team", () => {
    const stats = computePlayerStats([
      { game: game("dynamic-role", "village", "2026-07-01T00:00:00Z"), role: "seer", won: false },
    ], null);

    expect(stats.totalWins).toBe(0);
  });
});
