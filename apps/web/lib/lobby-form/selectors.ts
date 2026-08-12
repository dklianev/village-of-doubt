import {
  countRoles,
  createGameConfigFromOptions,
  GAME_MODE_DEFINITIONS,
  getGameFamily,
  ROLE_DEFINITIONS,
  getRoleBalanceScore,
  normalizePhaseTimers,
  normalizeRoomCodeInput,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  resolvePhaseTimers,
  TEMPO_PRESETS,
  validateRoleDistributionForMode,
  validateRoleDistributionIssuesForMode,
  type CreateRoomOptions,
  type GameConfig,
  type GameFamily,
  type GameMode,
  type PhaseTimers,
  type RoleCode,
  type RoleDistribution,
  type RolePreset,
  type RoleValidationCode,
  type RoleValidationIssue,
} from "@werewolf/shared";
import { randomRoomName } from "@/lib/roomname-generator";
import type { AdvancedFlags, LobbyFormState } from "./types";

export function currentConfig(state: LobbyFormState): GameConfig {
  return createGameConfigFromOptions(optionsFromState(state));
}

export function optionsFromState(state: LobbyFormState): CreateRoomOptions {
  const base: CreateRoomOptions = {
    ...state.preservedOptions,
    mode: state.mode,
    ...(state.roomName.trim() ? { roomName: state.roomName.trim() } : {}),
    playerCount: boundedPlayerCount(state),
    maxPlayers: Math.max(state.advanced.maxPlayers, boundedPlayerCount(state)),
    communicationMode: state.communicationMode,
    narratorMode: state.narratorMode,
    tempoProfile: state.tempoProfile,
    ...(state.tempoProfile === "manual" ? { customTimers: state.customTimers } : {}),
    rolePreset: state.manualRolesEnabled ? "manual" : state.rolePreset,
    revealRolesOnDeath: state.advanced.revealRolesOnDeath,
    allowSkipVote: state.advanced.allowSkipVote,
    majorityMode: state.advanced.majorityMode,
    autoStart: state.advanced.autoStart,
    loversEnabled: state.manualRolesEnabled
      ? (state.manualRoles.cupid ?? 0) > 0
      : state.advanced.loversEnabled,
    mafiaNightKill: state.advanced.mafiaNightKill,
    doctorCanSelfProtect: state.advanced.doctorCanSelfProtect,
    commissionerResultMode: state.advanced.commissionerResultMode,
    maniacEnabled: state.advanced.maniacEnabled,
    jesterEnabled: state.advanced.jesterEnabled,
    narratorVoice: state.advanced.narratorVoice,
  };

  return state.manualRolesEnabled ? { ...base, roles: state.manualRoles } : base;
}

export function boundedPlayerCount(state: LobbyFormState) {
  return clampPlayerCount(state.mode, state.playerCount);
}

export function roleWarnings(state: LobbyFormState) {
  const config = currentConfig(state);
  return validateRoleDistributionForMode(state.mode, config.playerCount, config.roles);
}

export function roleWarningIssues(state: LobbyFormState): RoleValidationIssue[] {
  const config = currentConfig(state);
  return validateRoleDistributionIssuesForMode(state.mode, config.playerCount, config.roles);
}

const CRITICAL_ROLE_WARNING_CODES = new Set<RoleValidationCode>([
  "ROLE_COUNT_MISMATCH",
  "ROLE_WRONG_FAMILY",
  "THREAT_MISSING",
  "WEREWOLVES_TOO_FEW",
  "VILLAGERS_TOO_FEW",
  "ROLE_DEPENDENCY_MISSING",
  "DUAL_FACTION_MINIMUM",
  "MAYOR_MODE_REQUIRED",
  "MAFIA_MISSING",
  "COMMISSIONER_MISSING",
]);

export function criticalRoleWarnings(state: LobbyFormState) {
  return roleWarningIssues(state)
    .filter((issue) => CRITICAL_ROLE_WARNING_CODES.has(issue.code))
    .map((issue) => issue.messageBg);
}

