import { describe, expect, it } from "vitest";
import { flavorQuoteFor, formatNewspaperDate, headlineFor, winRatePercent, type LeaderboardEntry } from "../leaderboard-headlines";

function entry(overrides: Partial<LeaderboardEntry>): LeaderboardEntry {
  return { displayName: "Мила", games: 1, wins: 0, lastPlayed: null, ...overrides };
}

describe("leaderboard headline helpers", () => {
  it.each([[5, 5], [5, 4], [6, 3], [1, 1], [4, 0]])(
    "reports rank without inferring survival, a debut or lifetime record (%i games, %i wins)",
    (games, wins) => {
      expect(headlineFor(entry({ games, wins }), 1)).toBe("Мила оглавява броя");
      expect(flavorQuoteFor(entry({ games, wins }), 1)).not.toMatch(/оцел|дебют|различни роли|първа победа|поражение/i);
    },
  );

  it.each([
    [6, 6, "6 победи от 6 игри за последните 7 дни."],
    [1, 1, "1 победа от 1 игра за последните 7 дни."],
    [4, 1, "1 победа от 4 игри за последните 7 дни."],
    [3, 0, "0 победи от 3 игри за последните 7 дни."],
  ])("uses only measured results with correct singular forms", (games, wins, expected) => {
    expect(flavorQuoteFor(entry({ games, wins }), 1)).toBe(expected);
  });

  it("does not fabricate editorial stories for lower ranks", () => {
    expect(headlineFor(entry({}), 2)).toBe("Мила");
    expect(flavorQuoteFor(entry({}), 2)).toBeNull();
  });

  it("formats the winning share, including zero games", () => {
    expect(winRatePercent(entry({ games: 9, wins: 8 }))).toBe(89);
    expect(winRatePercent(entry({ games: 0, wins: 0 }))).toBe(0);
  });

  it("labels the snapshot using Sofia time even across the UTC date boundary", () => {
    expect(formatNewspaperDate(new Date("2026-09-17T22:30:00Z"))).toContain("18 септември");
    expect(formatNewspaperDate(new Date("2026-09-17T22:30:00Z"))).toContain("1:30");
  });
});
