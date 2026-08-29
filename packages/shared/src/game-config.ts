import { getRoleNameBg, isRoleAvailableInFamily, ROLE_DEFINITIONS, type RoleCode } from "./roles.js";
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
  customTimers?: Partial<PhaseTimers>;
  loversEnabled?: boolean;
  revealRolesOnDeath?: boolean;
  tieBreaker?: TieBreaker;
  firstNightKill?: boolean;
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
  enforceRoleCompatibility?: boolean;
}

export interface RoleValidationOptions {
  mayorMode?: MayorMode;
  werewolfVariant?: WerewolfVariant;
  promoRolesEnabled?: boolean;
}

export type RoleValidationCode =
  | "ROLE_COUNT_MISMATCH"
  | "ROLE_WRONG_FAMILY"
  | "ROLE_MAX_COPIES_EXCEEDED"
  | "BALANCE_STRONG_EVIL"
  | "BALANCE_STRONG_GOOD"
  | "THREAT_MISSING"
  | "WEREWOLVES_TOO_FEW"
  | "VILLAGERS_TOO_FEW"
  | "INVESTIGATOR_MISSING"
  | "ROLE_DEPENDENCY_MISSING"
  | "DUAL_FACTION_MINIMUM"
  | "MAYOR_MODE_REQUIRED"
  | "ADVANCED_ROLE_NOTICE"
  | "MAFIA_MISSING"
  | "COMMISSIONER_MISSING"
  | "EVIL_TOO_WEAK"
  | "EVIL_TOO_STRONG"
  | "PLAYER_COUNT_RECOMMENDED";

export type RoleValidationIssue = {
  code: RoleValidationCode;
  messageBg: string;
};

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
    shortBg: "Градска мистерия с гъвкав брой играчи и роли по избор.",
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

type NumericTimerKey = Exclude<keyof PhaseTimers, "autoAdvanceWhenReady">;

const PHASE_TIMER_LIMITS: Record<NumericTimerKey, { min: number; max: number }> = {
  roleRevealSeconds: { min: 5, max: 120 },
  personalNightActionSeconds: { min: 10, max: 300 },
  factionNightActionSeconds: { min: 10, max: 300 },
  dayDiscussionSeconds: { min: 0, max: 900 },
  playerSpeechSeconds: { min: 15, max: 240 },
  voteSeconds: { min: 10, max: 240 },
  resolutionSeconds: { min: 5, max: 90 },
  minimumPhaseSeconds: { min: 3, max: 30 },
};

export function normalizePhaseTimers(
  timers: Partial<PhaseTimers> | undefined,
  base: PhaseTimers = TEMPO_PRESETS.manual,
  tempoProfile: TempoProfile = "manual",
): PhaseTimers {
  const nightActionSeconds = timers?.factionNightActionSeconds;
  const allowAutoAdvanceOverride = tempoProfile === "manual";
  return {
    roleRevealSeconds: clampTimer("roleRevealSeconds", timers?.roleRevealSeconds, base.roleRevealSeconds),
    personalNightActionSeconds: clampTimer(
      "personalNightActionSeconds",
      timers?.personalNightActionSeconds ?? nightActionSeconds,
      base.personalNightActionSeconds,
    ),
    factionNightActionSeconds: clampTimer(
      "factionNightActionSeconds",
      timers?.factionNightActionSeconds,
      base.factionNightActionSeconds,
    ),
    dayDiscussionSeconds: clampTimer("dayDiscussionSeconds", timers?.dayDiscussionSeconds, base.dayDiscussionSeconds),
    playerSpeechSeconds: clampTimer("playerSpeechSeconds", timers?.playerSpeechSeconds, base.playerSpeechSeconds),
    voteSeconds: clampTimer("voteSeconds", timers?.voteSeconds, base.voteSeconds),
    resolutionSeconds: clampTimer("resolutionSeconds", timers?.resolutionSeconds, base.resolutionSeconds),
    minimumPhaseSeconds: clampTimer("minimumPhaseSeconds", timers?.minimumPhaseSeconds, base.minimumPhaseSeconds),
    autoAdvanceWhenReady:
      allowAutoAdvanceOverride && typeof timers?.autoAdvanceWhenReady === "boolean"
        ? timers.autoAdvanceWhenReady
        : base.autoAdvanceWhenReady,
  };
}