export function roleTotal(state: LobbyFormState) {
  return countRoles(currentConfig(state).roles);
}

export function roleBalance(state: LobbyFormState) {
  return getRoleBalanceScore(currentConfig(state).roles);
}

type ManualRoleRosterAdjustment = {
  status: "changed" | "replacement-required" | "unchanged";
  roles: RoleDistribution;
  addedRole?: RoleCode;
  removedRole?: RoleCode;
};

export function adjustManualRoleRoster({
  family,
  roles,
  playerCount,
  role,
  delta,
}: {
  family: GameFamily;
  roles: RoleDistribution;
  playerCount: number;
  role: RoleCode;
  delta: -1 | 1;
}): ManualRoleRosterAdjustment {
  const reserveRole: RoleCode = family === "werewolves" ? "ordinary_villager" : "civilian";
  const currentCount = roles[role] ?? 0;
  const total = countRoles(roles);
  const maxCopies = ROLE_DEFINITIONS[role].maxCopies;

  if (delta > 0 && currentCount >= maxCopies) {
    return { status: "unchanged", roles };
  }
  if (delta < 0 && (currentCount <= 0 || role === reserveRole)) {
    return { status: "unchanged", roles };
  }

  if (delta > 0 && total >= playerCount) {
    const reserveCount = roles[reserveRole] ?? 0;
    if (role === reserveRole || reserveCount <= 0) {
      return { status: "replacement-required", roles };
    }

    return {
      status: "changed",
      roles: cleanRoles({
        ...roles,
        [reserveRole]: reserveCount - 1,
        [role]: currentCount + 1,
      }),
      addedRole: role,
      removedRole: reserveRole,
    };
  }

  if (delta < 0) {
    const shouldRestoreReserve = total === playerCount;
    return {
      status: "changed",
      roles: cleanRoles({
        ...roles,
        [role]: currentCount - 1,
        ...(shouldRestoreReserve ? { [reserveRole]: (roles[reserveRole] ?? 0) + 1 } : {}),
      }),
      ...(shouldRestoreReserve ? { addedRole: reserveRole } : {}),
      removedRole: role,
    };
  }

  return {
    status: "changed",
    roles: cleanRoles({ ...roles, [role]: currentCount + 1 }),
    addedRole: role,
  };
}

export function replaceManualRoleInRoster({
  roles,
  addRole,
  removeRole,
}: {
  roles: RoleDistribution;
  addRole: RoleCode;
  removeRole: RoleCode;
}): RoleDistribution {
  if (addRole === removeRole || (roles[removeRole] ?? 0) <= 0) {
    return roles;
  }

  return cleanRoles({
    ...roles,
    [addRole]: (roles[addRole] ?? 0) + 1,
    [removeRole]: (roles[removeRole] ?? 0) - 1,
  });
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
  if (mode === "mafia_sport") {
    return 10;
  }
  if (mode === "werewolves_classic") {
    return 12;
  }
  return 10;
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

export function loversAvailableFor(mode: GameMode, playerCount: number, rolePreset: RolePreset) {
  return mode === "werewolves_classic" && playerCount >= 9 && rolePreset !== "beginner" && rolePreset !== "manual";
}

export function availableModes(family: GameFamily): GameMode[] {
  return (Object.keys(GAME_MODE_DEFINITIONS) as GameMode[]).filter((mode) => getGameFamily(mode) === family);
}

export function defaultRoomName(mode: GameMode) {
  return randomRoomName(getGameFamily(mode));
}

export function createRoomCode(
  fillRandomValues: (values: Uint32Array) => Uint32Array = (values) => globalThis.crypto.getRandomValues(values),
) {
  const values = fillRandomValues(new Uint32Array(ROOM_CODE_LENGTH));
  return Array.from(
    values,
    (value) => ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length],
  ).join("");
}

export function cleanRoomCode(code: string) {
  return normalizeRoomCodeInput(code);
}

