import {
  countRoles,
  getGameFamily,
  normalizePhaseTimers,
  resolvePhaseTimers,
  TEMPO_PRESETS,
  type GameMode,
  type PhaseTimers,
  type RoleCode,
  type RoleDistribution,
} from "@werewolf/shared";
import type { AdvancedFlags, CustomTimerKey, LobbyFormAction, LobbyFormState, LobbyStep, LobbyTemplate } from "./types";
import {
  boundedPlayerCount,
  clampPlayerCount,
  cleanRoles,
  cleanRoomCode,
  currentConfig,
  defaultAdvanced,
  defaultLoversEnabled,
  defaultModeForFamily,
  defaultPlayerCount,
  defaultRolePreset,
  defaultRoomName,
  normalizeAdvancedForPreset,
  presetRoles,
  timersForState,
} from "./selectors";

export function lobbyFormReducer(state: LobbyFormState, action: LobbyFormAction): LobbyFormState {
  switch (action.type) {
    case "SET_STEP":
      return setStep(state, action.step);
    case "NEXT_STEP":
      return setStep(state, nextStep(state.step));
    case "PREVIOUS_STEP":
      return setStep(state, previousStep(state.step));
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
      return applyManualRolesEnabled(state, action.enabled);
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
      return applyTempoProfile(state, action.tempoProfile);
    case "SET_CUSTOM_TIMER":
      return applyCustomTimer(state, action.key, action.value);
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
  const advanced = normalizeAdvancedForPreset(mode, playerCount, rolePreset, defaultAdvanced(mode, playerCount));

  return {
    ...state,
    family: state.lockedFamily ?? getGameFamily(mode),
    mode,
    playerCount,
    roomName: defaultRoomName(mode),
    rolePreset,
    tempoProfile: mode === "mafia_sport" ? "sport_mafia" : "normal_online",
    customTimers: resolvePhaseTimers(mode === "mafia_sport" ? "sport_mafia" : "normal_online"),
    customTimersTouched: false,
    advanced,
    manualRolesEnabled: false,
    manualRoles: presetRoles(mode, playerCount, rolePreset, advanced),
    manualRoleHistory: [],
    manualRoleFuture: [],
    preservedOptions: {},
    roleDetail: null,
  };
}

function applyPlayerCount(state: LobbyFormState, value: number): LobbyFormState {
  const playerCount = clampPlayerCount(state.mode, value);
  const advanced = normalizeAdvancedForPreset(state.mode, playerCount, state.rolePreset, {
    ...state.advanced,
    maxPlayers: Math.max(state.advanced.maxPlayers, playerCount),
  });
  return {
    ...state,
    playerCount,
    advanced,
    manualRoles: state.manualRolesEnabled
      ? resizeManualRolesForPlayerCount(state, playerCount)
      : presetRoles(state.mode, playerCount, state.rolePreset, advanced),
  };
}

function resizeManualRolesForPlayerCount(state: LobbyFormState, playerCount: number): RoleDistribution {
  const reserveRole = state.family === "werewolves" ? "ordinary_villager" : "civilian";
  const currentTotal = countRoles(state.manualRoles);
  const seatDelta = playerCount - currentTotal;

  if (seatDelta === 0) {
    return state.manualRoles;
  }

  if (seatDelta > 0) {
    return cleanRoles({
      ...state.manualRoles,
      [reserveRole]: (state.manualRoles[reserveRole] ?? 0) + seatDelta,
    });
  }

  const reserveCount = state.manualRoles[reserveRole] ?? 0;
  const removableReserveSeats = Math.min(reserveCount, Math.abs(seatDelta));
  const resized = cleanRoles({
    ...state.manualRoles,
    [reserveRole]: reserveCount - removableReserveSeats,
  });
  let seatsToRemove = Math.abs(seatDelta) - removableReserveSeats;
  if (seatsToRemove === 0) {
    return resized;
  }

  const protectedRoles = new Set<RoleCode>(
    state.family === "werewolves"
      ? ["werewolf", "vampire", "seer", "oracle"]
      : ["mafioso", "don", "commissioner"],
  );
  const availableRoles = (Object.keys(resized) as RoleCode[]).filter((role) => role !== reserveRole);
  const removalOrder = [
    ...availableRoles.filter((role) => !protectedRoles.has(role)).reverse(),
    ...availableRoles.filter((role) => protectedRoles.has(role)).reverse(),
  ];

  for (const role of removalOrder) {
    if (seatsToRemove === 0) {
      break;
    }
    const currentCount = resized[role] ?? 0;
    const minimum = protectedRoles.has(role) ? 1 : 0;
    const removable = Math.min(seatsToRemove, Math.max(0, currentCount - minimum));
    if (removable > 0) {
      resized[role] = currentCount - removable;
      seatsToRemove -= removable;
    }
  }

  for (const role of removalOrder) {
    if (seatsToRemove === 0) {
      break;
    }
    const currentCount = resized[role] ?? 0;
    const removable = Math.min(seatsToRemove, currentCount);
    if (removable > 0) {
      resized[role] = currentCount - removable;
      seatsToRemove -= removable;
    }
  }

  return cleanRoles(resized);
}

function applyTempoProfile(state: LobbyFormState, tempoProfile: LobbyFormState["tempoProfile"]): LobbyFormState {
  if (state.mode === "mafia_sport") {
    return { ...state, tempoProfile: "sport_mafia", customTimers: resolvePhaseTimers("sport_mafia"), customTimersTouched: false };
  }

  if (tempoProfile === "manual") {
    const customTimers = state.customTimersTouched ? state.customTimers : normalizePhaseTimers(timersForState(state), TEMPO_PRESETS.manual);
    return { ...state, tempoProfile, customTimers };
  }

  return { ...state, tempoProfile };
}

function applyCustomTimer(state: LobbyFormState, key: CustomTimerKey, value: number | boolean): LobbyFormState {
  const customTimers: Partial<PhaseTimers> = { ...state.customTimers };
  if (key === "autoAdvanceWhenReady") {
    customTimers.autoAdvanceWhenReady = Boolean(value);
  } else {
    const numericValue = typeof value === "number" ? value : Number(value);
    customTimers[key] = numericValue;
    if (key === "factionNightActionSeconds") {
      customTimers.personalNightActionSeconds = numericValue;
    }
  }

  return {
    ...state,
    tempoProfile: "manual",
    customTimers: normalizePhaseTimers(customTimers, TEMPO_PRESETS.manual),
    customTimersTouched: true,
  };
}

function applyRolePreset(state: LobbyFormState, rolePreset: LobbyFormState["rolePreset"]): LobbyFormState {
  const manualRolesEnabled = rolePreset === "manual";
  const nextPreset = rolePreset;
  const advanced = normalizeAdvancedForPreset(state.mode, boundedPlayerCount(state), nextPreset, state.advanced);
  return {
    ...state,
    rolePreset: nextPreset,
    manualRolesEnabled,
    advanced,
    manualRoles: manualRolesEnabled
      ? currentConfig(state).roles
      : presetRoles(state.mode, boundedPlayerCount(state), nextPreset, advanced),
    manualRoleHistory: [],
    manualRoleFuture: [],
  };
}

function applyManualRolesEnabled(state: LobbyFormState, enabled: boolean): LobbyFormState {
  if (enabled) {
    return {
      ...state,
      manualRolesEnabled: true,
      rolePreset: "manual",
      advanced: normalizeAdvancedForPreset(state.mode, boundedPlayerCount(state), "manual", state.advanced),
      manualRoles: currentConfig(state).roles,
    };
  }

  const rolePreset = defaultRolePreset(state.mode);
  const advanced = normalizeAdvancedForPreset(state.mode, boundedPlayerCount(state), rolePreset, {
    ...state.advanced,
    loversEnabled: state.advanced.loversEnabled || defaultLoversEnabled(state.mode, boundedPlayerCount(state), rolePreset),
  });

  return {
    ...state,
    manualRolesEnabled: false,
    rolePreset,
    advanced,
    manualRoles: presetRoles(state.mode, boundedPlayerCount(state), rolePreset, advanced),
  };
}

function applyAdvanced(state: LobbyFormState, key: keyof AdvancedFlags, value: AdvancedFlags[keyof AdvancedFlags]): LobbyFormState {
  let advanced = { ...state.advanced, [key]: value };
  if (key === "maxPlayers") {
    advanced.maxPlayers = Math.max(Number(value), boundedPlayerCount(state));
  }
  advanced = normalizeAdvancedForPreset(state.mode, boundedPlayerCount(state), state.rolePreset, advanced);
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
  const advanced = normalizeAdvancedForPreset(mode, playerCount, rolePreset, {
    ...defaultAdvanced(mode, playerCount),
    ...template.advanced,
  });
  return {
    ...state,
    family: state.lockedFamily ?? getGameFamily(mode),
    mode,
    playerCount,
    rolePreset,
    roomName: state.roomName || defaultRoomName(mode),
    tempoProfile: template.tempoProfile ?? (mode === "mafia_sport" ? "sport_mafia" : "normal_online"),
    customTimers: resolvePhaseTimers(template.tempoProfile ?? (mode === "mafia_sport" ? "sport_mafia" : "normal_online")),
    customTimersTouched: false,
    communicationMode: template.communicationMode ?? state.communicationMode,
    narratorMode: template.narratorMode ?? state.narratorMode,
    advanced,
    manualRolesEnabled: rolePreset === "manual",
    manualRoles: presetRoles(mode, playerCount, rolePreset, advanced),
    manualRoleHistory: [],
    manualRoleFuture: [],
    preservedOptions: {},
    step: template.step ?? state.step,
    visitedStep: template.step && template.step > state.visitedStep ? template.step : state.visitedStep,
  };
}

function commitManualRoles(state: LobbyFormState, roles: RoleDistribution): LobbyFormState {
  const normalizedRoles = normalizeManualRolesForFamily(state, roles);
  return {
    ...state,
    manualRoles: normalizedRoles,
    manualRolesEnabled: true,
    rolePreset: "manual",
    manualRoleHistory: [...state.manualRoleHistory.slice(-11), state.manualRoles],
    manualRoleFuture: [],
  };
}

function normalizeManualRolesForFamily(
  state: Pick<LobbyFormState, "family">,
  roles: RoleDistribution,
): RoleDistribution {
  const cleaned = cleanRoles(roles);
  const loversCount = cleaned.lovers ?? 0;
  if (state.family !== "mafia" || loversCount <= 0) {
    return cleaned;
  }

  delete cleaned.lovers;
  cleaned.civilian = (cleaned.civilian ?? 0) + loversCount;
  return cleaned;
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