export function resolvePhaseTimers(
  tempoProfile: TempoProfile,
  customTimers?: Partial<PhaseTimers>,
): PhaseTimers {
  return tempoProfile === "manual"
    ? normalizePhaseTimers(customTimers, TEMPO_PRESETS.manual, tempoProfile)
    : normalizePhaseTimers(undefined, TEMPO_PRESETS[tempoProfile], tempoProfile);
}

function clampTimer(key: NumericTimerKey, value: number | undefined, fallback: number) {
  const limits = PHASE_TIMER_LIMITS[key];
  const safeValue = Number.isFinite(value) ? Number(value) : fallback;
  return Math.min(limits.max, Math.max(limits.min, Math.round(safeValue)));
}

const GAME_MODES = ["mafia_sport", "mafia_free", "werewolves_classic"] as const satisfies readonly GameMode[];
const ROLE_PRESETS = [
  "sport",
  "free",
  "beginner",
  "classic",
  "advanced",
  "wolves_vampires",
  "classic_clean",
  "mvp",
  "manual",
] as const satisfies readonly RolePreset[];
const NARRATOR_MODES = ["automatic", "honest_human", "full_human"] as const satisfies readonly NarratorMode[];
const ROOM_VISIBILITIES = ["private", "public"] as const satisfies readonly RoomVisibility[];
const COMMUNICATION_MODES = ["built_in_chat", "no_chat", "system_only", "secret_channels"] as const satisfies readonly CommunicationMode[];
const TEMPO_PROFILES = ["fast_online", "normal_online", "live", "sport_mafia", "manual"] as const satisfies readonly TempoProfile[];
const TIE_BREAKERS = ["no_elimination", "revote"] as const satisfies readonly TieBreaker[];
const MAJORITY_MODES = ["simple", "absolute"] as const satisfies readonly MajorityMode[];
const WEREWOLF_VARIANTS = ["werewolves_vs_village", "vampires_vs_village", "three_teams"] as const satisfies readonly WerewolfVariant[];
const MAYOR_MODES = ["secret_role", "public_vote"] as const satisfies readonly MayorMode[];
const COMMISSIONER_RESULT_MODES = ["team_only", "exact_role"] as const satisfies readonly CommissionerResultMode[];
const NARRATOR_VOICES = ["classic", "old_villager", "inspector", "witch"] as const satisfies readonly NarratorVoice[];
const BOOLEAN_GAME_CONFIG_KEYS = [
  "loversEnabled",
  "revealRolesOnDeath",
  "firstNightKill",
  "allowSkipVote",
  "autoStart",
  "beginnerMode",
  "advancedMode",
  "promoRolesEnabled",
  "mafiaNightKill",
  "doctorCanSelfProtect",
  "maniacEnabled",
  "jesterEnabled",
  "enforceRoleCompatibility",
] as const satisfies readonly (keyof GameConfigOptions)[];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readAllowedString<T extends string>(
  options: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  messageBg: string,
): T | undefined {
  const value = options[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(messageBg);
  }
  return value as T;
}

function sanitizeRoleDistribution(value: unknown): RoleDistribution {
  if (!isPlainRecord(value)) {
    throw new Error("Невалидно разпределение на ролите.");
  }

  const roles: RoleDistribution = {};
  for (const [role, count] of Object.entries(value)) {
    if (
      !Object.hasOwn(ROLE_DEFINITIONS, role)
      || typeof count !== "number"
      || !Number.isFinite(count)
      || !Number.isInteger(count)
      || count < 0
    ) {
      throw new Error("Невалидно разпределение на ролите.");
    }
    roles[role as RoleCode] = count;
  }
  return roles;
}

function sanitizeCustomTimers(value: unknown): Partial<PhaseTimers> {
  if (!isPlainRecord(value)) {
    throw new Error("Невалидни настройки на таймерите.");
  }

  const timers: Partial<PhaseTimers> = {};
  for (const [key, timerValue] of Object.entries(value)) {
    if (key === "autoAdvanceWhenReady") {
      if (typeof timerValue !== "boolean") {
        throw new Error("Невалидни настройки на таймерите.");
      }
      timers.autoAdvanceWhenReady = timerValue;
      continue;
    }
    if (!Object.hasOwn(PHASE_TIMER_LIMITS, key) || typeof timerValue !== "number" || !Number.isFinite(timerValue)) {
      throw new Error("Невалидни настройки на таймерите.");
    }
    timers[key as NumericTimerKey] = timerValue;
  }
  return timers;
}