export function estimatedDurationSeconds(state: LobbyFormState) {
  const timers = timersForState(state);
  const rounds = Math.max(2, Math.ceil(boundedPlayerCount(state) / 2));
  const discussionSeconds =
    state.mode === "mafia_sport"
      ? timers.playerSpeechSeconds * boundedPlayerCount(state)
      : timers.dayDiscussionSeconds;
  return (
    timers.roleRevealSeconds +
    rounds * (discussionSeconds + timers.voteSeconds + timers.factionNightActionSeconds + timers.resolutionSeconds)
  );
}

export function timersForState(state: Pick<LobbyFormState, "tempoProfile" | "customTimers">) {
  return state.tempoProfile === "manual" ? state.customTimers : resolvePhaseTimers(state.tempoProfile);
}

export function formatEstimatedDuration(seconds: number) {
  return `~${Math.max(5, Math.round(seconds / 60))} мин`;
}

export function defaultAdvanced(mode: GameMode, playerCount: number): AdvancedFlags {
  const config = createGameConfigFromOptions({ mode, playerCount, rolePreset: defaultRolePreset(mode) });
  const rolePreset = defaultRolePreset(mode);
  return {
    revealRolesOnDeath: config.revealRolesOnDeath,
    allowSkipVote: config.allowSkipVote,
    autoStart: config.autoStart,
    majorityMode: config.majorityMode,
    loversEnabled: defaultLoversEnabled(mode, playerCount, rolePreset) || config.loversEnabled,
    mafiaNightKill: config.mafiaNightKill,
    doctorCanSelfProtect: config.doctorCanSelfProtect,
    commissionerResultMode: config.commissionerResultMode,
    maniacEnabled: config.maniacEnabled,
    jesterEnabled: config.jesterEnabled,
    narratorVoice: config.narratorVoice,
    maxPlayers: Math.max(config.maxPlayers, playerCount),
  };
}

export function presetRoles(
  mode: GameMode,
  playerCount: number,
  rolePreset: RolePreset,
  advanced: AdvancedFlags,
): RoleDistribution {
  return createGameConfigFromOptions({
    mode,
    playerCount,
    rolePreset,
    loversEnabled: advanced.loversEnabled,
    maniacEnabled: advanced.maniacEnabled,
    jesterEnabled: advanced.jesterEnabled,
  }).roles;
}

export function normalizeAdvancedForPreset(
  mode: GameMode,
  playerCount: number,
  rolePreset: RolePreset,
  advanced: AdvancedFlags,
): AdvancedFlags {
  const boundedAdvanced = {
    ...advanced,
    maxPlayers: Math.max(advanced.maxPlayers, playerCount),
  };
  if (!loversAvailableFor(mode, playerCount, rolePreset)) {
    return { ...boundedAdvanced, loversEnabled: false };
  }
  return boundedAdvanced;
}

export function defaultLoversEnabled(mode: GameMode, playerCount: number, rolePreset: RolePreset) {
  return mode === "werewolves_classic" && rolePreset === "classic" && playerCount >= 9;
}

export function clampPlayerCount(mode: GameMode, value: number) {
  const range = playerRange(mode);
  const safeValue = Number.isFinite(value) ? value : defaultPlayerCount(mode);
  return Math.min(range.max, Math.max(range.min, Math.round(safeValue)));
}

export function defaultModeForFamily(family: GameFamily): GameMode {
  return family === "mafia" ? "mafia_free" : "werewolves_classic";
}

export function isGameMode(value: unknown): value is GameMode {
  return typeof value === "string" && value in GAME_MODE_DEFINITIONS;
}

export function cleanRoles(distribution: RoleDistribution): RoleDistribution {
  const cleaned: RoleDistribution = {};
  for (const [role, count] of Object.entries(distribution) as [RoleCode, number | undefined][]) {
    if (count && count > 0) {
      cleaned[role] = Math.floor(count);
    }
  }
  return cleaned;
}

export function manualTimersFrom(timers: Partial<PhaseTimers> | undefined) {
  return normalizePhaseTimers(timers, TEMPO_PRESETS.manual);
}
