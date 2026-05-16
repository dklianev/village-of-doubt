import { getRoleNameBg, isRoleAvailableInFamily, type RoleCode } from "./roles.js";
import type { GamePhase } from "./protocol.js";

export type GameMode = "mafia_sport" | "mafia_free" | "werewolves_classic";
export type GameFamily = "werewolves" | "mafia";
export type RolePreset =
  | "sport"
  | "free"
  | "beginner"
  | "classic"
  | "advanced"
  | "wolves_vampires"
  | "classic_clean"
  | "mvp"
  | "manual";
export type NarratorMode = "automatic" | "honest_human" | "full_human";
export type CommunicationMode = "built_in_chat" | "no_chat" | "system_only" | "secret_channels";
export type TempoProfile = "fast_online" | "normal_online" | "live" | "sport_mafia" | "manual";
export type TieBreaker = "no_elimination" | "revote";
export type RoomVisibility = "private" | "public";
export type MajorityMode = "simple" | "absolute";
export type WerewolfVariant = "werewolves_vs_village" | "vampires_vs_village" | "three_teams";
export type MayorMode = "secret_role" | "public_vote";
export type CommissionerResultMode = "team_only" | "exact_role";
export type NarratorVoice = "classic" | "old_villager" | "inspector" | "witch";

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
  roomName: string;
  rolePreset: RolePreset;
  playerCount: number;
  maxPlayers: number;
  roomVisibility: RoomVisibility;
  roles: RoleDistribution;
  mayorEnabled: boolean;
  narratorMode: NarratorMode;
  communicationMode: CommunicationMode;
  tempoProfile: TempoProfile;
  timers: PhaseTimers;
  revealRolesOnDeath: boolean;
  tieBreaker: TieBreaker;
  allowSkipVote: boolean;
  majorityMode: MajorityMode;
  autoStart: boolean;
  beginnerMode: boolean;
  advancedMode: boolean;
  liveMode: boolean;
  firstNightKill: boolean;
  loversEnabled: boolean;
  werewolfVariant: WerewolfVariant;
  mayorMode: MayorMode;
  // Promo rule runtime enforcement is tracked in docs/post-launch-todo.md.
  promoRolesEnabled: boolean;
  mafiaNightKill: boolean;
  doctorCanSelfProtect: boolean;
  commissionerResultMode: CommissionerResultMode;
  maniacEnabled: boolean;
  jesterEnabled: boolean;
  narratorVoice: NarratorVoice;
  rulesetVersion: string;
}

export interface GameConfigOptions {
  mode?: GameMode;
  roomName?: string;
  playerCount?: number;
  maxPlayers?: number;
  roomVisibility?: RoomVisibility;
  roles?: RoleDistribution;
  rolePreset?: RolePreset;
  narratorMode?: NarratorMode;
  communicationMode?: CommunicationMode;
  tempoProfile?: TempoProfile;
  loversEnabled?: boolean;
  revealRolesOnDeath?: boolean;
  tieBreaker?: TieBreaker;
  allowSkipVote?: boolean;
  majorityMode?: MajorityMode;
  autoStart?: boolean;
  beginnerMode?: boolean;
  advancedMode?: boolean;
  werewolfVariant?: WerewolfVariant;
  mayorMode?: MayorMode;
  promoRolesEnabled?: boolean;
  mafiaNightKill?: boolean;
  doctorCanSelfProtect?: boolean;
  commissionerResultMode?: CommissionerResultMode;
  maniacEnabled?: boolean;
  jesterEnabled?: boolean;
  narratorVoice?: NarratorVoice;
}

export interface RoleValidationOptions {
  mayorMode?: MayorMode;
  werewolfVariant?: WerewolfVariant;
  promoRolesEnabled?: boolean;
}

const DEFAULT_RULESET_VERSION = "bg-werewolf-mafia-2026-04-28-separated-games";

export const GAME_MODE_DEFINITIONS: Record<
  GameMode,
  {
    family: GameFamily;
    nameBg: string;
    shortBg: string;
    recommendedPlayersBg: string;
    themeKey: GameFamily;
    phaseLabelsBg: Partial<Record<GamePhase, string>>;
  }
