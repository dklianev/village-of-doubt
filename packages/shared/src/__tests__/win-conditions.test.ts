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

  it("does not let Werewolves win by parity alone", () => {
    expect(
      evaluateWinCondition([
        { playerId: "wolf", role: "werewolf", alive: true },
        { playerId: "villager", role: "ordinary_villager", alive: true },
      ]),
    ).toMatchObject({
      winner: null,
      reasonBg: null,
    });
  });

  it("declares a stalemate when the last night threat cannot kill the Cook", () => {
    expect(
      evaluateWinCondition([
        { playerId: "wolf", role: "werewolf", alive: true },
        { playerId: "cook", role: "cook", alive: true },
      ]),
    ).toMatchObject({
      winner: "draw",
      reasonBg: "Последната нощна заплаха не може да преодолее Готвача.",
    });
  });
});
