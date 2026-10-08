import { getGameFamily, isRoleAvailableInFamily, parseTerminalGameResult, type GameMode, type GamePhase } from "@werewolf/shared";

export interface NarrationSceneContext {
  /** The actual room instance, not the reusable invitation code. */
  gameId: string;
  round: number;
  votingCycle?: number | undefined;
  winnerTeam?: string;
  terminalResult?: unknown;
  /** Bound at the receiving room boundary, never stamped onto a retained snapshot result. */
  terminalResultGameId?: string;
  terminalResultRound?: number;
  participantIds: readonly string[];
}

type TerminalContext = Pick<NarrationSceneContext, "terminalResult" | "terminalResultGameId" | "terminalResultRound">;

/** Read the current room's public result directly; an identical roster is not provenance. */
export function readNarrationTerminalResult(
  room: { roomId: string; state: unknown } | null | undefined,
  expectedGameId: string,
  expectedRound: number,
): TerminalContext {
  if (!room || !expectedGameId || room.roomId !== expectedGameId) return {};
  const state = room.state;
  if (!state || typeof state !== "object" || !("phase" in state) || state.phase !== "game_over"
    || !("round" in state) || state.round !== expectedRound
    || !("winnerTeam" in state) || !("terminalResultJson" in state)
    || typeof state.terminalResultJson !== "string" || state.terminalResultJson.length > 32_768) return {};
  try {
    const result = parseTerminalGameResult(JSON.parse(state.terminalResultJson));
    if (!result || result.winnerTeam !== state.winnerTeam) return {};
    return { terminalResult: result, terminalResultGameId: room.roomId, terminalResultRound: expectedRound };
  } catch {
    return {};
  }
}

interface CueScene {
  mode: GameMode;
  phase: GamePhase;
  narration?: NarrationSceneContext;
}

const PHASE_CUES: Partial<Record<GamePhase, string>> = {
  role_reveal: "role.reveal", first_night: "first.night", night: "night",
  day_announcement: "day.announcement", day_discussion: "day.discussion",
  voting: "voting", resolution: "resolution", nomination: "nomination", defense: "defense",
  hunter_revenge: "hunter.revenge", mayor_successor: "mayor.successor",
};

export function narrationOccurrence(scene: CueScene): string | null {
  const n = scene.narration;
  if (!n?.gameId || !Number.isSafeInteger(n.round) || n.round < 0) return null;
  if (scene.phase === "voting" && (!Number.isSafeInteger(n.votingCycle) || (n.votingCycle ?? 0) < 1)) return null;
  return JSON.stringify([n.gameId, scene.mode, n.round, scene.phase, scene.phase === "voting" ? n.votingCycle : 0]);
}

export function selectNarrationCues(scene: CueScene): string[] {
  if (!narrationOccurrence(scene)) return [];
  const family = getGameFamily(scene.mode);
  if (scene.phase !== "game_over") {
    if ((scene.phase === "nomination" || scene.phase === "defense") && scene.mode !== "mafia_sport") return [];
    if ((scene.phase === "hunter_revenge" || scene.phase === "mayor_successor") && family !== "werewolves") return [];
    const cue = PHASE_CUES[scene.phase];
    return cue ? [`${family}.phase.${cue}`] : [];
  }
  const n = scene.narration!;
  if (n.terminalResultGameId !== n.gameId || n.terminalResultRound !== n.round) return [];
  const result = parseTerminalGameResult(n.terminalResult);
  if (!result || result.winnerTeam !== n.winnerTeam) return [];
  const allowed = family === "werewolves"
    ? ["village", "werewolves", "vampires", "lovers", "draw"]
    : scene.mode === "mafia_sport" ? ["village", "mafia", "draw"] : ["village", "mafia", "maniac", "lovers", "draw"];
  if (!allowed.includes(result.winnerTeam) || !n.participantIds.length || n.participantIds.length > 30) return [];
  const ids = new Set(n.participantIds);
  if (ids.size !== n.participantIds.length || result.finalRoles.length !== ids.size
    || result.finalRoles.some(({ userId, role }) => !ids.has(userId) || !isRoleAvailableInFamily(role, family))) return [];
  if ((result.winnerTeam === "draw") !== (result.winnerPlayerIds.length === 0)) return [];
  // A personal result must explicitly belong to the final Jester, never just any nonempty ID list.
  const jesters = result.finalRoles.filter(({ role }) => role === "jester");
  if (jesters.length > 1 || result.personalWinnerPlayerIds.length > 1
    || (scene.mode === "mafia_sport" && (jesters.length || result.personalWinnerPlayerIds.length))) return [];
  if (result.personalWinnerPlayerIds.some(id => !jesters.some(jester => jester.userId === id))) return [];
  const cue = result.winnerTeam === "draw" ? "shared.finale.draw" : `${family}.finale.${result.winnerTeam}`;
  return result.personalWinnerPlayerIds.length ? [cue, "shared.personal.finale.jester"] : [cue];
}

/** Observes public occurrences only; never reconstructs game actions or victory conditions. */
export function createNarrationCueTracker() {
  let game = "";
  let last = "";
  let pendingFinale: { key: string; until: number } | null = null;
  const seen = new Set<string>();
  function reset() { game = ""; last = ""; pendingFinale = null; seen.clear(); }
  function update(scene: CueScene, audible: boolean, now = Date.now()) {
    const key = narrationOccurrence(scene);
    if (!key) { pendingFinale = null; return null; }
    const identity = JSON.stringify([scene.narration!.gameId, scene.mode]);
    if (game !== identity) {
      reset(); game = identity; last = key; seen.add(key);
      return null;
    }
    if (key !== last) {
      last = key;
      pendingFinale = null;
      if (seen.has(key)) return null;
      seen.add(key);
      if (seen.size > 64) seen.delete(seen.values().next().value!);
      if (!audible || scene.phase === "paused") return null;
      if (scene.phase === "game_over") pendingFinale = { key, until: now + 4000 };
      else {
        const cues = selectNarrationCues(scene);
        return cues.length ? { occurrence: key, cues } : null;
      }
    }
    if (!audible || (pendingFinale && now > pendingFinale.until)) pendingFinale = null;
    if (pendingFinale?.key === key) {
      const cues = selectNarrationCues(scene);
      if (cues.length) { pendingFinale = null; return { occurrence: key, cues }; }
    }
    return null;
  }
  return { update, reset };
}