function sanitizeGameConfigOptions(value: unknown): GameConfigOptions {
  if (!isPlainRecord(value)) {
    throw new Error("Невалидни настройки на стаята.");
  }

  // Room creation also carries transport/auth metadata, so only copy authoritative config fields.
  const sanitized: GameConfigOptions = {};
  const mode = readAllowedString(value, "mode", GAME_MODES, "Невалиден режим на игра.");
  const roomVisibility = readAllowedString(value, "roomVisibility", ROOM_VISIBILITIES, "Невалидна видимост на стаята.");
  const rolePreset = readAllowedString(value, "rolePreset", ROLE_PRESETS, "Невалидно готово разпределение на ролите.");
  const narratorMode = readAllowedString(value, "narratorMode", NARRATOR_MODES, "Невалиден режим на Разказвач.");
  const communicationMode = readAllowedString(value, "communicationMode", COMMUNICATION_MODES, "Невалиден режим на комуникация.");
  const tempoProfile = readAllowedString(value, "tempoProfile", TEMPO_PROFILES, "Невалиден профил на темпото.");
  const tieBreaker = readAllowedString(value, "tieBreaker", TIE_BREAKERS, "Невалидно правило при равенство.");
  const majorityMode = readAllowedString(value, "majorityMode", MAJORITY_MODES, "Невалидно правило за мнозинство.");
  const werewolfVariant = readAllowedString(value, "werewolfVariant", WEREWOLF_VARIANTS, "Невалиден вариант на играта.");
  const mayorMode = readAllowedString(value, "mayorMode", MAYOR_MODES, "Невалиден режим за Кмет.");
  const commissionerResultMode = readAllowedString(value, "commissionerResultMode", COMMISSIONER_RESULT_MODES, "Невалиден резултат за Комисаря.");
  const narratorVoice = readAllowedString(value, "narratorVoice", NARRATOR_VOICES, "Невалиден глас на Разказвача.");

  if (narratorMode === "honest_human" || narratorMode === "full_human") {
    throw new Error("Човешкият Разказвач не е достъпен в бета версията. Избери Автоматичен Разказвач.");
  }

  Object.assign(sanitized, {
    ...(mode === undefined ? {} : { mode }),
    ...(roomVisibility === undefined ? {} : { roomVisibility }),
    ...(rolePreset === undefined ? {} : { rolePreset }),
    ...(narratorMode === undefined ? {} : { narratorMode }),
    ...(communicationMode === undefined ? {} : { communicationMode }),
    ...(tempoProfile === undefined ? {} : { tempoProfile }),
    ...(tieBreaker === undefined ? {} : { tieBreaker }),
    ...(majorityMode === undefined ? {} : { majorityMode }),
    ...(werewolfVariant === undefined ? {} : { werewolfVariant }),
    ...(mayorMode === undefined ? {} : { mayorMode }),
    ...(commissionerResultMode === undefined ? {} : { commissionerResultMode }),
    ...(narratorVoice === undefined ? {} : { narratorVoice }),
  });

  if (value.playerCount !== undefined) {
    if (typeof value.playerCount !== "number" || !Number.isFinite(value.playerCount) || !Number.isInteger(value.playerCount)) {
      throw new Error("Броят играчи трябва да е цяло число.");
    }
    if (value.playerCount > 30) {
      throw new Error("Играта поддържа най-много 30 играчи.");
    }
    if (value.playerCount < 1) {
      throw new Error("Броят играчи трябва да е между 1 и 30.");
    }
    sanitized.playerCount = value.playerCount;
  }

  if (value.maxPlayers !== undefined) {
    if (
      typeof value.maxPlayers !== "number"
      || !Number.isFinite(value.maxPlayers)
      || !Number.isInteger(value.maxPlayers)
      || value.maxPlayers < 1
      || value.maxPlayers > 30
    ) {
      throw new Error("Максималният брой играчи трябва да е цяло число между 1 и 30.");
    }
    sanitized.maxPlayers = value.maxPlayers;
  }

  if (value.roomName !== undefined) {
    if (typeof value.roomName !== "string") {
      throw new Error("Невалидно име на стаята.");
    }
    const roomName = value.roomName.trim();
    if (roomName.length === 0 || roomName.length > 42) {
      throw new Error("Името на стаята трябва да е между 1 и 42 знака.");
    }
    sanitized.roomName = roomName;
  }

  if (value.roles !== undefined) {
    sanitized.roles = sanitizeRoleDistribution(value.roles);
  }
  if (value.customTimers !== undefined) {
    sanitized.customTimers = sanitizeCustomTimers(value.customTimers);
  }

  const mutableSanitized = sanitized as unknown as Record<string, unknown>;
  for (const key of BOOLEAN_GAME_CONFIG_KEYS) {
    const optionValue = value[key];
    if (optionValue === undefined) {
      continue;
    }
    if (typeof optionValue !== "boolean") {
      throw new Error("Невалидна стойност за настройка на стаята.");
    }
    mutableSanitized[key] = optionValue;
  }

  return sanitized;
}

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

  const werewolves = Math.min(
    ROLE_DEFINITIONS.werewolf.maxCopies,
    playerCount <= 22 ? 5 : playerCount <= 28 ? 6 : 7,
  );
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
  return validateRoleDistributionIssuesForMode(mode, playerCount, distribution, options).map((issue) => issue.messageBg);
}