> = {
  werewolves_classic: {
    family: "werewolves",
    nameBg: "Върколак",
    shortBg: "Класическа игра с тайни роли, нощни заплахи и дневно гласуване.",
    recommendedPlayersBg: "6-30 играчи, най-добре 8-18.",
    themeKey: "werewolves",
    phaseLabelsBg: {},
  },
  mafia_sport: {
    family: "mafia",
    nameBg: "Спортна Мафия",
    shortBg: "Строг 10-играчов формат с Комисар, Кръстник и точна реч.",
    recommendedPlayersBg: "Точно 10 играчи.",
    themeKey: "mafia",
    phaseLabelsBg: {
      first_night: "Първи договор",
      night: "Нощни договорки",
      day_announcement: "Градът се събужда",
      day_discussion: "Речи на масата",
      voting: "Обвинение",
      resolution: "Присъда",
    },
  },
  mafia_free: {
    family: "mafia",
    nameBg: "Мафия",
    shortBg: "Градска мистерия с гъвкав брой играчи и configurable роли.",
    recommendedPlayersBg: "4-24 играчи.",
    themeKey: "mafia",
    phaseLabelsBg: {
      first_night: "Първи договор",
      night: "Сделките започват",
      day_announcement: "Градът се събужда",
      day_discussion: "Градът говори",
      voting: "Обвинение",
      resolution: "Присъда",
    },
  },
};

export const ROLE_PRESET_LABELS_BG: Record<RolePreset, string> = {
  sport: "Спортна Мафия",
  free: "Свободна Мафия",
  beginner: "Начинаещи",
  classic: "Класическа игра",
  advanced: "Разширена игра",
  wolves_vampires: "Върколаци и вампири",
  classic_clean: "Класическа чиста",
  mvp: "Готово разпределение",
  manual: "Персонализирана",
};

export const NARRATOR_VOICE_LABELS_BG: Record<NarratorVoice, string> = {
  classic: "Класически Разказвач",
  old_villager: "Старият селянин",
  inspector: "Инспекторът",
  witch: "Вещицата",
};

export function getGameFamily(mode: GameMode): GameFamily {
  return GAME_MODE_DEFINITIONS[mode].family;
}

export function getGameModeNameBg(mode: GameMode): string {
  return GAME_MODE_DEFINITIONS[mode].nameBg;
}

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
  6: { civilian: 3, commissioner: 1, doctor: 1, mafioso: 1 },
  7: { civilian: 4, commissioner: 1, doctor: 1, mafioso: 1 },
  8: { civilian: 4, commissioner: 1, doctor: 1, mafioso: 1, don: 1 },
  9: { civilian: 5, commissioner: 1, doctor: 1, mafioso: 1, don: 1 },
  10: { civilian: 5, commissioner: 1, doctor: 1, mafioso: 2, don: 1 },
  11: { civilian: 6, commissioner: 1, doctor: 1, mafioso: 2, don: 1 },
  12: { civilian: 7, commissioner: 1, doctor: 1, mafioso: 2, don: 1 },
  13: { civilian: 8, commissioner: 1, doctor: 1, mafioso: 2, don: 1 },
  14: { civilian: 9, commissioner: 1, doctor: 1, mafioso: 2, don: 1 },
  15: { civilian: 9, commissioner: 1, doctor: 1, mafioso: 3, don: 1 },
  16: { civilian: 11, commissioner: 1, doctor: 1, mafioso: 2, don: 1 },
  17: { civilian: 12, commissioner: 1, doctor: 1, mafioso: 2, don: 1 },
  18: { civilian: 12, commissioner: 1, doctor: 1, mafioso: 3, don: 1 },
  19: { civilian: 13, commissioner: 1, doctor: 1, mafioso: 3, don: 1 },
  20: { civilian: 14, commissioner: 1, doctor: 1, mafioso: 3, don: 1 },
  21: { civilian: 15, commissioner: 1, doctor: 1, mafioso: 3, don: 1 },
  22: { civilian: 16, commissioner: 1, doctor: 1, mafioso: 3, don: 1 },
  23: { civilian: 17, commissioner: 1, doctor: 1, mafioso: 3, don: 1 },
  24: { civilian: 17, commissioner: 1, doctor: 1, mafioso: 4, don: 1 },
};

