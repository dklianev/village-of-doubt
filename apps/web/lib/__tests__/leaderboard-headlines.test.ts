import { describe, expect, it } from "vitest";
import { flavorQuoteFor, headlineFor, issueNumber, winRatePercent, type LeaderboardEntry } from "../leaderboard-headlines";

function entry(overrides: Partial<LeaderboardEntry>): LeaderboardEntry {
  return {
    displayName: "Мила",
    games: 1,
    wins: 0,
    lastPlayed: null,
    ...overrides,
  };
}

describe("leaderboard headline helpers", () => {
  it("uses the undefeated headline before other top-rank branches", () => {
    expect(headlineFor(entry({ games: 5, wins: 5 }), 1)).toBe("Мила още не познава поражение");
  });

  it("keeps rank one boundary copy stable", () => {
    expect(headlineFor(entry({ games: 5, wins: 4 }), 1)).toBe("Мила отново оцеля");
    expect(headlineFor(entry({ games: 6, wins: 3 }), 1)).toBe("Мила остава прав в нощите");
    expect(headlineFor(entry({ games: 1, wins: 1 }), 1)).toBe("Първа победа: Мила взе вечерта");
  });

  it("uses distinct copy for second and third place branches", () => {
    expect(headlineFor(entry({ games: 8, wins: 5 }), 2)).toBe("Мила остава в сянка");
    expect(headlineFor(entry({ games: 6, wins: 3 }), 2)).toBe("Мила се държи близо до върха");
    expect(headlineFor(entry({ games: 6, wins: 2 }), 3)).toBe("Мила вече има две победи");
  });

  it("formats top quote, win rate and issue number defensively", () => {
    expect(flavorQuoteFor(entry({ games: 6, wins: 6 }), 1)).toBe("6 победи от 6 вечери. Селото знае кого да гледа.");
    expect(flavorQuoteFor(entry({ games: 6, wins: 6 }), 2)).toBeNull();
    expect(winRatePercent(entry({ games: 0, wins: 0 }))).toBe(0);
    expect(issueNumber(0)).toBe("001");
    expect(issueNumber(12)).toBe("012");
  });
});