export function validateRoleDistributionIssuesForMode(
  mode: GameMode,
  playerCount: number,
  distribution: RoleDistribution,
  options: RoleValidationOptions = {},
): RoleValidationIssue[] {
  const warnings: RoleValidationIssue[] = [];
  const push = (code: RoleValidationCode, messageBg: string) => warnings.push({ code, messageBg });
  const family = getGameFamily(mode);
  const total = countRoles(distribution);
  const evilCount =
    (distribution.mafioso ?? 0) +
    (distribution.don ?? 0) +
    (distribution.werewolf ?? 0) +
    (distribution.vampire ?? 0) +
    (distribution.maniac ?? 0);

  if (total !== playerCount) {
    push("ROLE_COUNT_MISMATCH", `Броят роли (${total}) не съвпада с броя играчи (${playerCount}).`);
  }

  for (const role of Object.keys(distribution) as RoleCode[]) {
    const count = distribution[role] ?? 0;
    const maxCopies = ROLE_DEFINITIONS[role]?.maxCopies;
    if (typeof maxCopies === "number" && count > maxCopies) {
      push(
        "ROLE_MAX_COPIES_EXCEEDED",
        `${getRoleNameBg(role)} може да участва най-много ${maxCopies} ${maxCopies === 1 ? "път" : "пъти"}.`,
      );
    }
    if (!isRoleAvailableInFamily(role, family)) {
      push("ROLE_WRONG_FAMILY", `${getRoleNameBg(role)} не принадлежи към тази игра.`);
    }
  }

  if (family === "werewolves") {
    const balance = getRoleBalanceScore(distribution);
    const werewolves = distribution.werewolf ?? 0;
    const vampires = distribution.vampire ?? 0;
    const villagers = distribution.ordinary_villager ?? 0;

    if (Math.abs(balance) > 3) {
      push(
        balance < 0 ? "BALANCE_STRONG_EVIL" : "BALANCE_STRONG_GOOD",
        balance < 0 ? "Балансът е силно в полза на Върколаците или Вампирите." : "Балансът е силно в полза на Селяните.",
      );
    }
    if (werewolves === 0 && vampires === 0) {
      push("THREAT_MISSING", "Липсва основна заплаха: добави Върколаци или Вампири.");
    }
    if (werewolves > 0 && werewolves < 2 && playerCount >= 6) {
      push("WEREWOLVES_TOO_FEW", "Стандартна игра с Върколаци трябва да има няколко Върколака.");
    }
    if (villagers < 2) {
      push("VILLAGERS_TOO_FEW", "Стандартна игра трябва да има няколко Селяни.");
    }
    if ((distribution.seer ?? 0) === 0 && (distribution.oracle ?? 0) === 0) {
      push("INVESTIGATOR_MISSING", "Добави Оракул или Гадателка.");
    }
    if ((distribution.red_riding_hood ?? 0) > 0 && (distribution.hunter ?? 0) === 0) {
      push("ROLE_DEPENDENCY_MISSING", "Червена шапчица може да се включи само ако Ловецът също е в играта.");
    }
    if ((distribution.priest ?? 0) > 0) {
      for (const dependency of ["blacksmith", "vampire_hunter", "witch"] as const) {
        if ((distribution[dependency] ?? 0) === 0) {
          push("ROLE_DEPENDENCY_MISSING", `Свещеникът изисква ${getRoleNameBg(dependency)}.`);
        }
      }
    }
    if ((distribution.drunk ?? 0) > 0) {
      push("ADVANCED_ROLE_NOTICE", "Пияницата е разширена роля и е препоръчителна за по-опитни играчи.");
    }
    if (werewolves > 0 && vampires > 0 && (werewolves < 3 || vampires < 3)) {
      push("DUAL_FACTION_MINIMUM", "При едновременни Върколаци и Вампири трябва да има поне 3 Върколака и 3 Вампира.");
    }
    if ((distribution.guard_dog ?? 0) > 0 && ((distribution.mayor ?? 0) === 0 || options.mayorMode !== "public_vote")) {
      push("MAYOR_MODE_REQUIRED", "Куче пазач може да се използва само с публично избран Кмет.");
    }
    if ((distribution.stray_cat ?? 0) > 0) {
      push("ADVANCED_ROLE_NOTICE", "Улична котка е промо роля. Включвай я само в разширен режим.");
    }
  } else {
    const mafiaCount = (distribution.mafioso ?? 0) + (distribution.don ?? 0);
    if (mafiaCount === 0) {
      push("MAFIA_MISSING", "Липсва Мафия.");
    }
    if ((distribution.commissioner ?? 0) === 0 && mafiaCount > 0) {
      push("COMMISSIONER_MISSING", "Липсва Комисар.");
    }
    if (evilCount < Math.max(1, Math.floor(playerCount / 5))) {
      push("EVIL_TOO_WEAK", "Мафията вероятно е твърде слаба.");
    }
    if (evilCount > Math.ceil(playerCount / 3)) {
      push("EVIL_TOO_STRONG", "Мафията вероятно е твърде силна.");
    }
  }

  if ((distribution.thief ?? 0) > 0 && playerCount < 13) {
    push("PLAYER_COUNT_RECOMMENDED", "Крадецът е разширена роля и е по-подходящ за 13+ играчи.");
  }

  return warnings;
}