const WEREWOLF_CLASSIC_PRESETS: Record<number, RoleDistribution> = {
  6: { ordinary_villager: 2, werewolf: 2, seer: 1, healer: 1 },
  7: { ordinary_villager: 3, werewolf: 2, seer: 1, healer: 1 },
  8: { ordinary_villager: 3, werewolf: 2, seer: 1, healer: 1, hunter: 1 },
  9: { ordinary_villager: 4, werewolf: 2, seer: 1, witch: 1, hunter: 1 },
  10: { ordinary_villager: 5, werewolf: 2, seer: 1, witch: 1, hunter: 1 },
  11: { ordinary_villager: 5, werewolf: 3, seer: 1, witch: 1, hunter: 1 },
  12: { ordinary_villager: 6, werewolf: 3, seer: 1, witch: 1, hunter: 1 },
  13: { ordinary_villager: 6, werewolf: 3, seer: 1, witch: 1, healer: 1, hunter: 1 },
  14: { ordinary_villager: 6, werewolf: 4, seer: 1, witch: 1, healer: 1, hunter: 1 },
  15: { ordinary_villager: 7, werewolf: 4, seer: 1, witch: 1, healer: 1, hunter: 1 },
  16: { ordinary_villager: 8, werewolf: 4, seer: 1, witch: 1, healer: 1, hunter: 1 },
  17: { ordinary_villager: 9, werewolf: 4, seer: 1, witch: 1, healer: 1, hunter: 1 },
  18: { ordinary_villager: 10, werewolf: 4, seer: 1, witch: 1, healer: 1, hunter: 1 },
};

export function countRoles(distribution: RoleDistribution): number {
  return Object.values(distribution).reduce((sum, count) => sum + (count ?? 0), 0);
}

export function getRoleBalanceScore(distribution: RoleDistribution): number {
  return Object.entries(distribution).reduce((sum, [role, count]) => {
    const roleValue = roleValueBg(role as RoleCode);
    return sum + roleValue * (count ?? 0);
  }, 0);
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
    throw new Error("Мафия поддържа 4-24 играчи в основния режим.");
  }
  return { ...preset };
}

export function getWerewolvesClassicPreset(playerCount: number): RoleDistribution {
  if (playerCount < 6 || playerCount > 30) {
    throw new Error("Върколак поддържа 6-30 играчи в основния режим.");
  }

  const fixed = WEREWOLF_CLASSIC_PRESETS[playerCount];
  if (fixed) {
    return { ...fixed };
  }

  const werewolves = playerCount <= 22 ? 5 : playerCount <= 28 ? 6 : 7;
  return {
    ordinary_villager: playerCount - werewolves - 4,
    werewolf: werewolves,
    seer: 1,
    witch: 1,
    healer: 1,
    hunter: 1,
  };
}

export function getWerewolfBeginnerPreset(playerCount: number): RoleDistribution {
  const preset = getWerewolvesClassicPreset(playerCount);
  const werewolves = preset.werewolf ?? 2;
  return normalizeRoleDistribution({
    ordinary_villager: playerCount - werewolves - 2,
    werewolf: werewolves,
    seer: 1,
    healer: 1,
  });
}

export function getWerewolfAdvancedPreset(playerCount: number): RoleDistribution {
  const base = getWerewolvesClassicPreset(playerCount);
  if (playerCount < 12) {
    return base;
  }

  const villagers = Math.max(0, (base.ordinary_villager ?? 0) - 1);
  return normalizeRoleDistribution({
    ...base,
    ordinary_villager: villagers,
    oracle: 1,
  });
}

export function getWerewolfVampiresPreset(playerCount: number): RoleDistribution {
  if (playerCount < 14) {
    throw new Error("Върколаци и вампири е подходящо за поне 14 играчи.");
  }

  const werewolves = Math.max(3, Math.floor(playerCount / 6));
  const vampires = Math.max(3, Math.floor(playerCount / 6));
  return normalizeRoleDistribution({
    ordinary_villager: playerCount - werewolves - vampires - 4,
    werewolf: werewolves,
    vampire: vampires,
    seer: 1,
    witch: 1,
    healer: 1,
    hunter: 1,
  });
}

