import { describe, expect, it } from "vitest";
import type { TerminalGameResult } from "@werewolf/shared";
import { terminalResultForState } from "../terminal-result";

const result: TerminalGameResult = {
  winnerTeam: "draw", winnerPlayerIds: [], personalWinnerPlayerIds: ["jester"],
  finalRoles: [{ userId: "jester", role: "jester" }],
};
const state = { phase: "game_over", winnerTeam: "draw", terminalResultJson: JSON.stringify(result) };

describe("terminal result snapshots", () => {
  it.each(["lobby", "role_reveal", "night", "voting", "resolution", "paused"])("does not expose terminal data during %s", (phase) => {
    expect(terminalResultForState({ ...state, phase }, result)).toBeUndefined();
  });
  it("handles older servers, malformed JSON and mismatched outcomes without retaining stale data", () => {
    for (const terminalResultJson of [undefined, "", "{", "null", "{}", "[]"]) {
      expect(terminalResultForState({ phase: state.phase, winnerTeam: state.winnerTeam,
        ...(terminalResultJson === undefined ? {} : { terminalResultJson }) }, result)).toBeUndefined();
    }
    expect(terminalResultForState({ ...state, winnerTeam: "village" })).toBeUndefined();
  });
  it("decodes without text parsing and preserves unchanged references", () => {
    expect(terminalResultForState(state)).toEqual(result);
    expect(terminalResultForState(state, result)).toBe(result);
  });
});
