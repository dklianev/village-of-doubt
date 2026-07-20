import { describe, expect, it } from "vitest";
import { evaluateWinCondition } from "../win-conditions.js";

describe("evaluateWinCondition", () => {
  it("lets the Maniac win as the last real threat", () => {
    expect(
      evaluateWinCondition([
        { playerId: "maniac", role: "maniac", alive: true },
        { playerId: "civilian", role: "civilian", alive: true },
      ]),
    ).toMatchObject({
      winner: "maniac",
      reasonBg: "Маниакът остана последната реална заплаха в града.",
    });
  });

  it("does not give the City a win while a Maniac is alive", () => {
    expect(
      evaluateWinCondition([
        { playerId: "maniac", role: "maniac", alive: true },
        { playerId: "civilian-1", role: "civilian", alive: true },
        { playerId: "civilian-2", role: "civilian", alive: true },
      ]),
    ).toMatchObject({
      winner: null,
      reasonBg: null,
    });
  });

  it("lets Werewolves win at parity (1 wolf vs 1 villager)", () => {
    expect(
      evaluateWinCondition([
        { playerId: "wolf", role: "werewolf", alive: true },
        { playerId: "villager", role: "ordinary_villager", alive: true },
      ]),
    ).toMatchObject({
      winner: "werewolves",
      reasonBg: "Върколаците са равни или повече от живите селяни.",
    });
  });

  it("lets Werewolves win at parity (2 wolves vs 2 villagers)", () => {
    expect(
      evaluateWinCondition([
        { playerId: "w1", role: "werewolf", alive: true },
        { playerId: "w2", role: "werewolf", alive: true },
        { playerId: "v1", role: "ordinary_villager", alive: true },
        { playerId: "v2", role: "ordinary_villager", alive: true },
      ]),
    ).toMatchObject({
      winner: "werewolves",
    });
  });

  it("keeps the game alive when villagers still outnumber werewolves", () => {
    expect(
      evaluateWinCondition([
        { playerId: "w1", role: "werewolf", alive: true },
        { playerId: "v1", role: "ordinary_villager", alive: true },
        { playerId: "v2", role: "ordinary_villager", alive: true },
      ]),
    ).toMatchObject({
      winner: null,
      reasonBg: null,
    });
  });

  it("lets Vampires win at parity", () => {
    expect(
      evaluateWinCondition([
        { playerId: "vamp", role: "vampire", alive: true },
        { playerId: "villager", role: "ordinary_villager", alive: true },
      ]),
    ).toMatchObject({
      winner: "vampires",
      reasonBg: "Вампирите са равни или повече от живите селяни.",
    });
  });

  it("keeps the game alive while Werewolves and Vampires can still eliminate each other", () => {
    expect(
      evaluateWinCondition([
        { playerId: "w1", role: "werewolf", alive: true },
        { playerId: "w2", role: "werewolf", alive: true },
        { playerId: "v1", role: "vampire", alive: true },
        { playerId: "village", role: "ordinary_villager", alive: true },
      ]),
    ).toMatchObject({
      winner: null,
      reasonBg: null,
    });

    expect(
      evaluateWinCondition([
        { playerId: "w1", role: "werewolf", alive: true },
        { playerId: "v1", role: "vampire", alive: true },
      ]),
    ).toMatchObject({
      winner: null,
      reasonBg: null,
    });
  });

  it("keeps the game alive when the Cook and a night threat can still vote", () => {
    expect(
      evaluateWinCondition([
        { playerId: "wolf", role: "werewolf", alive: true },
        { playerId: "cook", role: "cook", alive: true },
      ]),
    ).toMatchObject({
      winner: null,
      reasonBg: null,
    });
  });

  it("reports winners from current roles and keeps a Jester personal win additive", () => {
    expect(
      evaluateWinCondition([
        { playerId: "transformed", role: "werewolf", alive: true },
        { playerId: "villager", role: "ordinary_villager", alive: true },
        { playerId: "jester", role: "jester", alive: false, personalWin: true },
      ]),
    ).toMatchObject({
      winner: "werewolves",
      winnerPlayerIds: ["transformed"],
      personalWinnerPlayerIds: ["jester"],
    });
  });

  it("reports only the final cross-faction pair as Lovers winners", () => {
    expect(
      evaluateWinCondition([
        { playerId: "village-lover", role: "ordinary_villager", alive: true, loverId: "wolf-lover" },
        { playerId: "wolf-lover", role: "werewolf", alive: true, loverId: "village-lover" },
        { playerId: "dead-villager", role: "seer", alive: false },
      ]),
    ).toMatchObject({
      winner: "lovers",
      winnerPlayerIds: ["village-lover", "wolf-lover"],
      personalWinnerPlayerIds: [],
    });
  });
});