export function getWerewolvesMvpPreset(playerCount: number, loversEnabled = false): RoleDistribution {
  return withOptionalCupid(getWerewolvesClassicPreset(playerCount), loversEnabled, playerCount);
}

export function getWerewolfPresetByRolePreset(playerCount: number, rolePreset: RolePreset): RoleDistribution {
  if (rolePreset === "beginner") {
    return getWerewolfBeginnerPreset(playerCount);
  }
  if (rolePreset === "advanced") {
    return getWerewolfAdvancedPreset(playerCount);
  }
  if (rolePreset === "wolves_vampires") {
    return getWerewolfVampiresPreset(playerCount);
  }
  return getWerewolvesClassicPreset(playerCount);
}

export function validateRoleDistribution(playerCount: number, distribution: RoleDistribution): string[] {
  return validateRoleDistributionForMode("werewolves_classic", playerCount, distribution);
}

export function validateRoleDistributionForMode(
  mode: GameMode,
  playerCount: number,
  distribution: RoleDistribution,
  options: RoleValidationOptions = {},
): string[] {
  const warnings: string[] = [];
  const family = getGameFamily(mode);
  const total = countRoles(distribution);
  const evilCount =
    (distribution.mafioso ?? 0) +
    (distribution.don ?? 0) +
    (distribution.werewolf ?? 0) +
    (distribution.vampire ?? 0) +
    (distribution.maniac ?? 0);

  if (total !== playerCount) {
    warnings.push(`Броят роли (${total}) не съвпада с броя играчи (${playerCount}).`);
  }

  for (const role of Object.keys(distribution) as RoleCode[]) {
    if (!isRoleAvailableInFamily(role, family)) {
      warnings.push(`${getRoleNameBg(role)} не принадлежи към тази игра.`);
    }
  }

  if (family === "werewolves") {
    const balance = getRoleBalanceScore(distribution);
    const werewolves = distribution.werewolf ?? 0;
    const vampires = distribution.vampire ?? 0;
    const villagers = distribution.ordinary_villager ?? 0;

    if (Math.abs(balance) > 3) {
      warnings.push(
        balance < 0
          ? "Балансът е силно в полза на Върколаците или Вампирите."
          : "Балансът е силно в полза на Селяните.",
      );
    }
    if (werewolves === 0 && vampires === 0) {
      warnings.push("Липсва основна заплаха: добави Върколаци или Вампири.");
    }
    if (werewolves > 0 && werewolves < 2 && playerCount >= 6) {
      warnings.push("Стандартна игра с Върколаци трябва да има няколко Върколака.");
    }
    if (villagers < 2) {
      warnings.push("Стандартна игра трябва да има няколко Селяни.");
    }
    if ((distribution.seer ?? 0) === 0 && (distribution.oracle ?? 0) === 0) {
      warnings.push("Добави Оракул или Гадателка.");
    }
    if ((distribution.red_riding_hood ?? 0) > 0 && (distribution.hunter ?? 0) === 0) {
      warnings.push("Червена шапчица може да се включи само ако Ловецът също е в играта.");
    }
    if ((distribution.priest ?? 0) > 0) {
      for (const dependency of ["blacksmith", "vampire_hunter", "witch"] as const) {
        if ((distribution[dependency] ?? 0) === 0) {
          warnings.push(`Свещеникът изисква ${getRoleNameBg(dependency)}.`);
        }
      }
    }
    if ((distribution.drunk ?? 0) > 0) {
      warnings.push("Пияницата е разширена роля и е препоръчителна за по-опитни играчи.");
    }
    if (werewolves > 0 && vampires > 0 && (werewolves < 3 || vampires < 3)) {
      warnings.push("При едновременни Върколаци и Вампири трябва да има поне 3 Върколака и 3 Вампира.");
    }
    if ((distribution.guard_dog ?? 0) > 0 && ((distribution.mayor ?? 0) === 0 || options.mayorMode !== "public_vote")) {
      warnings.push("Куче пазач може да се използва само с публично избран Кмет.");
    }
    if ((distribution.stray_cat ?? 0) > 0) {
      warnings.push("Улична котка е промо роля. Включвай я само в разширен режим.");
    }
  } else {
    const mafiaCount = (distribution.mafioso ?? 0) + (distribution.don ?? 0);
    if (mafiaCount === 0) {
      warnings.push("Липсва Мафия.");
    }
    if ((distribution.commissioner ?? 0) === 0 && mafiaCount > 0) {
      warnings.push("Липсва Комисар.");
    }
    if (evilCount < Math.max(1, Math.floor(playerCount / 5))) {
      warnings.push("Мафията вероятно е твърде слаба.");
    }
    if (evilCount > Math.ceil(playerCount / 3)) {
      warnings.push("Мафията вероятно е твърде силна.");
    }
  }

  if ((distribution.thief ?? 0) > 0 && playerCount < 13) {
    warnings.push("Крадецът е разширена роля и е по-подходящ за 13+ играчи.");
  }

  return warnings;
}

