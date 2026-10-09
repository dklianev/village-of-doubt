import { describe, expect, it } from "vitest";

import {
  deriveAchievementsFromEvents,
  evaluateAchievementUnlocks,
  type AchievementEventLike,
  type AchievementGameContext,
} from "../achievements.js";

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

function save(actorId: string | null, targetId: string, round = 2): AchievementEventLike {
  return { type: "night_death_prevented", phase: "night", round, actorId, targetId, payload: {} };
}

function ballot(voterIds: string[], round = 2): AchievementEventLike {
  return {
    type: "vote_tally", phase: "voting", round,
    payload: { tally: [], voters: voterIds.map((userId) => ({ userId })) },
  };
}

function awarded(context: AchievementGameContext, achievementId: string) {
  return evaluateAchievementUnlocks(context).filter((unlock) => unlock.achievementId === achievementId)
    .map((unlock) => unlock.userId);
}

describe("personal guardian saves", () => {
  const players = [
    { userId: "healer", role: "healer", alive: true },
    { userId: "doctor", role: "doctor", alive: true },
    { userId: "priest", role: "priest", alive: false },
    { userId: "bodyguard", role: "bodyguard", alive: false },
    { userId: "witch", role: "witch", alive: true },
    { userId: "bystander", role: "civilian", alive: true },
  ];

  it("awards two personal saved lives, not everyone in a protective role", () => {
    const events = [save("healer", "target-a"), save("healer", "target-b", 3), save("doctor", "target-c", 3)];
    expect(awarded({ players, events }, "guardian_save")).toEqual(["healer"]);
  });

  it("does not combine different protectors' saves", () => {
    expect(awarded({ players, events: [save("healer", "a"), save("doctor", "b")] }, "guardian_save")).toEqual([]);
  });

  it("does not count duplicate attacks/reports on the same life in one night", () => {
    const event = save("healer", "target");
    expect(awarded({ players, events: [event, event] }, "guardian_save")).toEqual([]);
    expect(awarded({ players, events: [event, save("healer", "target", 3)] }, "guardian_save")).toEqual(["healer"]);
  });

  it("does not guess attribution or a night from legacy/incomplete events", () => {
    const { round: _round, ...legacyEvent } = save("healer", "c");
    const events = [save(null, "a"), save(null, "b"), legacyEvent];
    expect(awarded({ players, events }, "guardian_save")).toEqual([]);
  });

  it("does not count daytime mayor protection or public priest narration", () => {
    const events = [
      { ...save("healer", "a"), phase: "voting", type: "guard_dog_protected_mayor" },
      { ...save("healer", "b"), phase: "voting", type: "guard_dog_protected_mayor" },
      { ...save("priest", "c"), type: "priest_blessing_protected" },
      { ...save("priest", "d"), type: "priest_blessing_protected" },
    ];
    expect(awarded({ players, events }, "guardian_save")).toEqual([]);
  });

  it.each(["priest", "bodyguard", "witch"])("credits attributable %s saves even after the protector dies", (actorId) => {
    const events = [save(actorId, "a", 1), save(actorId, "a", 2)].map((event) => ({
      ...event, type: actorId === "priest" ? "priest_blessing_protected_target" : event.type,
    }));
    expect(awarded({ players, events }, "guardian_save")).toEqual([actorId]);
  });

  it("does not award a removed attack if the target still dies that night", () => {
    const events = [save("witch", "a"), save("witch", "b"), { ...save(null, "b"), type: "death" }];
    expect(awarded({ players, events }, "guardian_save")).toEqual([]);
  });

  it.each(["first_night", "night"])("excludes hunter revenge deaths originating in %s", (phase) => {
    const round = phase === "first_night" ? 1 : 2;
    const events = [
      { ...save("healer", "a", round), phase },
      { ...save("healer", "b", round), phase },
      { ...save(null, "hunter", round), phase, type: "death" },
      { phase: "hunter_revenge", round, type: "phase_change", payload: {} },
      { ...save(null, "b", round), phase: "hunter_revenge", type: "death" },
      { phase: "day_announcement", round, type: "phase_change", payload: {} },
    ];
    expect(awarded({ players, events }, "guardian_save")).toEqual([]);
  });

  it.each(["night_death_prevented", "priest_blessing_protected_target"])(
    "keeps chained hunter/lover deaths in the originating night for %s", (type) => {
      const actorId = type === "night_death_prevented" ? "healer" : "priest";
      const events = [
        { ...save(actorId, "a"), type },
        { ...save(actorId, "b"), type },
        { ...save(null, "lover"), type: "death" },
        { ...save(null, "hunter"), type: "death" },
        { phase: "hunter_revenge", round: 2, type: "phase_change", payload: {} },
        { phase: "paused", round: 2, type: "phase_change", payload: {} },
        { phase: "hunter_revenge", round: 2, type: "phase_change", payload: { resumedFromPause: true } },
        { ...save(null, "another-hunter"), phase: "hunter_revenge", type: "death" },
        { phase: "hunter_revenge", round: 2, type: "phase_change", payload: {} },
        { ...save(null, "partner"), phase: "hunter_revenge", type: "death" },
        { ...save(null, "b"), phase: "hunter_revenge", type: "death" },
        { phase: "mayor_successor", round: 2, type: "phase_change", payload: {} },
        { phase: "day_announcement", round: 2, type: "phase_change", payload: {} },
      ];
      expect(awarded({ players, events }, "guardian_save")).toEqual([]);
    },
  );

  it.each(["day_announcement", "day_discussion", "voting", "resolution"])(
    "preserves night saves when later hunter/lover deaths follow %s in the same round", (phase) => {
      const events = [
        save("healer", "a"), save("healer", "b"),
        { phase, round: 2, type: "phase_change", payload: {} },
        { ...save(null, "hunter"), phase, type: "death" },
        { phase: "hunter_revenge", round: 2, type: "phase_change", payload: {} },
        { ...save(null, "a"), phase: "hunter_revenge", type: "death" },
        { ...save(null, "b"), phase: "hunter_revenge", type: "death" },
      ];
      expect(awarded({ players, events }, "guardian_save")).toEqual(["healer"]);
    },
  );

  it.each(["night", "hunter_revenge"])("preserves earlier saves when the target dies next night in %s", (phase) => {
    const events = [
      save("healer", "target", 2), save("healer", "target", 3),
      { phase: "night", round: 4, type: "phase_change", payload: {} },
      { ...save(null, "target", 4), phase, type: "death" },
    ];
    expect(awarded({ players, events }, "guardian_save")).toEqual(["healer"]);
  });

  it("does not carry a night origin into a different-round hunter event without phase markers", () => {
    const events = [
      save("healer", "a"), save("healer", "b"),
      { ...save(null, "b", 3), phase: "hunter_revenge", type: "death" },
    ];
    expect(awarded({ players, events }, "guardian_save")).toEqual(["healer"]);
  });

  it("does not award an unknown actor or a non-protective role", () => {
    const events = [save("unknown", "a"), save("unknown", "b"), save("bystander", "a"), save("bystander", "b")];
    expect(awarded({ players, events }, "guardian_save")).toEqual([]);
  });
});

