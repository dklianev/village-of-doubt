import type {
  CommunicationMode,
  CreateRoomOptions,
  GameMode,
  MajorityMode,
  MayorMode,
  NarratorMode,
  NarratorVoice,
  RoleCode,
  RoleDistribution,
  RolePreset,
  RoomVisibility,
  TempoProfile,
  WerewolfVariant,
  CommissionerResultMode,
} from "@werewolf/shared";
import { GAME_MODE_DEFINITIONS, ROLE_DEFINITIONS } from "@werewolf/shared";

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
  const variant = first(searchParams.variant);
  const mayorMode = first(searchParams.mayorMode);
  const commissionerResult = first(searchParams.commissionerResult);
  const narratorVoice = first(searchParams.narratorVoice);
  const roomName = first(searchParams.roomName);
  const roles = parseRolesParam(first(searchParams.roles));
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
    ...(isOneOf(tempo, TEMPO_PROFILES) ? { tempoProfile: tempo } : {}),
    ...(first(searchParams.lovers) === "1" ? { loversEnabled: true } : {}),
    ...(first(searchParams.reveal) ? { revealRolesOnDeath: first(searchParams.reveal) !== "0" } : {}),
    ...(first(searchParams.skip) ? { allowSkipVote: first(searchParams.skip) !== "0" } : {}),
    ...(isOneOf(majority, MAJORITY_MODES) ? { majorityMode: majority } : {}),
    ...(first(searchParams.autoStart) === "1" ? { autoStart: true } : {}),
    ...(first(searchParams.beginner) === "1" ? { beginnerMode: true } : {}),
    ...(first(searchParams.advanced) === "1" ? { advancedMode: true } : {}),
    ...(isOneOf(variant, WEREWOLF_VARIANTS) ? { werewolfVariant: variant } : {}),
    ...(isOneOf(mayorMode, MAYOR_MODES) ? { mayorMode } : {}),
    ...(first(searchParams.promo) === "1" ? { promoRolesEnabled: true } : {}),
    ...(first(searchParams.mafiaKill) ? { mafiaNightKill: first(searchParams.mafiaKill) !== "0" } : {}),
    ...(first(searchParams.doctorSelf) === "1" ? { doctorCanSelfProtect: true } : {}),
    ...(isOneOf(commissionerResult, COMMISSIONER_RESULT_MODES)
      ? { commissionerResultMode: commissionerResult }
      : {}),
    ...(first(searchParams.maniac) === "1" ? { maniacEnabled: true } : {}),
    ...(first(searchParams.jester) === "1" ? { jesterEnabled: true } : {}),
    ...(isOneOf(narratorVoice, NARRATOR_VOICES) ? { narratorVoice } : {}),
    ...(first(searchParams.spectator) === "1" ? { spectator: true } : {}),
    ...(roles ? { roles } : {}),
  };
}

export function roomOptionsToQuery(options: CreateRoomOptions) {
  const params = new URLSearchParams();

  if (options.mode) {
    params.set("mode", options.mode);
  }
  if (options.playerCount) {
    params.set("players", String(options.playerCount));
  }
  if (options.maxPlayers) {
    params.set("maxPlayers", String(options.maxPlayers));
  }
  if (options.roomName) {
    params.set("roomName", options.roomName);
  }
  if (options.roomVisibility) {
    params.set("visibility", options.roomVisibility);
  }
  if (options.rolePreset) {
    params.set("preset", options.rolePreset);
  }
  if (options.communicationMode) {
    params.set("communication", options.communicationMode);
  }
  if (options.narratorMode) {
    params.set("narrator", options.narratorMode);
  }
  if (options.tempoProfile) {
    params.set("tempo", options.tempoProfile);
  }
  if (options.loversEnabled) {
    params.set("lovers", "1");
  }
  if (typeof options.revealRolesOnDeath === "boolean") {
    params.set("reveal", options.revealRolesOnDeath ? "1" : "0");
  }
  if (typeof options.allowSkipVote === "boolean") {
    params.set("skip", options.allowSkipVote ? "1" : "0");
  }
  if (options.majorityMode) {
    params.set("majority", options.majorityMode);
  }
  if (options.autoStart) {
    params.set("autoStart", "1");
  }
  if (options.beginnerMode) {
    params.set("beginner", "1");
  }
  if (options.advancedMode) {
    params.set("advanced", "1");
  }
  if (options.werewolfVariant) {
    params.set("variant", options.werewolfVariant);
  }
  if (options.mayorMode) {
    params.set("mayorMode", options.mayorMode);
  }
  if (options.promoRolesEnabled) {
    params.set("promo", "1");
  }
  if (typeof options.mafiaNightKill === "boolean") {
    params.set("mafiaKill", options.mafiaNightKill ? "1" : "0");
  }
  if (options.doctorCanSelfProtect) {
    params.set("doctorSelf", "1");
  }
  if (options.commissionerResultMode) {
    params.set("commissionerResult", options.commissionerResultMode);
  }
  if (options.maniacEnabled) {
    params.set("maniac", "1");
  }
  if (options.jesterEnabled) {
    params.set("jester", "1");
  }
  if (options.narratorVoice) {
    params.set("narratorVoice", options.narratorVoice);
  }
  if (options.spectator) {
    params.set("spectator", "1");
  }
  if (options.roles) {
    params.set("roles", stringifyRolesParam(options.roles));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function stringifyRolesParam(roles: RoleDistribution) {
  return Object.entries(roles)
    .filter((entry): entry is [RoleCode, number] => isRoleCode(entry[0]) && typeof entry[1] === "number" && entry[1] > 0)
    .map(([role, count]) => `${role}:${Math.floor(count)}`)
    .join(",");
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

function isOneOf<T extends string>(value: string | undefined, values: readonly T[]): value is T {
  return Boolean(value && values.includes(value as T));
}

function isRoleCode(value: string | undefined): value is RoleCode {
  return Boolean(value && value in ROLE_DEFINITIONS);
}
