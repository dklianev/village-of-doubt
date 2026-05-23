import type { PhaseSlice, PublicPlayer } from "@/lib/play/types";
import { arePlayersEqual } from "@/lib/play/player-display";

export function arePhaseSlicesEqual(a: PhaseSlice, b: PhaseSlice) {
  return a.phase === b.phase && a.round === b.round && a.phaseEndsAt === b.phaseEndsAt;
}

export function arePlayerListsEqual(a: PublicPlayer[], b: PublicPlayer[]) {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right || !arePlayersEqual(left, right)) {
      return false;
    }
  }
  return true;
}
