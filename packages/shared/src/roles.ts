import type { GameFamily } from "./game-config.js";
import { MAFIA_ROLE_DEFINITIONS } from "./games/mafia/roles.js";
import { TEAM_CODES, type TeamCode } from "./games/shared/types.js";
import { WEREWOLF_ROLE_DEFINITIONS } from "./games/werewolf/roles.js";

export { TEAM_CODES, type TeamCode } from "./games/shared/types.js";

export const ROLE_DEFINITIONS = {
  ...WEREWOLF_ROLE_DEFINITIONS,
  ...MAFIA_ROLE_DEFINITIONS,
} as const;

export type RoleCode = keyof typeof ROLE_DEFINITIONS;

export const PUBLIC_TITLES = {
  mayor: {
    nameBg: "Кмет",
    descriptionBg: "Публична титла. При равенство гласът на Кмета решава изхода.",
  },
} as const;

export function getRoleTeam(role: RoleCode): TeamCode {
  return ROLE_DEFINITIONS[role].team;
}

export function isEvilRole(role: RoleCode): boolean {
  const team = getRoleTeam(role);
  return team === "mafia" || team === "werewolves" || team === "vampires";
}

export function getRoleNameBg(role: RoleCode): string {
  return ROLE_DEFINITIONS[role].nameBg;
}

export function getRoleShortDescriptionBg(role: RoleCode): string {
  return ROLE_DEFINITIONS[role].shortDescriptionBg;
}

export function isRoleAvailableInFamily(role: RoleCode, family: GameFamily): boolean {
  const families: readonly GameFamily[] = ROLE_DEFINITIONS[role].availableInFamilies;
  return families.includes(family);
}

export function getRolesForFamily(family: GameFamily): RoleCode[] {
  return (Object.keys(ROLE_DEFINITIONS) as RoleCode[]).filter((role) => isRoleAvailableInFamily(role, family));
}

export function getRoleAssetKey(role: RoleCode): string {
  return ROLE_DEFINITIONS[role].assetKey;
}

export function teamLabelBg(team: TeamCode, family: GameFamily = "werewolves"): string {
  if (family === "mafia" && team === "village") {
    return "Град";
  }

  const labels: Record<TeamCode, string> = {
    village: "Селяни",
    werewolves: "Върколаци",
    vampires: "Вампири",
    mafia: "Мафия",
    lovers: "Влюбени",
    neutral: "Неутрален",
  };

  return labels[team];
}

export function assertKnownTeamCode(value: string): value is TeamCode {
  return (TEAM_CODES as readonly string[]).includes(value);
}
