import {
  createGameConfigFromOptions,
  getGameFamily,
  resolvePhaseTimers,
  type CreateRoomOptions,
  type GameFamily,
  type GameConfig,
  type GameMode,
  type RoleDistribution,
} from "@werewolf/shared";
import { parseRoomCreateOptions, roomOptionsToQuery, type RoomSearchParams } from "@/lib/room-options";
import type { AdvancedFlags, LobbyFormState, LobbyStep, PreservedCreateOptions } from "./types";
import {
  cleanRoomCode,
  createRoomCode,
  defaultLoversEnabled,
  defaultModeForFamily,
  defaultPlayerCount,
  defaultRolePreset,
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
  const hydration = hydrateConfig(parsed, mode, playerCount);
  const hydratedConfig = hydration.config;
  const manualRolesEnabled = hydration.acceptedManualRoles || hydratedConfig.rolePreset === "manual";
  const normalizedManualRoles = normalizeRetiredMafiaLovers(mode, hydratedConfig.roles);
  const retiredMafiaLovers =
    getGameFamily(mode) === "mafia" && manualRolesEnabled && (hydratedConfig.roles.lovers ?? 0) > 0;
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
    formError:
      hydration.error ||
      (retiredMafiaLovers
        ? "Заменихме стария избор „Влюбени“ с Гражданин. Влюбените вече се създават само от Купидон."
        : ""),
    manualPresetMessage: "",
    code: createRoomCode(),
    roomName: hydratedConfig.roomName,
    mode,
    playerCount,
    rolePreset,
    manualRolesEnabled,
    manualRoles: manualRolesEnabled
      ? normalizedManualRoles
      : presetRoles(mode, playerCount, rolePreset, normalizedAdvanced),
    manualRoleHistory: [],
    manualRoleFuture: [],
    preservedOptions: pickPreservedOptions(parsed),
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

function hydrateConfig(parsed: CreateRoomOptions, mode: GameMode, playerCount: number) {
  try {
    return {
      config: createGameConfigFromOptions({ ...parsed, mode, playerCount }),
      acceptedManualRoles: Boolean(parsed.roles),
      error: "",
    };
  } catch {
    const { roles: _roles, rolePreset: _rolePreset, ...safeOptions } = parsed;
    const config: GameConfig = createGameConfigFromOptions({
      ...safeOptions,
      mode,
      playerCount,
      rolePreset: defaultRolePreset(mode),
    });
    return {
      config,
      acceptedManualRoles: false,
      error: "Връзката съдържаше невалидни роли. Върнахме сигурния препоръчан състав.",
    };
  }
}

function normalizeRetiredMafiaLovers(mode: GameMode, roles: RoleDistribution): RoleDistribution {
  const loversCount = roles.lovers ?? 0;
  if (getGameFamily(mode) !== "mafia" || loversCount <= 0) {
    return roles;
  }

  const normalized = { ...roles };
  delete normalized.lovers;
  normalized.civilian = (normalized.civilian ?? 0) + loversCount;
  return normalized;
}

function pickPreservedOptions(options: CreateRoomOptions): PreservedCreateOptions {
  return {
    ...(options.roomVisibility ? { roomVisibility: options.roomVisibility } : {}),
    ...(typeof options.beginnerMode === "boolean" ? { beginnerMode: options.beginnerMode } : {}),
    ...(typeof options.advancedMode === "boolean" ? { advancedMode: options.advancedMode } : {}),
    ...(options.werewolfVariant ? { werewolfVariant: options.werewolfVariant } : {}),
    ...(options.mayorMode ? { mayorMode: options.mayorMode } : {}),
    ...(typeof options.promoRolesEnabled === "boolean"
      ? { promoRolesEnabled: options.promoRolesEnabled }
      : {}),
    ...(typeof options.spectator === "boolean" ? { spectator: options.spectator } : {}),
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