const HARD_ROLE_COMPATIBILITY_CODES = new Set<RoleValidationCode>([
  "ROLE_DEPENDENCY_MISSING",
  "DUAL_FACTION_MINIMUM",
  "MAYOR_MODE_REQUIRED",
]);

export function assertRoleCompatibilityForMode(
  mode: GameMode,
  playerCount: number,
  distribution: RoleDistribution,
  options: RoleValidationOptions = {},
): void {
  const issue = validateRoleDistributionIssuesForMode(mode, playerCount, distribution, options)
    .find((candidate) => HARD_ROLE_COMPATIBILITY_CODES.has(candidate.code));
  if (issue) {
    throw new Error(issue.messageBg);
  }
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
    allowSkipVote: mode !== "mafia_sport",
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

export function createGameConfigFromOptions(rawOptions: GameConfigOptions = {}): GameConfig {
  const options = sanitizeGameConfigOptions(rawOptions);
  const mode = options.mode ?? "werewolves_classic";
  const playerCount = options.playerCount ?? (mode === "mafia_sport" ? 10 : 8);
  const config = createDefaultGameConfig(mode, playerCount);

  const tempoProfile = mode === "mafia_sport" ? "sport_mafia" : options.tempoProfile ?? config.tempoProfile;
  const timers = resolvePhaseTimers(tempoProfile, options.customTimers);
  const requestedLoversEnabled = options.loversEnabled ?? config.loversEnabled;
  const requestedMaxPlayers = Number.isFinite(options.maxPlayers)
    ? Math.floor(options.maxPlayers as number)
    : config.maxPlayers;
  const rolePreset = options.roles ? "manual" : options.rolePreset ?? config.rolePreset;
  const roles = options.roles
    ? normalizeRoleDistributionForMode(mode, options.roles)
    : mode === "werewolves_classic"
      ? withOptionalWerewolfVariants(getWerewolfPresetByRolePreset(playerCount, rolePreset), {
          playerCount,
          loversEnabled: requestedLoversEnabled,
          jesterEnabled: options.jesterEnabled ?? config.jesterEnabled,
        })
      : mode === "mafia_free"
        ? withOptionalMafiaVariants(config.roles, {
            playerCount,
            maniacEnabled: options.maniacEnabled ?? config.maniacEnabled,
            jesterEnabled: options.jesterEnabled ?? config.jesterEnabled,
          })
        : config.roles;
  const loversEnabled = (roles.cupid ?? 0) > 0;

  const createdConfig: GameConfig = {
    ...config,
    roomName: options.roomName ?? config.roomName,
    rolePreset,
    maxPlayers:
      mode === "mafia_sport"
        ? playerCount
        : Math.max(playerCount, Math.min(30, requestedMaxPlayers)),
    roomVisibility: options.roomVisibility ?? config.roomVisibility,
    roles,
    narratorMode: options.narratorMode ?? config.narratorMode,
    communicationMode: options.communicationMode ?? config.communicationMode,
    tempoProfile,
    timers,
    liveMode: tempoProfile === "live",
    loversEnabled,
    revealRolesOnDeath: options.revealRolesOnDeath ?? config.revealRolesOnDeath,
    tieBreaker: options.tieBreaker ?? config.tieBreaker,
    firstNightKill: options.firstNightKill ?? config.firstNightKill,
    allowSkipVote: mode === "mafia_sport" ? false : options.allowSkipVote ?? config.allowSkipVote,
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

  if (options.enforceRoleCompatibility) {
    assertRoleCompatibilityForMode(mode, playerCount, roles, {
      mayorMode: createdConfig.mayorMode,
      werewolfVariant: createdConfig.werewolfVariant,
      promoRolesEnabled: createdConfig.promoRolesEnabled,
    });
  }

  return createdConfig;
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
  const unknownRoles = Object.keys(normalized).filter((role) => !(role in ROLE_DEFINITIONS));
  if (unknownRoles.length > 0) {
    throw new Error(`Непознати роли: ${unknownRoles.join(", ")}.`);
  }

  const overLimitRoles = (Object.keys(normalized) as RoleCode[]).filter(
    (role) => (normalized[role] ?? 0) > ROLE_DEFINITIONS[role].maxCopies,
  );
  if (overLimitRoles.length > 0) {
    const limits = overLimitRoles
      .map((role) => `${getRoleNameBg(role)} (максимум ${ROLE_DEFINITIONS[role].maxCopies})`)
      .join(", ");
    throw new Error(`Превишен е максималният брой копия: ${limits}.`);
  }
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

function withOptionalWerewolfVariants(
  distribution: RoleDistribution,
  options: { playerCount: number; loversEnabled: boolean; jesterEnabled: boolean },
): RoleDistribution {
  let preset = withOptionalCupid(distribution, options.loversEnabled, options.playerCount);
  if (options.jesterEnabled && options.playerCount >= 8 && (preset.jester ?? 0) === 0) {
    preset = replaceOneRole(preset, "ordinary_villager", "jester");
  }
  return normalizeRoleDistribution(preset);
}

function withOptionalMafiaVariants(
  distribution: RoleDistribution,
  options: { playerCount: number; maniacEnabled: boolean; jesterEnabled: boolean },
): RoleDistribution {
  let preset = { ...distribution };
  if (options.maniacEnabled && options.playerCount >= 10 && (preset.maniac ?? 0) === 0) {
    preset = replaceOneRole(preset, "civilian", "maniac");
  }
  if (options.jesterEnabled && options.playerCount >= 8 && (preset.jester ?? 0) === 0) {
    preset = replaceOneRole(preset, "civilian", "jester");
  }
  return normalizeRoleDistribution(preset);
}

function replaceOneRole(
  distribution: RoleDistribution,
  baselineRole: RoleCode,
  replacementRole: RoleCode,
): RoleDistribution {
  const baselineCount = distribution[baselineRole] ?? 0;
  if (baselineCount <= 0) {
    return distribution;
  }

  return {
    ...distribution,
    [baselineRole]: baselineCount - 1,
    [replacementRole]: (distribution[replacementRole] ?? 0) + 1,
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
