import type {
  CommunicationMode,
  CreateRoomOptions,
  GameMode,
  MajorityMode,
  MayorMode,
  NarratorMode,
  NarratorVoice,
  PhaseTimers,
  RoleCode,
  RoleDistribution,
  RolePreset,
  RoomVisibility,
  TempoProfile,
  WerewolfVariant,
  CommissionerResultMode,
} from "@werewolf/shared";
import { GAME_MODE_DEFINITIONS, ROLE_DEFINITIONS } from "@werewolf/shared";
import { ROOM_TIMER_QUERY_KEYS } from "@/lib/room-options-query";
export { roomOptionsToQuery, stringifyRolesParam } from "@/lib/room-options-query";

export type RoomSearchParams = Record<string, string | string[] | undefined>;

const GAME_MODES = Object.keys(GAME_MODE_DEFINITIONS) as GameMode[];
const COMMUNICATION_MODES: CommunicationMode[] = ["built_in_chat", "no_chat", "system_only", "secret_channels"];
const NARRATOR_MODES: NarratorMode[] = ["automatic", "honest_human", "full_human"];
const TEMPO_PROFILES: TempoProfile[] = ["fast_online", "normal_online", "live", "sport_mafia", "manual"];
const ROLE_PRESETS: RolePreset[] = ["sport", "free", "beginner", "classic", "advanced", "wolves_vampires", "classic_clean", "mvp", "manual"];
const ROOM_VISIBILITIES: RoomVisibility[] = ["private", "public"];
const MAJORITY_MODES: MajorityMode[] = ["simple", "absolute"];
const WEREWOLF_VARIANTS: WerewolfVariant[] = ["werewolves_vs_village", "vampires_vs_village", "three_teams"];
const MAYOR_MODES: MayorMode[] = ["secret_role", "public_vote"];
const COMMISSIONER_RESULT_MODES: CommissionerResultMode[] = ["team_only", "exact_role"];
const NARRATOR_VOICES: NarratorVoice[] = ["classic", "old_villager", "inspector", "witch"];

