import { describe, expect, it } from "vitest";

import { deriveAchievementsFromEvents, evaluateAchievementUnlocks } from "../achievements.js";

describe("achievement predicates", () => {
  it("unlocks the Jester achievement for the voted-out Jester", () => {
    const unlocks = evaluateAchievementUnlocks({
      winnerTeam: "jester",
      players: [
        { userId: "u-jester", role: "jester", alive: false },
        { userId: "u-civilian", role: "civilian", alive: true },
      ],
      events: [
        {
          phase: "voting",
          type: "jester_personal_win",
          targetId: "u-jester",
          payload: { reason: "voted_out" },
        },
      ],
    });

    expect(unlocks).toContainEqual({
      userId: "u-jester",
      achievementId: "jester_win",
    });
    expect(unlocks).not.toContainEqual({
      userId: "u-civilian",
      achievementId: "jester_win",
    });
  });

  it("keeps replay achievement derivation compatible with older event logs", () => {
    const replayAchievements = deriveAchievementsFromEvents([
      {
        phase: "voting",
        type: "jester_personal_win",
        targetId: "u-jester",
        payload: {},
      },
    ]);

    expect(replayAchievements.map((achievement) => achievement.id)).toContain("jester_win");
  });

  it("does not award quiet civilian if they skipped a vote", () => {
    const unlocks = evaluateAchievementUnlocks({
      winnerTeam: "village",
      players: [{ userId: "u-civilian", role: "civilian", alive: true }],
      events: [
        {
          phase: "voting",
          type: "vote_submitted",
          actorId: "u-civilian",
          payload: { skipped: true },
        },
      ],
    });

    expect(unlocks).not.toContainEqual({
      userId: "u-civilian",
      achievementId: "silent_civilian",
    });
  });
});
