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
  },
  commissioner: {
    nameBg: "Комисар",
    team: "village",
    secret: true,
    nightAction: true,
  },
  mafioso: {
    nameBg: "Мафиот",
    team: "mafia",
    secret: true,
    nightAction: true,
  },
  don: {
    nameBg: "Дон",
    team: "mafia",
    secret: true,
    nightAction: true,
  },
  ordinary_villager: {
    nameBg: "Обикновен селянин",
    team: "village",
    secret: true,
    nightAction: false,
  },
  werewolf: {
    nameBg: "Върколак",
    team: "werewolves",
    secret: true,
    nightAction: true,
  },
  seer: {
    nameBg: "Ясновидка",
    team: "village",
    secret: true,
    nightAction: true,
  },
  witch: {
    nameBg: "Вещица",
    team: "village",
    secret: true,
    nightAction: true,
  },
  healer: {
    nameBg: "Лечител",
    team: "village",
    secret: true,
    nightAction: true,
  },
  priest: {
    nameBg: "Свещеник",
    team: "village",
    secret: true,
    nightAction: true,
  },
  hunter: {
    nameBg: "Ловец",
    team: "village",
    secret: true,
    nightAction: false,
  },
  cupid: {
    nameBg: "Купидон",
    team: "village",
    secret: true,
    nightAction: true,
  },
  vampire: {
    nameBg: "Вампир",
    team: "vampires",
    secret: true,
    nightAction: true,
    advanced: true,
  },
  jester: {
    nameBg: "Шут",
    team: "neutral",
    secret: true,
    nightAction: false,
    advanced: true,
  },
  little_girl: {
    nameBg: "Малко момиче",
    team: "village",
    secret: true,
    nightAction: false,
    advanced: true,
  },
  thief: {
    nameBg: "Крадец",
    team: "neutral",
    secret: true,
    nightAction: true,
    advanced: true,
  },
} as const satisfies Record<
  string,
  {
    nameBg: string;
    team: TeamCode;
    secret: boolean;
    nightAction: boolean;
    advanced?: boolean;
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
