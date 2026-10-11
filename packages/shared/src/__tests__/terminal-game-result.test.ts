import { describe, expect, it } from "vitest";
import { parseTerminalGameResult, type TerminalGameResult } from "../protocol.js";
import { evaluateWinCondition, type WinPlayerState } from "../win-conditions.js";

const result: TerminalGameResult = {
  winnerTeam: "village",
  winnerPlayerIds: ["citizen"],
  personalWinnerPlayerIds: ["jester"],
  finalRoles: [{ userId: "citizen", role: "civilian" }, { userId: "jester", role: "jester" }],
};

describe("terminal game result protocol", () => {
  it.each([
    { winner: "village", role: "ordinary_villager", alive: true },
    { winner: "werewolves", role: "werewolf", alive: true },
    { winner: "mafia", role: "mafioso", alive: true },
    { winner: "draw", role: "ordinary_villager", alive: false },
  ] as const)("preserves the evaluator's $winner result and independent Jester winner", ({ winner, role, alive }) => {
    const players: WinPlayerState[] = [
      { playerId: "survivor", role, alive },
      { playerId: "eliminated-ally", role, alive: false },
      { playerId: "jester", role: "jester", alive: false, personalWin: true },
      { playerId: "night-jester", role: "jester", alive: false },
    ];
    const win = evaluateWinCondition(players);
    const parsed = parseTerminalGameResult({
      winnerTeam: win.winner,
      winnerPlayerIds: win.winnerPlayerIds,
      personalWinnerPlayerIds: win.personalWinnerPlayerIds,
      finalRoles: players.map(({ playerId, role }) => ({ userId: playerId, role })),
    });
    expect(parsed).toEqual({
      winnerTeam: winner,
      winnerPlayerIds: winner === "draw" ? [] : ["survivor", "eliminated-ally"],
      personalWinnerPlayerIds: ["jester"],
      finalRoles: players.map(({ playerId, role }) => ({ userId: playerId, role })),
    });
  });

  it.each(["village", "werewolves", "vampires", "mafia", "maniac", "lovers", "draw"] as const)("accepts %s without deriving winner IDs", (winnerTeam) => {
    const value = { ...result, winnerTeam, winnerPlayerIds: winnerTeam === "draw" ? [] : ["citizen"] };
    expect(parseTerminalGameResult(value)).toEqual(value);
  });

  it.each([
    undefined, null, [], {},
    { ...result, winnerTeam: "jester" },
    { ...result, winnerPlayerIds: [123] },
    { ...result, winnerPlayerIds: [""] },
    { ...result, winnerPlayerIds: ["observer"] },
    { ...result, winnerPlayerIds: ["citizen", "citizen"] },
    { ...result, personalWinnerPlayerIds: ["observer"] },
    { ...result, personalWinnerPlayerIds: ["jester", "jester"] },
    { ...result, finalRoles: [{ userId: "citizen", role: "unknown" }] },
    { ...result, finalRoles: [{ userId: "citizen", role: "toString" }] },
    { ...result, finalRoles: [null] },
    { ...result, finalRoles: [...result.finalRoles, result.finalRoles[0]] },
  ])("rejects absent or malformed structured results %#", (value) => {
    expect(parseTerminalGameResult(value)).toBeUndefined();
  });

  it("copies only the terminal allowlist, excluding extra private fields", () => {
    const parsed = parseTerminalGameResult({ ...result, secret: "synthetic", finalRoles: result.finalRoles.map((entry) => ({ ...entry, loverId: "synthetic" })) });
    expect(parsed).toEqual(result);
    expect(parsed).not.toBe(result);
    expect(parsed?.winnerPlayerIds).not.toBe(result.winnerPlayerIds);
  });
});
