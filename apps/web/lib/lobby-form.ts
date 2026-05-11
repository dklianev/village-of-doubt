import {
  countRoles,
  createGameConfigFromOptions,
  GAME_MODE_DEFINITIONS,
  getGameFamily,
  getRoleBalanceScore,
  TEMPO_PRESETS,
  validateRoleDistributionForMode,
  type CommunicationMode,
  type CreateRoomOptions,
  type GameConfig,
  type GameFamily,
  type GameMode,
  type MajorityMode,
  type NarratorMode,
  type NarratorVoice,
  type RoleCode,
  type RoleDistribution,
  type RolePreset,
  type TempoProfile,
  type CommissionerResultMode,
} from "@werewolf/shared";
import { parseRoomCreateOptions, roomOptionsToQuery, type RoomSearchParams } from "@/lib/room-options";

export type LobbyStep = 1 | 2 | 3 | 4;

export type AdvancedFlags = {
  revealRolesOnDeath: boolean;
  allowSkipVote: boolean;
  autoStart: boolean;
  majorityMode: MajorityMode;
  loversEnabled: boolean;
  mafiaNightKill: boolean;
  doctorCanSelfProtect: boolean;
  commissionerResultMode: CommissionerResultMode;
  maniacEnabled: boolean;
  jesterEnabled: boolean;
  narratorVoice: NarratorVoice;
  maxPlayers: number;
};

export type RuntimeFilter = "playable" | "manual_only";
export type RoleDetailState = { role: RoleCode; source: "tile" | "builder" } | null;

export type LobbyFormState = {
  step: LobbyStep;
  visitedStep: LobbyStep;
  lockedFamily: GameFamily | undefined;
  family: GameFamily;
  displayName: string;
  formError: string;
  manualPresetMessage: string;
  code: string;
  roomName: string;
  mode: GameMode;
  playerCount: number;
  rolePreset: RolePreset;
  manualRolesEnabled: boolean;
  manualRoles: RoleDistribution;
  manualRoleHistory: RoleDistribution[];
  manualRoleFuture: RoleDistribution[];
  communicationMode: CommunicationMode;
  narratorMode: NarratorMode;
  tempoProfile: TempoProfile;
  advanced: AdvancedFlags;
  roleSearch: string;
  runtimeFilter: RuntimeFilter;
  roleDetail: RoleDetailState;
  mobileSummaryOpen: boolean;
  inviteSheetOpen: boolean;
  confettiBurst: number;
};

export type LobbyTemplate = {
  mode: GameMode;
  playerCount: number;
  rolePreset: RolePreset;
  step?: LobbyStep;
};

export type LobbyFormAction =
  | { type: "SET_STEP"; step: LobbyStep }
  | { type: "NEXT_STEP" }
  | { type: "PREVIOUS_STEP" }
  | { type: "SET_DISPLAY_NAME"; displayName: string }
  | { type: "SET_FORM_ERROR"; formError: string }
  | { type: "SET_MANUAL_PRESET_MESSAGE"; message: string }
  | { type: "SET_ROOM_NAME"; roomName: string }
  | { type: "SET_CODE"; code: string }
  | { type: "SET_MODE"; mode: GameMode }
  | { type: "SET_PLAYER_COUNT"; playerCount: number }
  | { type: "SET_ROLE_PRESET"; rolePreset: RolePreset }
  | { type: "SET_MANUAL_ROLES_ENABLED"; enabled: boolean }
  | { type: "SET_MANUAL_ROLES"; roles: RoleDistribution }
  | { type: "UNDO_MANUAL_ROLES" }
  | { type: "REDO_MANUAL_ROLES" }
  | { type: "SET_COMMUNICATION_MODE"; communicationMode: CommunicationMode }
  | { type: "SET_NARRATOR_MODE"; narratorMode: NarratorMode }
  | { type: "SET_TEMPO_PROFILE"; tempoProfile: TempoProfile }
  | { type: "SET_ADVANCED"; key: keyof AdvancedFlags; value: AdvancedFlags[keyof AdvancedFlags] }
  | { type: "SET_ROLE_SEARCH"; query: string }
  | { type: "SET_RUNTIME_FILTER"; runtimeFilter: RuntimeFilter }
  | { type: "SET_ROLE_DETAIL"; roleDetail: RoleDetailState }
  | { type: "SET_MOBILE_SUMMARY_OPEN"; open: boolean }
  | { type: "SET_INVITE_SHEET_OPEN"; open: boolean }
  | { type: "TRIGGER_CONFETTI" }
  | { type: "APPLY_TEMPLATE"; template: LobbyTemplate };

