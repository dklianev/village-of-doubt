import { parseTerminalGameResult, type TerminalGameResult } from "@werewolf/shared";

export function terminalResultForState(
  state: { phase: string; winnerTeam: string; terminalResultJson?: string },
  previous?: TerminalGameResult,
): TerminalGameResult | undefined {
  if (state.phase !== "game_over" || !state.terminalResultJson) return undefined;
  try {
    const result = parseTerminalGameResult(JSON.parse(state.terminalResultJson));
    if (!result || result.winnerTeam !== state.winnerTeam) return undefined;
    return previous && JSON.stringify(previous) === JSON.stringify(result) ? previous : result;
  } catch {
    return undefined;
  }
}
