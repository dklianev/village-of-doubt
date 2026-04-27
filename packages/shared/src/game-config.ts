import type { RoleCode } from "./roles.js";

export type GameMode = "mafia_sport" | "mafia_free" | "werewolves_classic";
export type RolePreset = "sport" | "free" | "classic_clean" | "mvp" | "manual";
export type NarratorMode = "automatic" | "honest_human" | "full_human";
export type CommunicationMode = "built_in_chat" | "no_chat" | "system_only" | "secret_channels";
export type TempoProfile = "fast_online" | "normal_online" | "live" | "sport_mafia" | "manual";
export type TieBreaker = "no_elimination" | "revote";

export type RoleDistribution = Partial<Record<RoleCode, number>>;

export interface PhaseTimers {
  roleRevealSeconds: number;
  personalNightActionSeconds: number;
  factionNightActionSeconds: number;
  dayDiscussionSeconds: number;
  playerSpeechSeconds: number;
  voteSeconds: number;
  resolutionSeconds: number;
  minimumPhaseSeconds: number;
  autoAdvanceWhenReady: boolean;
}

export interface GameConfig {
  mode: GameMode;
  rolePreset: RolePreset;
  playerCount: number;
  roles: RoleDistribution;
  mayorEnabled: boolean;
  narratorMode: NarratorMode;
  communicationMode: CommunicationMode;
  tempoProfile: TempoProfile;
  timers: PhaseTimers;
  revealRolesOnDeath: boolean;
  tieBreaker: TieBreaker;
  liveMode: boolean;
  firstNightKill: boolean;
  loversEnabled: boolean;
  rulesetVersion: string;
}

export interface GameConfigOptions {
  mode?: GameMode;
  playerCount?: number;
  roles?: RoleDistribution;
  narratorMode?: NarratorMode;
  communicationMode?: CommunicationMode;
  tempoProfile?: TempoProfile;
  loversEnabled?: boolean;
  revealRolesOnDeath?: boolean;
}

const DEFAULT_RULESET_VERSION = "bg-mvp-2026-04-24-roles-v2";

export const TEMPO_PRESETS: Record<TempoProfile, PhaseTimers> = {
  fast_online: {
    roleRevealSeconds: 15,
    personalNightActionSeconds: 25,
    factionNightActionSeconds: 30,
    dayDiscussionSeconds: 90,
    playerSpeechSeconds: 60,
    voteSeconds: 30,
    resolutionSeconds: 10,
    minimumPhaseSeconds: 5,
    autoAdvanceWhenReady: true,
  },
  normal_online: {
    roleRevealSeconds: 20,
    personalNightActionSeconds: 30,
    factionNightActionSeconds: 60,
    dayDiscussionSeconds: 180,
    playerSpeechSeconds: 60,
    voteSeconds: 60,
    resolutionSeconds: 15,
    minimumPhaseSeconds: 5,
    autoAdvanceWhenReady: true,
  },
  live: {
    roleRevealSeconds: 30,
    personalNightActionSeconds: 60,
    factionNightActionSeconds: 90,
    dayDiscussionSeconds: 300,
    playerSpeechSeconds: 60,
    voteSeconds: 90,
    resolutionSeconds: 20,
    minimumPhaseSeconds: 10,
    autoAdvanceWhenReady: false,
  },
  sport_mafia: {
    roleRevealSeconds: 20,
    personalNightActionSeconds: 30,
    factionNightActionSeconds: 30,
    dayDiscussionSeconds: 0,
    playerSpeechSeconds: 60,
    voteSeconds: 15,
    resolutionSeconds: 15,
    minimumPhaseSeconds: 5,
    autoAdvanceWhenReady: false,
  },
  manual: {
    roleRevealSeconds: 20,
    personalNightActionSeconds: 45,
    factionNightActionSeconds: 60,
    dayDiscussionSeconds: 180,
    playerSpeechSeconds: 60,
    voteSeconds: 60,
    resolutionSeconds: 15,
    minimumPhaseSeconds: 5,
    autoAdvanceWhenReady: false,
  },
};

const MAFIA_FREE_PRESETS: Record<number, RoleDistribution> = {
  4: { civilian: 2, commissioner: 1, mafioso: 1 },
  5: { civilian: 3, commissioner: 1, mafioso: 1 },
  6: { civilian: 4, commissioner: 1, mafioso: 1 },
  7: { civilian: 5, commissioner: 1, mafioso: 1 },
  8: { civilian: 5, commissioner: 1, mafioso: 1, don: 1 },
  9: { civilian: 6, commissioner: 1, mafioso: 1, don: 1 },
  10: { civilian: 6, commissioner: 1, mafioso: 2, don: 1 },
  11: { civilian: 7, commissioner: 1, mafioso: 2, don: 1 },
  12: { civilian: 8, commissioner: 1, mafioso: 2, don: 1 },
  13: { civilian: 9, commissioner: 1, mafioso: 2, don: 1 },
  14: { civilian: 9, commissioner: 1, mafioso: 3, don: 1 },
  15: { civilian: 10, commissioner: 1, mafioso: 3, don: 1 },
  16: { civilian: 11, commissioner: 1, mafioso: 3, don: 1 },
  17: { civilian: 12, commissioner: 1, mafioso: 3, don: 1 },
  18: { civilian: 12, commissioner: 1, mafioso: 4, don: 1 },
  19: { civilian: 13, commissioner: 1, mafioso: 4, don: 1 },
  20: { civilian: 14, commissioner: 1, mafioso: 4, don: 1 },
  21: { civilian: 15, commissioner: 1, mafioso: 4, don: 1 },
  22: { civilian: 15, commissioner: 1, mafioso: 5, don: 1 },
  23: { civilian: 16, commissioner: 1, mafioso: 5, don: 1 },
  24: { civilian: 17, commissioner: 1, mafioso: 5, don: 1 },
};

