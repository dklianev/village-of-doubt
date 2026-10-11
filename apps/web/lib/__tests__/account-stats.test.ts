import { describe, expect, it } from "vitest";
import { computePlayerStats } from "../account-stats";

describe("computePlayerStats", () => {
  it("uses the authoritative persisted won outcome for Lovers and Jester", () => {
    const stats = computePlayerStats({
      totalGames: 3, totalWins: 2, longestStreak: 2,
      winsByRole: [
        { winnerTeam: "lovers", role: "seer", wins: 1 },
        { winnerTeam: "village", role: "jester", wins: 1 },
      ],
    }, null);

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
    const stats = computePlayerStats({ totalGames: 1, totalWins: 0, longestStreak: 0, winsByRole: [] }, null);

    expect(stats.totalWins).toBe(0);
  });

  it("keeps lifetime totals and classifies only matching faction wins using established teams", () => {
    const memberSince = new Date("2026-01-01T00:00:00Z");
    const stats = computePlayerStats({
      totalGames: 240, totalWins: 167, longestStreak: 64,
      winsByRole: [
        { role: "seer", winnerTeam: "village", wins: 80 },
        { role: "werewolf", winnerTeam: "werewolves", wins: 30 },
        { role: "vampire", winnerTeam: "vampires", wins: 20 },
        { role: "mafioso", winnerTeam: "mafia", wins: 10 },
        { role: "maniac", winnerTeam: "maniac", wins: 10 },
        { role: "seer", winnerTeam: "lovers", wins: 10 },
        { role: "jester", winnerTeam: "village", wins: 5 },
        { role: "werewolf", winnerTeam: "village", wins: 2 },
      ],
    }, memberSince);

    expect(stats).toEqual({
      totalGames: 240, totalWins: 167, winRate: 70,
      villageWins: 80, threatWins: 60, longestStreak: 64, memberSince,
    });
  });

  it("preserves authoritative wins with unknown roles without guessing their teams", () => {
    const stats = computePlayerStats({
      totalGames: 4, totalWins: 4, longestStreak: 4,
      winsByRole: [
        { role: "future_role", winnerTeam: "village", wins: 1 },
        { role: "constructor", winnerTeam: "mafia", wins: 1 },
        { role: "toString", winnerTeam: "village", wins: 1 },
        { role: "seer", winnerTeam: null, wins: 1 },
      ],
    }, null);

    expect(stats).toMatchObject({ totalWins: 4, winRate: 100, villageWins: 0, threatWins: 0 });
  });

  it("returns an empty history without invalid rates or a fabricated membership date", () => {
    expect(computePlayerStats({ totalGames: 0, totalWins: 0, longestStreak: 0, winsByRole: [] }, null)).toEqual({
      totalGames: 0, totalWins: 0, longestStreak: 0, winRate: 0, villageWins: 0, threatWins: 0, memberSince: null,
    });
  });
});