export function createDefaultGameConfig(mode: GameMode, playerCount: number): GameConfig {
  const family = getGameFamily(mode);
  const rolePreset: RolePreset = mode === "mafia_sport" ? "sport" : mode === "mafia_free" ? "free" : "classic";
  const tempoProfile: TempoProfile = mode === "mafia_sport" ? "sport_mafia" : "normal_online";
  const roles =
    mode === "mafia_sport"
      ? getMafiaSportPreset(playerCount)
      : mode === "mafia_free"
        ? getMafiaFreePreset(playerCount)
        : getWerewolfPresetByRolePreset(playerCount, rolePreset);

  return {
    mode,
    roomName: family === "mafia" ? "Частна маса" : "Частно село",
    rolePreset,
    playerCount,
    maxPlayers: playerCount,
    roomVisibility: "private",
    roles,
    mayorEnabled: family === "werewolves",
    narratorMode: "automatic",
    communicationMode: "built_in_chat",
    tempoProfile,
    timers: TEMPO_PRESETS[tempoProfile],
    revealRolesOnDeath: true,
    tieBreaker: family === "mafia" ? "revote" : "no_elimination",
    allowSkipVote: true,
    majorityMode: "simple",
    autoStart: false,
    beginnerMode: false,
    advancedMode: false,
    liveMode: false,
    firstNightKill: playerCount >= 8,
    loversEnabled: false,
    werewolfVariant: "werewolves_vs_village",
    mayorMode: "secret_role",
    promoRolesEnabled: false,
    mafiaNightKill: true,
    doctorCanSelfProtect: false,
    commissionerResultMode: "team_only",
    maniacEnabled: false,
    jesterEnabled: false,
    narratorVoice: "classic",
    rulesetVersion: DEFAULT_RULESET_VERSION,
  };
}

