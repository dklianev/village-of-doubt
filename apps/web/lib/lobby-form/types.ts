import type {
  CommunicationMode,
  CommissionerResultMode,
  CreateRoomOptions,
  GameFamily,
  GameMode,
  MajorityMode,
  NarratorMode,
  NarratorVoice,
  PhaseTimers,
  RoleCode,
  RoleDistribution,
  RolePreset,
  TempoProfile,
} from "@werewolf/shared";

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
export type PreservedCreateOptions = Partial<
  Pick<
    CreateRoomOptions,
    | "roomVisibility"
    | "beginnerMode"
    | "advancedMode"
    | "werewolfVariant"
    | "mayorMode"
    | "promoRolesEnabled"
    | "spectator"
  >
>;
export type CustomTimerKey =
  | "dayDiscussionSeconds"
  | "factionNightActionSeconds"
  | "voteSeconds"
  | "autoAdvanceWhenReady";

export type LobbyFormState = {
  step: LobbyStep;
  visitedStep: LobbyStep;
  lockedFamily: GameFamily | undefined;
  family: GameFamily;
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
  preservedOptions: PreservedCreateOptions;
  communicationMode: CommunicationMode;
  narratorMode: NarratorMode;
  tempoProfile: TempoProfile;
  customTimers: PhaseTimers;
  customTimersTouched: boolean;
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
  tempoProfile?: TempoProfile;
  communicationMode?: CommunicationMode;
  narratorMode?: NarratorMode;
  advanced?: Partial<AdvancedFlags>;
  step?: LobbyStep;
};

export type LobbyFormAction =
  | { type: "SET_STEP"; step: LobbyStep }
  | { type: "NEXT_STEP" }
  | { type: "PREVIOUS_STEP" }
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
  | { type: "SET_CUSTOM_TIMER"; key: CustomTimerKey; value: number | boolean }
  | { type: "SET_ADVANCED"; key: keyof AdvancedFlags; value: AdvancedFlags[keyof AdvancedFlags] }
  | { type: "SET_ROLE_SEARCH"; query: string }
  | { type: "SET_RUNTIME_FILTER"; runtimeFilter: RuntimeFilter }
  | { type: "SET_ROLE_DETAIL"; roleDetail: RoleDetailState }
  | { type: "SET_MOBILE_SUMMARY_OPEN"; open: boolean }
  | { type: "SET_INVITE_SHEET_OPEN"; open: boolean }
  | { type: "TRIGGER_CONFETTI" }
  | { type: "APPLY_TEMPLATE"; template: LobbyTemplate };