const WEREWOLVES_MVP_PRESETS: Record<number, RoleDistribution> = {
  6: { ordinary_villager: 2, werewolf: 2, seer: 1, healer: 1 },
  7: { ordinary_villager: 3, werewolf: 2, seer: 1, healer: 1 },
  8: { ordinary_villager: 3, werewolf: 2, seer: 1, healer: 1, hunter: 1 },
  9: { ordinary_villager: 4, werewolf: 2, seer: 1, witch: 1, hunter: 1 },
  10: { ordinary_villager: 4, werewolf: 2, seer: 1, witch: 1, healer: 1, hunter: 1 },
  11: { ordinary_villager: 5, werewolf: 2, seer: 1, witch: 1, healer: 1, hunter: 1 },
  12: { ordinary_villager: 5, werewolf: 3, seer: 1, witch: 1, healer: 1, priest: 1 },
  13: { ordinary_villager: 4, werewolf: 3, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1 },
  14: { ordinary_villager: 5, werewolf: 3, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1 },
  15: { ordinary_villager: 5, werewolf: 3, vampire: 1, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1 },
  16: { ordinary_villager: 5, werewolf: 3, vampire: 1, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
  17: { ordinary_villager: 6, werewolf: 3, vampire: 1, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
  18: { ordinary_villager: 7, werewolf: 3, vampire: 1, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
  19: { ordinary_villager: 7, werewolf: 4, vampire: 1, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
  20: { ordinary_villager: 8, werewolf: 4, vampire: 1, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
  21: { ordinary_villager: 9, werewolf: 4, vampire: 1, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
  22: { ordinary_villager: 9, werewolf: 4, vampire: 2, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
  23: { ordinary_villager: 10, werewolf: 4, vampire: 2, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
  24: { ordinary_villager: 11, werewolf: 4, vampire: 2, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
  25: { ordinary_villager: 11, werewolf: 5, vampire: 2, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
  26: { ordinary_villager: 12, werewolf: 5, vampire: 2, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
  27: { ordinary_villager: 13, werewolf: 5, vampire: 2, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
  28: { ordinary_villager: 14, werewolf: 5, vampire: 2, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
  29: { ordinary_villager: 15, werewolf: 5, vampire: 2, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
  30: { ordinary_villager: 15, werewolf: 6, vampire: 2, seer: 1, witch: 1, healer: 1, priest: 1, hunter: 1, thief: 1, jester: 1 },
};

export function countRoles(distribution: RoleDistribution): number {
  return Object.values(distribution).reduce((sum, count) => sum + (count ?? 0), 0);
}

export function getMafiaSportPreset(playerCount: number): RoleDistribution {
  if (playerCount !== 10) {
    throw new Error("Спортната Мафия е балансирана за точно 10 играчи.");
  }

  return { civilian: 6, commissioner: 1, mafioso: 2, don: 1 };
}

export function getMafiaFreePreset(playerCount: number): RoleDistribution {
  const preset = MAFIA_FREE_PRESETS[playerCount];
  if (!preset) {
    throw new Error("Свободната Мафия поддържа 4-24 играчи в MVP.");
  }
  return { ...preset };
}

export function getWerewolvesClassicPreset(playerCount: number): RoleDistribution {
  if (playerCount < 6 || playerCount > 30) {
    throw new Error("Класическите Върколаци поддържат 6-30 играчи в MVP.");
  }

  const werewolves =
    playerCount <= 11 ? 2 : playerCount <= 15 ? 3 : Math.floor(playerCount / 4);

  return {
    ordinary_villager: playerCount - werewolves - 1,
    werewolf: werewolves,
    seer: 1,
  };
}

export function getWerewolvesMvpPreset(playerCount: number, loversEnabled = false): RoleDistribution {
  const fixed = WEREWOLVES_MVP_PRESETS[playerCount];
  if (fixed) {
    return withOptionalCupid(fixed, loversEnabled, playerCount);
  }

  throw new Error("MVP preset-ът за Върколаци поддържа 6-30 играчи.");
}

export function validateRoleDistribution(playerCount: number, distribution: RoleDistribution): string[] {
  const warnings: string[] = [];
  const total = countRoles(distribution);
  const evilCount =
    (distribution.mafioso ?? 0) +
    (distribution.don ?? 0) +
    (distribution.werewolf ?? 0) +
    (distribution.vampire ?? 0);

  if (total !== playerCount) {
    warnings.push(`Броят роли (${total}) не съвпада с броя играчи (${playerCount}).`);
  }

  if (evilCount < Math.max(1, Math.floor(playerCount / 5))) {
    warnings.push("Злата страна вероятно е твърде слаба.");
  }

  if (evilCount > Math.ceil(playerCount / 3)) {
    warnings.push("Злата страна вероятно е твърде силна.");
  }

  if ((distribution.seer ?? 0) === 0 && (distribution.werewolf ?? 0) > 0) {
    warnings.push("Липсва Ясновидка при Върколаци.");
  }

  if ((distribution.commissioner ?? 0) === 0 && ((distribution.mafioso ?? 0) + (distribution.don ?? 0)) > 0) {
    warnings.push("Липсва Комисар при Мафия.");
  }

  if ((distribution.little_girl ?? 0) > 0) {
    warnings.push("Малко момиче е advanced роля и изисква дигитална адаптация.");
  }

  if ((distribution.thief ?? 0) > 0 && playerCount < 13) {
    warnings.push("Крадецът е advanced роля и е по-подходящ за 13+ играчи.");
  }

  if ((distribution.vampire ?? 0) > 0 && playerCount < 15) {
    warnings.push("Вампирите са third faction и са по-подходящи за 15+ играчи.");
  }

  if ((distribution.jester ?? 0) > 0 && playerCount < 13) {
    warnings.push("Шутът е neutral win роля и е по-подходящ за 13+ играчи.");
  }

  return warnings;
}

export function createDefaultGameConfig(mode: GameMode, playerCount: number): GameConfig {
  const rolePreset: RolePreset = mode === "mafia_sport" ? "sport" : mode === "mafia_free" ? "free" : "mvp";
  const tempoProfile: TempoProfile = mode === "mafia_sport" ? "sport_mafia" : "normal_online";
  const roles =
    mode === "mafia_sport"
      ? getMafiaSportPreset(playerCount)
      : mode === "mafia_free"
        ? getMafiaFreePreset(playerCount)
        : getWerewolvesMvpPreset(playerCount);

  return {
    mode,
    rolePreset,
    playerCount,
    roles,
    mayorEnabled: mode === "werewolves_classic",
    narratorMode: "automatic",
    communicationMode: "built_in_chat",
    tempoProfile,
    timers: TEMPO_PRESETS[tempoProfile],
    revealRolesOnDeath: true,
    tieBreaker: mode === "mafia_sport" || mode === "mafia_free" ? "revote" : "no_elimination",
    liveMode: false,
    firstNightKill: playerCount >= 8,
    loversEnabled: false,
    rulesetVersion: DEFAULT_RULESET_VERSION,
  };
}

export function createGameConfigFromOptions(options: GameConfigOptions = {}): GameConfig {
  const mode = options.mode ?? "werewolves_classic";
  const playerCount = options.playerCount ?? (mode === "mafia_sport" ? 10 : 8);
  const config = createDefaultGameConfig(mode, playerCount);

  const tempoProfile = options.tempoProfile ?? config.tempoProfile;
  const loversEnabled = options.loversEnabled ?? config.loversEnabled;
  const roles = options.roles
    ? normalizeRoleDistribution(options.roles)
    : mode === "werewolves_classic"
      ? getWerewolvesMvpPreset(playerCount, loversEnabled)
      : config.roles;

  return {
    ...config,
    rolePreset: options.roles ? "manual" : config.rolePreset,
    roles,
    narratorMode: options.narratorMode ?? config.narratorMode,
    communicationMode: options.communicationMode ?? config.communicationMode,
    tempoProfile,
    timers: TEMPO_PRESETS[tempoProfile],
    liveMode: tempoProfile === "live",
    loversEnabled,
    revealRolesOnDeath: options.revealRolesOnDeath ?? config.revealRolesOnDeath,
  };
}

export function normalizeRoleDistribution(distribution: RoleDistribution): RoleDistribution {
  const normalized: RoleDistribution = {};
  for (const [role, count] of Object.entries(distribution) as [RoleCode, number | undefined][]) {
    const safeCount = Math.max(0, Math.floor(count ?? 0));
    if (safeCount > 0) {
      normalized[role] = safeCount;
    }
  }
  return normalized;
}

function withOptionalCupid(distribution: RoleDistribution, loversEnabled: boolean, playerCount: number): RoleDistribution {
  const preset = { ...distribution };
  if (!loversEnabled) {
    return preset;
  }
  if (playerCount < 9) {
    return preset;
  }
  if ((preset.cupid ?? 0) > 0) {
    return preset;
  }

  const villagers = preset.ordinary_villager ?? 0;
  if (villagers <= 0) {
    return preset;
  }

  preset.ordinary_villager = villagers - 1;
  if (preset.ordinary_villager === 0) {
    delete preset.ordinary_villager;
  }
  preset.cupid = 1;
  return preset;
}