export function createGameConfigFromOptions(options: GameConfigOptions = {}): GameConfig {
  const mode = options.mode ?? "werewolves_classic";
  const playerCount = options.playerCount ?? (mode === "mafia_sport" ? 10 : 8);
  const config = createDefaultGameConfig(mode, playerCount);

  const tempoProfile = options.tempoProfile ?? config.tempoProfile;
  const loversEnabled = options.loversEnabled ?? config.loversEnabled;
  const rolePreset = options.roles ? "manual" : options.rolePreset ?? config.rolePreset;
  const roles = options.roles
    ? normalizeRoleDistributionForMode(mode, options.roles)
    : mode === "werewolves_classic"
      ? withOptionalCupid(getWerewolfPresetByRolePreset(playerCount, rolePreset), loversEnabled, playerCount)
      : mode === "mafia_free"
        ? withOptionalMafiaVariants(config.roles, {
            playerCount,
            maniacEnabled: options.maniacEnabled ?? config.maniacEnabled,
            jesterEnabled: options.jesterEnabled ?? config.jesterEnabled,
          })
        : config.roles;

  return {
    ...config,
    roomName: options.roomName ?? config.roomName,
    rolePreset,
    maxPlayers: options.maxPlayers ?? config.maxPlayers,
    roomVisibility: options.roomVisibility ?? config.roomVisibility,
    roles,
    narratorMode: options.narratorMode ?? config.narratorMode,
    communicationMode: options.communicationMode ?? config.communicationMode,
    tempoProfile,
    timers: TEMPO_PRESETS[tempoProfile],
    liveMode: tempoProfile === "live",
    loversEnabled,
    revealRolesOnDeath: options.revealRolesOnDeath ?? config.revealRolesOnDeath,
    tieBreaker: options.tieBreaker ?? config.tieBreaker,
    allowSkipVote: options.allowSkipVote ?? config.allowSkipVote,
    majorityMode: options.majorityMode ?? config.majorityMode,
    autoStart: options.autoStart ?? config.autoStart,
    beginnerMode: options.beginnerMode ?? (rolePreset === "beginner"),
    advancedMode: options.advancedMode ?? (rolePreset === "advanced" || rolePreset === "wolves_vampires"),
    werewolfVariant: options.werewolfVariant ?? (rolePreset === "wolves_vampires" ? "three_teams" : config.werewolfVariant),
    mayorMode: options.mayorMode ?? config.mayorMode,
    promoRolesEnabled: options.promoRolesEnabled ?? config.promoRolesEnabled,
    mafiaNightKill: options.mafiaNightKill ?? config.mafiaNightKill,
    doctorCanSelfProtect: options.doctorCanSelfProtect ?? config.doctorCanSelfProtect,
    commissionerResultMode: options.commissionerResultMode ?? config.commissionerResultMode,
    maniacEnabled: options.maniacEnabled ?? config.maniacEnabled,
    jesterEnabled: options.jesterEnabled ?? config.jesterEnabled,
    narratorVoice: options.narratorVoice ?? config.narratorVoice,
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

export function normalizeRoleDistributionForMode(mode: GameMode, distribution: RoleDistribution): RoleDistribution {
  const normalized = normalizeRoleDistribution(distribution);
  const family = getGameFamily(mode);
  const invalidRoles = (Object.keys(normalized) as RoleCode[]).filter((role) => !isRoleAvailableInFamily(role, family));

  if (invalidRoles.length > 0) {
    const roleNames = invalidRoles.map((role) => getRoleNameBg(role)).join(", ");
    throw new Error(`Тези роли не са налични за ${getGameModeNameBg(mode)}: ${roleNames}.`);
  }

  return normalized;
}

function withOptionalCupid(distribution: RoleDistribution, loversEnabled: boolean, playerCount: number): RoleDistribution {
  const preset = { ...distribution };
  if (!loversEnabled || playerCount < 9 || (preset.cupid ?? 0) > 0) {
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

function withOptionalMafiaVariants(
  distribution: RoleDistribution,
  options: { playerCount: number; maniacEnabled: boolean; jesterEnabled: boolean },
): RoleDistribution {
  let preset = { ...distribution };
  if (options.maniacEnabled && options.playerCount >= 10 && (preset.maniac ?? 0) === 0) {
    preset = replaceOneCivilian(preset, "maniac");
  }
  if (options.jesterEnabled && options.playerCount >= 8 && (preset.jester ?? 0) === 0) {
    preset = replaceOneCivilian(preset, "jester");
  }
  return normalizeRoleDistribution(preset);
}

function replaceOneCivilian(distribution: RoleDistribution, role: RoleCode): RoleDistribution {
  const civilians = distribution.civilian ?? 0;
  if (civilians <= 0) {
    return distribution;
  }

  return {
    ...distribution,
    civilian: civilians - 1,
    [role]: (distribution[role] ?? 0) + 1,
  };
}

function roleValueBg(role: RoleCode): number {
  return ROLE_VALUES[role] ?? 0;
}

const ROLE_VALUES: Partial<Record<RoleCode, number>> = {
  ordinary_villager: 1,
  healer: 3,
  witch: 5,
  seer: 7,
  hunter: 3,
  red_riding_hood: 3,
  cupid: -2,
  mayor: 2,
  oracle: 7,
  priest: 3,
  cook: 4,
  blacksmith: 2,
  insomniac: 3,
  vampire_hunter: 3,
  investigator: 3,
  werewolf: -6,
  vampire: -6,
  drunk: -2,
  stray_cat: 6,
  guard_dog: 2,
};
