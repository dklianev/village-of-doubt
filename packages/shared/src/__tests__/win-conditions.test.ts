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
});