describe("civilian voting participation", () => {
  const players = [
    { userId: "civilian", role: "civilian", alive: true },
    { userId: "villager", role: "ordinary_villager", alive: true },
    { userId: "dead", role: "civilian", alive: false },
    { userId: "seer", role: "seer", alive: true },
  ];

  it("requires a real final vote in every completed ballot", () => {
    const events = [ballot(["civilian", "villager", "dead", "seer"], 1), ballot(["civilian", "dead", "seer"], 2)];
    expect(awarded({ players, events }, "silent_civilian")).toEqual(["civilian"]);
  });

  it("requires every revote even when the round number is unchanged", () => {
    expect(awarded({ players, events: [ballot(["civilian"]), ballot([])] }, "silent_civilian")).toEqual([]);
  });

  it("does not award games without a ballot or with no cast votes", () => {
    expect(awarded({ players, events: [] }, "silent_civilian")).toEqual([]);
    expect(awarded({ players, events: [ballot([])] }, "silent_civilian")).toEqual([]);
  });

  it("uses final votes, so a submission replaced by a skip does not qualify", () => {
    const events: AchievementEventLike[] = [
      { phase: "voting", type: "vote_submitted", actorId: "civilian", targetId: "target", payload: {} },
      { phase: "voting", type: "vote_submitted", actorId: "civilian", payload: { skipped: true } },
      ballot([]),
    ];
    expect(awarded({ players, events }, "silent_civilian")).toEqual([]);
  });

  it("accepts a skip corrected before the ballot closes and ignores pause/resume events", () => {
    const events: AchievementEventLike[] = [
      { phase: "voting", type: "vote_submitted", actorId: "civilian", payload: { skipped: true } },
      { phase: "paused", type: "phase_change", payload: {} },
      { phase: "voting", type: "phase_change", payload: { resumedFromPause: true } },
      { phase: "voting", type: "vote_submitted", actorId: "civilian", targetId: "target", payload: {} },
      ballot(["civilian"]),
    ];
    expect(awarded({ players, events }, "silent_civilian")).toEqual(["civilian"]);
  });

  it.each([{}, { voters: null }, { voters: ["civilian"] }, { voters: [{ userId: "" }] }])(
    "does not infer participation from missing or malformed legacy tally data: %j", (payload) => {
      const events = [ballot(["civilian"]), { ...ballot([]), payload }];
      expect(awarded({ players, events }, "silent_civilian")).toEqual([]);
    },
  );

  it("does not assume a truncated event buffer contains every ballot", () => {
    expect(awarded({ players, events: [ballot(["civilian"])], eventsTruncated: true }, "silent_civilian")).toEqual([]);
  });
});

