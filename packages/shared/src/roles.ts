import type { GameFamily } from "./game-config.js";

export const TEAM_CODES = [
  "village",
  "werewolves",
  "vampires",
  "mafia",
  "lovers",
  "neutral",
] as const;

export type TeamCode = (typeof TEAM_CODES)[number];

export const ROLE_DEFINITIONS = {
  civilian: {
    nameBg: "Мирен гражданин",
    team: "village",
    secret: true,
    nightAction: false,
    availableInFamilies: ["mafia"],
  },
  commissioner: {
    nameBg: "Комисар",
    team: "village",
    secret: true,
    nightAction: true,
    availableInFamilies: ["mafia"],
  },
  mafioso: {
    nameBg: "Мафиот",
    team: "mafia",
    secret: true,
    nightAction: true,
    availableInFamilies: ["mafia"],
  },
  don: {
    nameBg: "Дон",
    team: "mafia",
    secret: true,
    nightAction: true,
    availableInFamilies: ["mafia"],
  },
  ordinary_villager: {
    nameBg: "Обикновен селянин",
    team: "village",
    secret: true,
    nightAction: false,
    availableInFamilies: ["werewolves"],
  },
  werewolf: {
    nameBg: "Върколак",
    team: "werewolves",
    secret: true,
    nightAction: true,
    availableInFamilies: ["werewolves"],
  },
  seer: {
    nameBg: "Ясновидка",
    team: "village",
    secret: true,
    nightAction: true,
    availableInFamilies: ["werewolves"],
  },
  witch: {
    nameBg: "Вещица",
    team: "village",
    secret: true,
    nightAction: true,
    availableInFamilies: ["werewolves"],
  },
  healer: {
    nameBg: "Лечител",
    team: "village",
    secret: true,
    nightAction: true,
    availableInFamilies: ["werewolves"],
  },
  priest: {
    nameBg: "Свещеник",
    team: "village",
    secret: true,
    nightAction: true,
    availableInFamilies: ["werewolves"],
  },
  hunter: {
    nameBg: "Ловец",
    team: "village",
    secret: true,
    nightAction: false,
    availableInFamilies: ["werewolves"],
  },
  cupid: {
    nameBg: "Купидон",
    team: "village",
    secret: true,
    nightAction: true,
    availableInFamilies: ["werewolves"],
  },
  vampire: {
    nameBg: "Вампир",
    team: "vampires",
    secret: true,
    nightAction: true,
    advanced: true,
    availableInFamilies: ["werewolves"],
  },
  jester: {
    nameBg: "Шут",
    team: "neutral",
    secret: true,
    nightAction: false,
    advanced: true,
    availableInFamilies: ["werewolves"],
  },
  little_girl: {
    nameBg: "Малко момиче",
    team: "village",
    secret: true,
    nightAction: false,
    advanced: true,
    availableInFamilies: ["werewolves"],
  },
  thief: {
    nameBg: "Крадец",
    team: "neutral",
    secret: true,
    nightAction: true,
    advanced: true,
    availableInFamilies: ["werewolves"],
  },
} as const satisfies Record<
  string,
  {
    nameBg: string;
    team: TeamCode;
    secret: boolean;
    nightAction: boolean;
    advanced?: boolean;
    availableInFamilies: readonly GameFamily[];
  }
>;

export type RoleCode = keyof typeof ROLE_DEFINITIONS;

export const PUBLIC_TITLES = {
  mayor: {
    nameBg: "Кмет",
    descriptionBg: "Публична титла. Гласът на Кмета се брои двойно.",
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

export function isRoleAvailableInFamily(role: RoleCode, family: GameFamily): boolean {
  const families: readonly GameFamily[] = ROLE_DEFINITIONS[role].availableInFamilies;
  return families.includes(family);
}

export function getRolesForFamily(family: GameFamily): RoleCode[] {
  return (Object.keys(ROLE_DEFINITIONS) as RoleCode[]).filter((role) => isRoleAvailableInFamily(role, family));
}