export function parseRoomCreateOptions(searchParams: RoomSearchParams = {}): CreateRoomOptions {
  const mode = first(searchParams.mode);
  const communication = first(searchParams.communication);
  const narrator = first(searchParams.narrator);
  const tempo = first(searchParams.tempo);
  const preset = first(searchParams.preset);
  const visibility = first(searchParams.visibility);
  const majority = first(searchParams.majority);
  const tieBreaker = first(searchParams.tieBreaker);
  const variant = first(searchParams.variant);
  const mayorMode = first(searchParams.mayorMode);
  const commissionerResult = first(searchParams.commissionerResult);
  const narratorVoice = first(searchParams.narratorVoice);
  const roomName = first(searchParams.roomName);
  const roles = parseRolesParam(first(searchParams.roles));
  const customTimers = parseCustomTimers(searchParams);
  const tempoProfile = isOneOf(tempo, TEMPO_PROFILES) ? tempo : customTimers ? "manual" : undefined;
  const players = Number(first(searchParams.players));
  const maxPlayers = Number(first(searchParams.maxPlayers));

  return {
    ...(isOneOf(mode, GAME_MODES) ? { mode } : {}),
    ...(typeof roomName === "string" ? { roomName } : {}),
    ...(Number.isFinite(players) ? { playerCount: players } : {}),
    ...(Number.isFinite(maxPlayers) ? { maxPlayers } : {}),
    ...(isOneOf(visibility, ROOM_VISIBILITIES) ? { roomVisibility: visibility } : {}),
    ...(isOneOf(preset, ROLE_PRESETS) ? { rolePreset: preset } : {}),
    ...(isOneOf(communication, COMMUNICATION_MODES) ? { communicationMode: communication } : {}),
    ...(isOneOf(narrator, NARRATOR_MODES) ? { narratorMode: narrator } : {}),
    ...(tempoProfile ? { tempoProfile } : {}),
    ...(customTimers ? { customTimers } : {}),
    ...(isBooleanParam(searchParams.lovers) ? { loversEnabled: first(searchParams.lovers) === "1" } : {}),
    ...(first(searchParams.reveal) ? { revealRolesOnDeath: first(searchParams.reveal) !== "0" } : {}),
    ...(first(searchParams.skip) ? { allowSkipVote: first(searchParams.skip) !== "0" } : {}),
    ...(isOneOf(majority, MAJORITY_MODES) ? { majorityMode: majority } : {}),
    ...(tieBreaker === "revote" || tieBreaker === "no_elimination" ? { tieBreaker } : {}),
    ...(isBooleanParam(searchParams.firstNightKill) ? { firstNightKill: first(searchParams.firstNightKill) === "1" } : {}),
    ...(isBooleanParam(searchParams.autoStart) ? { autoStart: first(searchParams.autoStart) === "1" } : {}),
    ...(isBooleanParam(searchParams.beginner) ? { beginnerMode: first(searchParams.beginner) === "1" } : {}),
    ...(isBooleanParam(searchParams.advanced) ? { advancedMode: first(searchParams.advanced) === "1" } : {}),
    ...(isOneOf(variant, WEREWOLF_VARIANTS) ? { werewolfVariant: variant } : {}),
    ...(isOneOf(mayorMode, MAYOR_MODES) ? { mayorMode } : {}),
    ...(isBooleanParam(searchParams.promo) ? { promoRolesEnabled: first(searchParams.promo) === "1" } : {}),
    ...(first(searchParams.mafiaKill) ? { mafiaNightKill: first(searchParams.mafiaKill) !== "0" } : {}),
    ...(isBooleanParam(searchParams.doctorSelf) ? { doctorCanSelfProtect: first(searchParams.doctorSelf) === "1" } : {}),
    ...(isOneOf(commissionerResult, COMMISSIONER_RESULT_MODES)
      ? { commissionerResultMode: commissionerResult }
      : {}),
    ...(isBooleanParam(searchParams.maniac) ? { maniacEnabled: first(searchParams.maniac) === "1" } : {}),
    ...(isBooleanParam(searchParams.jester) ? { jesterEnabled: first(searchParams.jester) === "1" } : {}),
    ...(isOneOf(narratorVoice, NARRATOR_VOICES) ? { narratorVoice } : {}),
    ...(first(searchParams.spectator) === "1" ? { spectator: true } : {}),
    ...(roles ? { roles } : {}),
  };
}

export function parseRolesParam(value: string | undefined): RoleDistribution | undefined {
  if (!value) {
    return undefined;
  }

  const roles: RoleDistribution = {};
  for (const segment of value.split(",")) {
    const [role, rawCount] = segment.split(":");
    const count = Number(rawCount);
    if (!isRoleCode(role) || !Number.isFinite(count) || count <= 0) {
      continue;
    }
    roles[role] = Math.floor(count);
  }

  return Object.keys(roles).length > 0 ? roles : undefined;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isBooleanParam(value: string | string[] | undefined) {
  return first(value) === "1" || first(value) === "0";
}

function parseCustomTimers(searchParams: RoomSearchParams): Partial<PhaseTimers> | undefined {
  const tempoReady = first(searchParams.tempoReady);
  const customTimers: Partial<PhaseTimers> = {};

  for (const { key, query } of ROOM_TIMER_QUERY_KEYS) {
    const value = parseInteger(first(searchParams[query]));
    if (typeof value === "number") customTimers[key] = value;
  }
  if (customTimers.personalNightActionSeconds === undefined && customTimers.factionNightActionSeconds !== undefined) {
    customTimers.personalNightActionSeconds = customTimers.factionNightActionSeconds;
  }
  if (tempoReady === "1" || tempoReady === "0") {
    customTimers.autoAdvanceWhenReady = tempoReady === "1";
  }

  return Object.keys(customTimers).length > 0 ? customTimers : undefined;
}

function parseInteger(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function isOneOf<T extends string>(value: string | undefined, values: readonly T[]): value is T {
  return Boolean(value && values.includes(value as T));
}

function isRoleCode(value: string | undefined): value is RoleCode {
  return Boolean(value && value in ROLE_DEFINITIONS);
}
