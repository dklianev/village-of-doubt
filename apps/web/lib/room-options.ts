import type {
  CommunicationMode,
  CreateRoomOptions,
  GameMode,
  NarratorMode,
  RoleCode,
  RoleDistribution,
  TempoProfile,
} from "@werewolf/shared";
import { GAME_MODE_DEFINITIONS, ROLE_DEFINITIONS } from "@werewolf/shared";

export type RoomSearchParams = Record<string, string | string[] | undefined>;

const GAME_MODES = Object.keys(GAME_MODE_DEFINITIONS) as GameMode[];
const COMMUNICATION_MODES: CommunicationMode[] = ["built_in_chat", "no_chat", "system_only", "secret_channels"];
const NARRATOR_MODES: NarratorMode[] = ["automatic", "honest_human", "full_human"];
const TEMPO_PROFILES: TempoProfile[] = ["fast_online", "normal_online", "live", "sport_mafia", "manual"];

export function parseRoomCreateOptions(searchParams: RoomSearchParams = {}): CreateRoomOptions {
  const mode = first(searchParams.mode);
  const communication = first(searchParams.communication);
  const narrator = first(searchParams.narrator);
  const tempo = first(searchParams.tempo);
  const roles = parseRolesParam(first(searchParams.roles));
  const players = Number(first(searchParams.players));

  return {
    ...(isOneOf(mode, GAME_MODES) ? { mode } : {}),
    ...(Number.isFinite(players) ? { playerCount: players } : {}),
    ...(isOneOf(communication, COMMUNICATION_MODES) ? { communicationMode: communication } : {}),
    ...(isOneOf(narrator, NARRATOR_MODES) ? { narratorMode: narrator } : {}),
    ...(isOneOf(tempo, TEMPO_PROFILES) ? { tempoProfile: tempo } : {}),
    ...(first(searchParams.lovers) === "1" ? { loversEnabled: true } : {}),
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
