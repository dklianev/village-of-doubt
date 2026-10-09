import { TUTORIAL_PLAYERS, type PlayerId, type TutorialMode } from "./tutorial-scenario";

export function playerName(id: PlayerId | null) {
  return TUTORIAL_PLAYERS.find((player) => player.id === id)?.name ?? "";
}

// Keep authored practice feedback with the deferred scenes, not the entry screen.
export function nightFinding(mode: TutorialMode, id: PlayerId) {
  const name = playerName(id);
  if (mode === "werewolves_classic") {
    return id === "boris" ? `${name} е нощна заплаха.` : `${name} не е нощна заплаха.`;
  }
  return id === "boris" ? `${name} е от Мафията.` : `${name} не е от Мафията.`;
}
