import { describe, expect, it } from "vitest";
import {
  assignRoles,
  countRoles,
  createDefaultGameConfig,
  createGameConfigFromOptions,
  evaluateWinCondition,
  getMafiaSportPreset,
  getWerewolvesMvpPreset,
  ROLE_DEFINITIONS,
  validateRoleDistribution,
} from "../index.js";

describe("role presets", () => {
  it("matches the 10-player sport mafia preset", () => {
    const preset = getMafiaSportPreset(10);

    expect(preset).toEqual({
      civilian: 6,
      commissioner: 1,
      mafioso: 2,
      don: 1,
    });
    expect(countRoles(preset)).toBe(10);
  });

  it("uses two werewolves for 8-11 players and three for 12-15", () => {
    expect(getWerewolvesMvpPreset(8).werewolf).toBe(2);
    expect(getWerewolvesMvpPreset(11).werewolf).toBe(2);
    expect(getWerewolvesMvpPreset(12).werewolf).toBe(3);
    expect(getWerewolvesMvpPreset(15).werewolf).toBe(3);
  });

  it("keeps every 6-30 player werewolves preset exact", () => {
    for (let playerCount = 6; playerCount <= 30; playerCount += 1) {
      expect(countRoles(getWerewolvesMvpPreset(playerCount))).toBe(playerCount);
    }
  });

  it("adds advanced roles only when the table is large enough", () => {
    expect(getWerewolvesMvpPreset(14).vampire).toBeUndefined();
    expect(getWerewolvesMvpPreset(15).vampire).toBe(1);
    expect(getWerewolvesMvpPreset(16).jester).toBe(1);
    expect(getWerewolvesMvpPreset(12).priest).toBe(1);
    expect(getWerewolvesMvpPreset(13).thief).toBe(1);
    expect(getWerewolvesMvpPreset(10).healer).toBe(1);
    expect("guardian" in ROLE_DEFINITIONS).toBe(false);
  });

  it("adds Cupid only when lovers are enabled", () => {
    const withoutLovers = getWerewolvesMvpPreset(14);
    const withLovers = getWerewolvesMvpPreset(14, true);

    expect(withoutLovers.cupid).toBeUndefined();
    expect(withLovers.cupid).toBe(1);
    expect(countRoles(withLovers)).toBe(14);
    expect((withLovers.ordinary_villager ?? 0) + 1).toBe(withoutLovers.ordinary_villager);
  });

  it("warns on impossible manual role counts", () => {
    expect(validateRoleDistribution(8, { ordinary_villager: 4, werewolf: 2, seer: 1 })).toContain(
      "Броят роли (7) не съвпада с броя играчи (8).",
    );
  });

  it("builds config from lobby options with matching timers and live mode", () => {
    const config = createGameConfigFromOptions({
      mode: "werewolves_classic",
      playerCount: 14,
      narratorMode: "honest_human",
      communicationMode: "no_chat",
      tempoProfile: "live",
      loversEnabled: true,
    });

    expect(config.playerCount).toBe(14);
    expect(config.narratorMode).toBe("honest_human");
    expect(config.communicationMode).toBe("no_chat");
    expect(config.liveMode).toBe(true);
    expect(config.roles.cupid).toBe(1);
    expect(config.timers.autoAdvanceWhenReady).toBe(false);
  });

  it("supports manual role distribution from lobby options", () => {
    const config = createGameConfigFromOptions({
      mode: "werewolves_classic",
      playerCount: 6,
      roles: {
        ordinary_villager: 3,
        werewolf: 2,
        seer: 1,
        witch: 0,
      },
    });

    expect(config.rolePreset).toBe("manual");
    expect(config.roles).toEqual({
      ordinary_villager: 3,
      werewolf: 2,
      seer: 1,
    });
  });
});

describe("assignment and win conditions", () => {
  it("assigns exactly one role per player", () => {
    const config = createDefaultGameConfig("werewolves_classic", 8);
    const assignments = assignRoles(
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      config.roles,
      () => 0.42,
    );

    expect(assignments).toHaveLength(8);
    expect(new Set(assignments.map((assignment) => assignment.playerId)).size).toBe(8);
  });

  it("declares village victory when no evil role is alive", () => {
    const result = evaluateWinCondition([
      { playerId: "a", role: "ordinary_villager", alive: true },
      { playerId: "b", role: "seer", alive: true },
      { playerId: "c", role: "werewolf", alive: false },
    ]);

    expect(result.winner).toBe("village");
  });

  it("declares lovers victory when mixed lovers are final two", () => {
    const result = evaluateWinCondition([
      { playerId: "a", role: "ordinary_villager", alive: true, loverId: "b" },
      { playerId: "b", role: "werewolf", alive: true, loverId: "a" },
      { playerId: "c", role: "seer", alive: false },
    ]);

    expect(result.winner).toBe("lovers");
  });

  it("declares vampire victory at parity with everyone else", () => {
    const result = evaluateWinCondition([
      { playerId: "a", role: "vampire", alive: true },
      { playerId: "b", role: "werewolf", alive: true },
    ]);

    expect(result.winner).toBe("vampires");
  });

  it("does not let a lone neutral jester count as village", () => {
    const result = evaluateWinCondition([{ playerId: "a", role: "jester", alive: true }]);

    expect(result.winner).toBe("draw");
  });
});
