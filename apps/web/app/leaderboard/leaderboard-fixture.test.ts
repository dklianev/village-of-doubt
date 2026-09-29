import { describe, expect, it } from "vitest";
import { fixtureLeaderboard, LEADERBOARD_FIXTURE_AS_OF } from "./leaderboard-fixture";

describe("leaderboard fixtures", () => {
  it.each([1, 3, 18, 30])("supplies %i unique identities with valid in-window results", (count) => {
    const entries = fixtureLeaderboard(count);
    expect(entries).toHaveLength(count);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(count);
    for (const entry of entries) {
      expect(entry.wins).toBeLessThanOrEqual(entry.games);
      expect(entry.lastPlayed!.getTime()).toBeLessThanOrEqual(LEADERBOARD_FIXTURE_AS_OF.getTime());
      expect(entry.lastPlayed!.getTime()).toBeGreaterThan(LEADERBOARD_FIXTURE_AS_OF.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  });

  it("follows wins, participations, recent activity and stable identity order", () => {
    const entries = fixtureLeaderboard(30);
    for (let i = 1; i < entries.length; i++) {
      const a = entries[i - 1]!;
      const b = entries[i]!;
      expect(b.wins - a.wins || b.games - a.games || b.lastPlayed!.getTime() - a.lastPlayed!.getTime() || a.id!.localeCompare(b.id!)).toBeLessThanOrEqual(0);
    }
    expect(entries.slice(0, 4).map((entry) => entry.displayName)).toEqual(["Мила", "Калоян", "Борис", "Ива"]);
  });
});
