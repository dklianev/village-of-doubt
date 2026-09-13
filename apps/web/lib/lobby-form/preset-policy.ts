import type { GameMode, RolePreset } from "@werewolf/shared";

export function loversAvailableFor(mode: GameMode, playerCount: number, rolePreset: RolePreset) {
  return mode === "werewolves_classic" && playerCount >= 9 && rolePreset !== "beginner" && rolePreset !== "manual";
}