export const MANUAL_PRESET_STORAGE_KEY = "werewolf-mafia-manual-role-preset-v1";

const DEFAULT_STEP: LobbyStep = 1;

export function lobbyFormReducer(state: LobbyFormState, action: LobbyFormAction): LobbyFormState {
  switch (action.type) {
    case "SET_STEP":
      return setStep(state, action.step);
    case "NEXT_STEP":
      return setStep(state, nextStep(state.step));
    case "PREVIOUS_STEP":
      return setStep(state, previousStep(state.step));
    case "SET_DISPLAY_NAME":
      return { ...state, displayName: action.displayName.slice(0, 24), formError: "" };
    case "SET_FORM_ERROR":
      return { ...state, formError: action.formError };
    case "SET_MANUAL_PRESET_MESSAGE":
      return { ...state, manualPresetMessage: action.message };
    case "SET_ROOM_NAME":
      return { ...state, roomName: action.roomName.slice(0, 42) };
    case "SET_CODE":
      return { ...state, code: cleanRoomCode(action.code) };
    case "SET_MODE":
      return applyMode(state, action.mode);
    case "SET_PLAYER_COUNT":
      return applyPlayerCount(state, action.playerCount);
    case "SET_ROLE_PRESET":
      return applyRolePreset(state, action.rolePreset);
    case "SET_MANUAL_ROLES_ENABLED":
      return {
        ...state,
        manualRolesEnabled: action.enabled,
        rolePreset: action.enabled ? "manual" : defaultRolePreset(state.mode),
        manualRoles: action.enabled ? currentConfig(state).roles : presetRoles(state.mode, state.playerCount, state.rolePreset, state.advanced),
      };
    case "SET_MANUAL_ROLES":
      return commitManualRoles(state, action.roles);
    case "UNDO_MANUAL_ROLES":
      return undoManualRoles(state);
    case "REDO_MANUAL_ROLES":
      return redoManualRoles(state);
    case "SET_COMMUNICATION_MODE":
      return { ...state, communicationMode: action.communicationMode };
    case "SET_NARRATOR_MODE":
      return { ...state, narratorMode: action.narratorMode };
    case "SET_TEMPO_PROFILE":
      return { ...state, tempoProfile: action.tempoProfile };
    case "SET_ADVANCED":
      return applyAdvanced(state, action.key, action.value);
    case "SET_ROLE_SEARCH":
      return { ...state, roleSearch: action.query };
    case "SET_RUNTIME_FILTER":
      return { ...state, runtimeFilter: action.runtimeFilter };
    case "SET_ROLE_DETAIL":
      return { ...state, roleDetail: action.roleDetail };
    case "SET_MOBILE_SUMMARY_OPEN":
      return { ...state, mobileSummaryOpen: action.open };
    case "SET_INVITE_SHEET_OPEN":
      return { ...state, inviteSheetOpen: action.open };
    case "TRIGGER_CONFETTI":
      return { ...state, confettiBurst: state.confettiBurst + 1 };
    case "APPLY_TEMPLATE":
      return applyTemplate(state, action.template);
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

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
  const hydratedConfig = createGameConfigFromOptions({ ...parsed, mode });
  const manualRolesEnabled = Boolean(parsed.roles) || hydratedConfig.rolePreset === "manual";
  const playerCount = clampPlayerCount(mode, hydratedConfig.playerCount);
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

  return {
    step: DEFAULT_STEP,
    visitedStep: DEFAULT_STEP,
    lockedFamily: family,
    family: family ?? getGameFamily(mode),
    displayName: "",
    formError: "",
    manualPresetMessage: "",
    code: createRoomCode(),
    roomName: hydratedConfig.roomName,
    mode,
    playerCount,
    rolePreset: manualRolesEnabled ? "manual" : hydratedConfig.rolePreset,
    manualRolesEnabled,
    manualRoles: hydratedConfig.roles,
    manualRoleHistory: [],
    manualRoleFuture: [],
    communicationMode: hydratedConfig.communicationMode,
    narratorMode: hydratedConfig.narratorMode,
    tempoProfile: hydratedConfig.tempoProfile,
    advanced,
    roleSearch: "",
    runtimeFilter: "playable",
    roleDetail: null,
    mobileSummaryOpen: false,
    inviteSheetOpen: false,
    confettiBurst: 0,
  };
}

export function currentConfig(state: LobbyFormState): GameConfig {
  return createGameConfigFromOptions(optionsFromState(state));
}

export function optionsFromState(state: LobbyFormState): CreateRoomOptions {
  const base: CreateRoomOptions = {
    mode: state.mode,
    roomName: state.roomName,
    playerCount: boundedPlayerCount(state),
    maxPlayers: Math.max(state.advanced.maxPlayers, boundedPlayerCount(state)),
    communicationMode: state.communicationMode,
    narratorMode: state.narratorMode,
    tempoProfile: state.tempoProfile,
    rolePreset: state.manualRolesEnabled ? "manual" : state.rolePreset,
    revealRolesOnDeath: state.advanced.revealRolesOnDeath,
    allowSkipVote: state.advanced.allowSkipVote,
    majorityMode: state.advanced.majorityMode,
    autoStart: state.advanced.autoStart,
    loversEnabled: state.advanced.loversEnabled,
    mafiaNightKill: state.advanced.mafiaNightKill,
    doctorCanSelfProtect: state.advanced.doctorCanSelfProtect,
    commissionerResultMode: state.advanced.commissionerResultMode,
    maniacEnabled: state.advanced.maniacEnabled,
    jesterEnabled: state.advanced.jesterEnabled,
    narratorVoice: state.advanced.narratorVoice,
  };

  return state.manualRolesEnabled ? { ...base, roles: state.manualRoles } : base;
}

export function queryFromState(state: LobbyFormState) {
  return roomOptionsToQuery(optionsFromState(state));
}

export function hrefForState(base: "/play" | "/lobby", state: LobbyFormState) {
  return `${base}/${cleanRoomCode(state.code)}${queryFromState(state)}`;
}

export function boundedPlayerCount(state: LobbyFormState) {
  return clampPlayerCount(state.mode, state.playerCount);
}

export function roleWarnings(state: LobbyFormState) {
  const config = currentConfig(state);
  return validateRoleDistributionForMode(state.mode, config.playerCount, config.roles);
}

export function criticalRoleWarnings(state: LobbyFormState) {
  return roleWarnings(state).filter((warning) =>
    [
      "не съвпада",
      "не принадлежи",
      "Липсва",
      "изисква",
      "може да се включи само",
      "трябва да има",
    ].some((needle) => warning.includes(needle)),
  );
}

export function roleTotal(state: LobbyFormState) {
  return countRoles(currentConfig(state).roles);
}

export function roleBalance(state: LobbyFormState) {
  return getRoleBalanceScore(currentConfig(state).roles);
}

export function playerRange(mode: GameMode) {
  if (mode === "mafia_sport") {
    return { min: 10, max: 10 };
  }
  if (mode === "mafia_free") {
    return { min: 4, max: 24 };
  }
  return { min: 6, max: 30 };
}

export function defaultPlayerCount(mode: GameMode) {
  return mode === "mafia_sport" ? 10 : 10;
}

export function defaultRolePreset(mode: GameMode): RolePreset {
  return mode === "mafia_sport" ? "sport" : mode === "mafia_free" ? "free" : "classic";
}

export function rolePresetsForMode(mode: GameMode): RolePreset[] {
  if (mode === "mafia_sport") {
    return ["sport", "manual"];
  }
  if (mode === "mafia_free") {
    return ["free", "manual"];
  }
  return ["beginner", "classic", "advanced", "manual"];
}

export function availableModes(family: GameFamily): GameMode[] {
  return (Object.keys(GAME_MODE_DEFINITIONS) as GameMode[]).filter((mode) => getGameFamily(mode) === family);
}

export function defaultRoomName(mode: GameMode) {
  return getGameFamily(mode) === "mafia" ? "Частна маса" : "Частно село";
}

export function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function cleanRoomCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function estimatedDurationSeconds(state: LobbyFormState) {
  const timers = TEMPO_PRESETS[state.tempoProfile];
  const rounds = Math.max(2, Math.ceil(boundedPlayerCount(state) / 2));
  return (
    timers.roleRevealSeconds +
    rounds * (timers.dayDiscussionSeconds + timers.voteSeconds + timers.factionNightActionSeconds + timers.resolutionSeconds)
  );
}

export function formatEstimatedDuration(seconds: number) {
  return `~${Math.max(5, Math.round(seconds / 60))} мин`;
}

function setStep(state: LobbyFormState, step: LobbyStep): LobbyFormState {
  return { ...state, step, visitedStep: step > state.visitedStep ? step : state.visitedStep };
}

function nextStep(step: LobbyStep): LobbyStep {
  return step < 4 ? ((step + 1) as LobbyStep) : 4;
}

function previousStep(step: LobbyStep): LobbyStep {
  return step > 1 ? ((step - 1) as LobbyStep) : 1;
}

function applyMode(state: LobbyFormState, nextMode: GameMode): LobbyFormState {
  const mode = state.lockedFamily && getGameFamily(nextMode) !== state.lockedFamily ? defaultModeForFamily(state.lockedFamily) : nextMode;
  const playerCount = defaultPlayerCount(mode);
  const rolePreset = defaultRolePreset(mode);
  const advanced = defaultAdvanced(mode, playerCount);

  return {
    ...state,
    family: state.lockedFamily ?? getGameFamily(mode),
    mode,
    playerCount,
    roomName: defaultRoomName(mode),
    rolePreset,
    tempoProfile: mode === "mafia_sport" ? "sport_mafia" : "normal_online",
    advanced,
    manualRolesEnabled: false,
    manualRoles: presetRoles(mode, playerCount, rolePreset, advanced),
    manualRoleHistory: [],
    manualRoleFuture: [],
    roleDetail: null,
  };
}

function applyPlayerCount(state: LobbyFormState, value: number): LobbyFormState {
  const playerCount = clampPlayerCount(state.mode, value);
  const advanced = { ...state.advanced, maxPlayers: Math.max(state.advanced.maxPlayers, playerCount) };
  return {
    ...state,
    playerCount,
    advanced,
    manualRoles: state.manualRolesEnabled ? state.manualRoles : presetRoles(state.mode, playerCount, state.rolePreset, advanced),
  };
}

function applyRolePreset(state: LobbyFormState, rolePreset: RolePreset): LobbyFormState {
  const manualRolesEnabled = rolePreset === "manual";
  const nextPreset = rolePreset;
  return {
    ...state,
    rolePreset: nextPreset,
    manualRolesEnabled,
    manualRoles: manualRolesEnabled
      ? currentConfig(state).roles
      : presetRoles(state.mode, boundedPlayerCount(state), nextPreset, state.advanced),
    manualRoleHistory: [],
    manualRoleFuture: [],
  };
}

function applyAdvanced(state: LobbyFormState, key: keyof AdvancedFlags, value: AdvancedFlags[keyof AdvancedFlags]): LobbyFormState {
  const advanced = { ...state.advanced, [key]: value };
  if (key === "maxPlayers") {
    advanced.maxPlayers = Math.max(Number(value), boundedPlayerCount(state));
  }
  return {
    ...state,
    advanced,
    manualRoles: state.manualRolesEnabled ? state.manualRoles : presetRoles(state.mode, boundedPlayerCount(state), state.rolePreset, advanced),
  };
}

function applyTemplate(state: LobbyFormState, template: LobbyTemplate): LobbyFormState {
  const family = getGameFamily(template.mode);
  const mode = state.lockedFamily && family !== state.lockedFamily ? defaultModeForFamily(state.lockedFamily) : template.mode;
  const playerCount = clampPlayerCount(mode, template.playerCount);
  const rolePreset = template.rolePreset;
  const advanced = defaultAdvanced(mode, playerCount);
  return {
    ...state,
    family: state.lockedFamily ?? getGameFamily(mode),
    mode,
    playerCount,
    rolePreset,
    roomName: state.roomName || defaultRoomName(mode),
    tempoProfile: mode === "mafia_sport" ? "sport_mafia" : "normal_online",
    advanced,
    manualRolesEnabled: rolePreset === "manual",
    manualRoles: presetRoles(mode, playerCount, rolePreset, advanced),
    manualRoleHistory: [],
    manualRoleFuture: [],
    step: template.step ?? state.step,
    visitedStep: template.step && template.step > state.visitedStep ? template.step : state.visitedStep,
  };
}

function commitManualRoles(state: LobbyFormState, roles: RoleDistribution): LobbyFormState {
  return {
    ...state,
    manualRoles: cleanRoles(roles),
    manualRolesEnabled: true,
    rolePreset: "manual",
    manualRoleHistory: [...state.manualRoleHistory.slice(-11), state.manualRoles],
    manualRoleFuture: [],
  };
}

function undoManualRoles(state: LobbyFormState): LobbyFormState {
  const previous = state.manualRoleHistory.at(-1);
  if (!previous) {
    return state;
  }
  return {
    ...state,
    manualRoles: previous,
    manualRoleHistory: state.manualRoleHistory.slice(0, -1),
    manualRoleFuture: [state.manualRoles, ...state.manualRoleFuture.slice(0, 11)],
  };
}

function redoManualRoles(state: LobbyFormState): LobbyFormState {
  const next = state.manualRoleFuture[0];
  if (!next) {
    return state;
  }
  return {
    ...state,
    manualRoles: next,
    manualRoleHistory: [...state.manualRoleHistory.slice(-11), state.manualRoles],
    manualRoleFuture: state.manualRoleFuture.slice(1),
  };
}

function defaultAdvanced(mode: GameMode, playerCount: number): AdvancedFlags {
  const config = createGameConfigFromOptions({ mode, playerCount, rolePreset: defaultRolePreset(mode) });
  return {
    revealRolesOnDeath: config.revealRolesOnDeath,
    allowSkipVote: config.allowSkipVote,
    autoStart: config.autoStart,
    majorityMode: config.majorityMode,
    loversEnabled: config.loversEnabled,
    mafiaNightKill: config.mafiaNightKill,
    doctorCanSelfProtect: config.doctorCanSelfProtect,
    commissionerResultMode: config.commissionerResultMode,
    maniacEnabled: config.maniacEnabled,
    jesterEnabled: config.jesterEnabled,
    narratorVoice: config.narratorVoice,
    maxPlayers: Math.max(config.maxPlayers, playerCount),
  };
}

function presetRoles(mode: GameMode, playerCount: number, rolePreset: RolePreset, advanced: AdvancedFlags): RoleDistribution {
  return createGameConfigFromOptions({
    mode,
    playerCount,
    rolePreset,
    loversEnabled: advanced.loversEnabled,
    maniacEnabled: advanced.maniacEnabled,
    jesterEnabled: advanced.jesterEnabled,
  }).roles;
}

function clampPlayerCount(mode: GameMode, value: number) {
  const range = playerRange(mode);
  const safeValue = Number.isFinite(value) ? value : defaultPlayerCount(mode);
  return Math.min(range.max, Math.max(range.min, Math.round(safeValue)));
}

function defaultModeForFamily(family: GameFamily): GameMode {
  return family === "mafia" ? "mafia_free" : "werewolves_classic";
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

function isGameMode(value: unknown): value is GameMode {
  return typeof value === "string" && value in GAME_MODE_DEFINITIONS;
}

function cleanRoles(distribution: RoleDistribution): RoleDistribution {
  const cleaned: RoleDistribution = {};
  for (const [role, count] of Object.entries(distribution) as [RoleCode, number | undefined][]) {
    if (count && count > 0) {
      cleaned[role] = Math.floor(count);
    }
  }
  return cleaned;
}
