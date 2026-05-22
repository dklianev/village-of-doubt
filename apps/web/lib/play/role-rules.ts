import { ROLE_DEFINITIONS, type RoleCode } from "@werewolf/shared";

export function isNightPhase(phase: string) {
  return phase === "first_night" || phase === "night";
}

export function canFactionKill(role: RoleCode) {
  const team = ROLE_DEFINITIONS[role].team;
  return team === "mafia" || team === "werewolves" || team === "vampires" || role === "vigilante" || role === "maniac" || role === "vampire_hunter";
}
