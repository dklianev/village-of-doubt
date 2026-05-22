import {
  createGameConfigFromOptions,
  getGameFamily,
  resolvePhaseTimers,
  type GameFamily,
  type GameMode,
} from "@werewolf/shared";
import { parseRoomCreateOptions, roomOptionsToQuery, type RoomSearchParams } from "@/lib/room-options";
import type { AdvancedFlags, LobbyFormState, LobbyStep } from "./types";
import {
  cleanRoomCode,
  createRoomCode,
  defaultLoversEnabled,
  defaultModeForFamily,
  defaultPlayerCount,
  isGameMode,
  manualTimersFrom,
  normalizeAdvancedForPreset,
  optionsFromState,
  presetRoles,
  clampPlayerCount,
} from "./selectors";

const DEFAULT_STEP: LobbyStep = 1;

export function initialState({
  initialMode = "werewolves_classic",
  family,
  urlParams,
}: {
  initialMode?: GameMode;
  family?: GameFamily | undefined;
  urlParams?: RoomSearchParams | URLSearchParams;
} = {}): LobbyFormState {
  const parsed = parseRoomCreateOptions(toRoomSearchParams(urlParams));
  const requestedMode = isGameMode(parsed.mode) ? parsed.mode : initialMode;
  const mode = family && getGameFamily(requestedMode) !== family ? defaultModeForFamily(family) : requestedMode;
  const playerCount = clampPlayerCount(mode, parsed.playerCount ?? defaultPlayerCount(mode));
  const hydratedConfig = createGameConfigFromOptions({ ...parsed, mode, playerCount });
  const manualRolesEnabled = Boolean(parsed.roles) || hydratedConfig.rolePreset === "manual";
  const advanced: AdvancedFlags = {
    revealRolesOnDeath: hydratedConfig.revealRolesOnDeath,
    allowSkipVote: hydratedConfig.allowSkipVote,
    autoStart: hydratedConfig.autoStart,
    majorityMode: hydratedConfig.majorityMode,
    loversEnabled: hydratedConfig.loversEnabled,
    mafiaNightKill: hydratedConfig.mafiaNightKill,
    doctorCanSelfProtect: hydratedConfig.doctorCanSelfProtect,
    commissionerResultMode: hydratedConfig.commissionerResultMode,
    maniacEnabled: hydratedConfig.maniacEnabled,
    jesterEnabled: hydratedConfig.jesterEnabled,
    narratorVoice: hydratedConfig.narratorVoice,
    maxPlayers: Math.max(hydratedConfig.maxPlayers, playerCount),
  };
  const rolePreset = manualRolesEnabled ? "manual" : hydratedConfig.rolePreset;
  const normalizedAdvanced = normalizeAdvancedForPreset(mode, playerCount, rolePreset, {
    ...advanced,
    loversEnabled: advanced.loversEnabled || defaultLoversEnabled(mode, playerCount, rolePreset),
  });

  return {
    step: DEFAULT_STEP,
    visitedStep: DEFAULT_STEP,
    lockedFamily: family,
    family: family ?? getGameFamily(mode),
    formError: "",
    manualPresetMessage: "",
    code: createRoomCode(),
    roomName: hydratedConfig.roomName,
    mode,
    playerCount,
    rolePreset,
    manualRolesEnabled,
    manualRoles: manualRolesEnabled ? hydratedConfig.roles : presetRoles(mode, playerCount, rolePreset, normalizedAdvanced),
    manualRoleHistory: [],
    manualRoleFuture: [],
    communicationMode: hydratedConfig.communicationMode,
    narratorMode: hydratedConfig.narratorMode,
    tempoProfile: hydratedConfig.tempoProfile,
    customTimers:
      hydratedConfig.tempoProfile === "manual"
        ? manualTimersFrom(parsed.customTimers)
        : resolvePhaseTimers(hydratedConfig.tempoProfile),
    customTimersTouched: Boolean(parsed.customTimers),
    advanced: normalizedAdvanced,
    roleSearch: "",
    runtimeFilter: "playable",
    roleDetail: null,
    mobileSummaryOpen: false,
    inviteSheetOpen: false,
    confettiBurst: 0,
  };
}

export function queryFromState(state: LobbyFormState) {
  return roomOptionsToQuery(optionsFromState(state));
}

export function hrefForState(base: "/play" | "/lobby", state: LobbyFormState) {
  return `${base}/${cleanRoomCode(state.code)}${queryFromState(state)}`;
}

function toRoomSearchParams(params: RoomSearchParams | URLSearchParams | undefined): RoomSearchParams {
  if (!params) {
    return {};
  }
  if (params instanceof URLSearchParams) {
    return Object.fromEntries(params.entries());
  }
  return params;
}