describe("event derivation uses the same predicates", () => {
  it("requires result/roster evidence, not a mention of the Maniac", () => {
    const events = [{ phase: "night", type: "death", payload: { causeBg: "Маниак", role: "maniac" } }];
    expect(deriveAchievementsFromEvents(events)).toEqual([]);
    expect(deriveAchievementsFromEvents(events, { players: [{ userId: "m", role: "maniac" }], winnerTeam: "village" }))
      .toEqual([]);
    expect(deriveAchievementsFromEvents(events, { players: [{ userId: "m", role: "maniac" }], winnerTeam: "maniac" })
      .map((achievement) => achievement.id)).toEqual(["maniac_endgame"]);
  });

  it("matches persisted predicate IDs for a complete context", () => {
    const context = {
      players: [{ userId: "healer", role: "healer" }, { userId: "civilian", role: "civilian", alive: true }],
      events: [save("healer", "a"), save("healer", "b", 3), ballot(["civilian"])],
    };
    const actual = new Set(evaluateAchievementUnlocks(context).map((unlock) => unlock.achievementId));
    expect(new Set(deriveAchievementsFromEvents(context.events, context).map((achievement) => achievement.id))).toEqual(actual);
    expect(deriveAchievementsFromEvents([save("healer", "a")], context)).toEqual([]);
  });

  it("does not count chat as important events in either evaluation path", () => {
    const context = {
      players: [{ userId: "civilian", role: "civilian", alive: true }],
      events: Array.from({ length: 20 }, () => ({ phase: "day_discussion", type: "chat", payload: {} })),
    };
    expect(evaluateAchievementUnlocks(context)).toEqual([]);
    expect(deriveAchievementsFromEvents(context.events, context)).toEqual([]);
    const gameplay = context.events.map((event) => ({ ...event, type: "phase_change" }));
    expect(deriveAchievementsFromEvents(gameplay, context).map((achievement) => achievement.id)).toEqual(["perfect_record"]);
  });
});
