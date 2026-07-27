import type {
  CommissionerResultMode,
  CommunicationMode,
  GameMode,
  MajorityMode,
  MayorMode,
  NarratorMode,
  NarratorVoice,
  PhaseTimers,
  RoleDistribution,
  RolePreset,
  RoomVisibility,
  TempoProfile,
  TieBreaker,
  WerewolfVariant,
} from "./game-config.js";
import type { RoleCode } from "./roles.js";

export type GamePhase =
  | "lobby"
  | "role_reveal"
  | "first_night"
  | "night"
  | "day_announcement"
  | "day_discussion"
  | "nomination"
  | "defense"
  | "voting"
  | "resolution"
  | "hunter_revenge"
  | "mayor_successor"
  | "paused"
  | "game_over";

export interface CreateRoomOptions {
  code?: string;
  mode?: GameMode;
  roomName?: string;
  playerCount?: number;
  maxPlayers?: number;
  roomVisibility?: RoomVisibility;
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
  spectator?: boolean;
  roles?: RoleDistribution;
}

export interface JoinRoomOptions extends CreateRoomOptions {
  userId: string;
  displayName: string;
  avatarId?: string;
  token?: string;
}

export type ClientCommand =
  | { type: "ready"; ready: boolean }
  | { type: "startGame" }
  | { type: "submitNightAction"; action: NightActionCommand }
  | { type: "submitNomination"; targetUserId: string }
  | { type: "submitVote"; targetUserId: string }
  | { type: "submitHunterRevenge"; targetUserId: string }
  | { type: "sendChat"; channel: ChatChannel; message: string }
  | { type: "typing"; channel: ChatChannel; active: boolean }
  | { type: "setNarrator"; targetUserId: string; narrator: boolean }
  | { type: "setMayor"; targetUserId: string }
  | { type: "acceptFullNarrator" }
  | { type: "narratorPause"; reason?: string }
  | { type: "narratorAdvance" }
  | { type: "narratorExtendTimer"; seconds: number };

export type ChatChannel = "public" | "mafia" | "werewolves" | "vampires" | "dead" | "system";

export type NightActionCommand =
  | { kind: "faction_kill"; targetUserId: string }
  | { kind: "check_alignment"; targetUserId: string }
  | { kind: "check_role"; targetUserId: string }
  | { kind: "check_commissioner"; targetUserId: string }
  | { kind: "investigator_check"; targetUserId: string }
  | { kind: "witch_heal"; targetUserId: string }
  | { kind: "witch_poison"; targetUserId: string }
  | { kind: "healer_protect"; targetUserId: string }
  | { kind: "priest_bless"; targetUserId: string }
  | { kind: "blacksmith_sword"; receiverUserId: string; targetUserId: string }
  | { kind: "stray_cat_choose"; targetUserId: string }
  | { kind: "thief_steal"; targetUserId: string }
  | { kind: "cupid_link"; firstUserId: string; secondUserId: string }
  | { kind: "roleblock"; targetUserId: string }
  | { kind: "lawyer_cover"; targetUserId: string }
  | { kind: "medium_contact"; targetUserId: string }
  | { kind: "skip" };

export type NightActionKind = NightActionCommand["kind"];

export function parseClientCommand(type: unknown, payload: unknown): ClientCommand | null {
  if (typeof type !== "string") {
    return null;
  }

  const data = isRecord(payload) ? payload : undefined;
  switch (type) {
    case "ready":
      return data && typeof data.ready === "boolean" ? { type, ready: data.ready } : null;
    case "startGame":
    case "acceptFullNarrator":
    case "narratorAdvance":
      return payload === undefined || data ? { type } : null;
    case "submitNightAction": {
      const action = parseNightActionCommand(data?.action);
      return action ? { type, action } : null;
    }
    case "submitNomination":
    case "submitVote":
    case "submitHunterRevenge":
    case "setMayor":
      return data && isNonEmptyString(data.targetUserId) ? { type, targetUserId: data.targetUserId } : null;
    case "sendChat":
      return data && isChatChannel(data.channel) && typeof data.message === "string"
        ? { type, channel: data.channel, message: data.message }
        : null;
    case "typing":
      return data && isChatChannel(data.channel) && typeof data.active === "boolean"
        ? { type, channel: data.channel, active: data.active }
        : null;
    case "setNarrator":
      return data && isNonEmptyString(data.targetUserId) && typeof data.narrator === "boolean"
        ? { type, targetUserId: data.targetUserId, narrator: data.narrator }
        : null;
    case "narratorPause":
      if (payload === undefined) {
        return { type };
      }
      return data && (data.reason === undefined || typeof data.reason === "string")
        ? { type, ...(typeof data.reason === "string" ? { reason: data.reason } : {}) }
        : null;
    case "narratorExtendTimer":
      return data && typeof data.seconds === "number" && Number.isFinite(data.seconds)
        ? { type, seconds: data.seconds }
        : null;
    default:
      return null;
  }
}

export function parseNightActionCommand(value: unknown): NightActionCommand | null {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return null;
  }

  if (value.kind === "skip") {
    return { kind: "skip" };
  }
  if (value.kind === "blacksmith_sword") {
    return isNonEmptyString(value.receiverUserId) && isNonEmptyString(value.targetUserId)
      ? { kind: value.kind, receiverUserId: value.receiverUserId, targetUserId: value.targetUserId }
      : null;
  }
  if (value.kind === "cupid_link") {
    return isNonEmptyString(value.firstUserId) && isNonEmptyString(value.secondUserId)
      ? { kind: value.kind, firstUserId: value.firstUserId, secondUserId: value.secondUserId }
      : null;
  }
  if (!isTargetedNightActionKind(value.kind) || !isNonEmptyString(value.targetUserId)) {
    return null;
  }

  return { kind: value.kind, targetUserId: value.targetUserId };
}

function isTargetedNightActionKind(kind: string): kind is Exclude<NightActionKind, "blacksmith_sword" | "cupid_link" | "skip"> {
  return TARGETED_NIGHT_ACTION_KINDS.has(kind as Exclude<NightActionKind, "blacksmith_sword" | "cupid_link" | "skip">);
}

const TARGETED_NIGHT_ACTION_KINDS = new Set<Exclude<NightActionKind, "blacksmith_sword" | "cupid_link" | "skip">>([
  "faction_kill",
  "check_alignment",
  "check_role",
  "check_commissioner",
  "investigator_check",
  "witch_heal",
  "witch_poison",
  "healer_protect",
  "priest_bless",
  "stray_cat_choose",
  "thief_steal",
  "roleblock",
  "lawyer_cover",
  "medium_contact",
]);

function isChatChannel(value: unknown): value is ChatChannel {
  return value === "public" || value === "mafia" || value === "werewolves" || value === "vampires" || value === "dead" || value === "system";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export interface NightActionCapabilityReason {
  reasonBg: string;
}

export interface NightActionDisallowedTarget {
  id: string;
  reasonBg: string;
}

export interface NightActionCapabilities {
  availableKinds: NightActionKind[];
  usedFlags: Partial<Record<NightActionKind, NightActionCapabilityReason>>;
  disallowedTargetsByKind: Partial<Record<NightActionKind, NightActionDisallowedTarget[]>>;
  /**
   * Missing kind means unrestricted. An empty list means the action is
   * available, but no valid target exists yet.
   */
  allowedTargetIdsByKind?: Partial<Record<NightActionKind, string[]>>;
}

export interface PrivateFactionMember {
  userId: string;
  displayName: string;
}

export interface PrivateFactionRoster {
  faction: "mafia" | "werewolves";
  members: PrivateFactionMember[];
}

export interface PrivateCheckResult {
  targetUserId: string;
  targetUserIds?: string[];
  role?: RoleCode;
  isEvil?: boolean;
  isCommissioner?: boolean;
  messageBg?: string;
}

export type ServerEvent =
  | { type: "private_role"; role: RoleCode; roleNameBg: string }
  | {
      type: "narrator_role_snapshot";
      roles: Array<{ userId: string; displayName: string; role: RoleCode; roleNameBg: string }>;
    }
  | { type: "private_lovers"; loverUserId: string; loverName: string }
  | { type: "private_blessing"; targetUserId: string; targetName: string }
  | ({ type: "private_faction_roster" } & PrivateFactionRoster)
  | { type: "night_action_capabilities"; capabilities: NightActionCapabilities }
  | ({ type: "private_check_result" } & PrivateCheckResult)
  | {
      type: "private_chat";
      channel: ChatChannel;
      senderUserId: string;
      senderName: string;
      message: string;
      createdAt: number;
    }
  | {
      type: "typing";
      channel: ChatChannel;
      senderUserId: string;
      senderName: string;
      active: boolean;
      createdAt: number;
    }
  | { type: "achievements_unlocked"; achievementIds: string[] }
  | { type: "night_action_ack"; phase: GamePhase; round: number }
  | { type: "nomination_ack"; phase: GamePhase; round: number; targetUserId: string; replaced: boolean }
  | { type: "vote_ack"; phase: GamePhase; round: number; targetUserId: string }
  | { type: "hunter_revenge_ack"; phase: GamePhase; round: number; targetUserId: string }
  | { type: "safe_error"; messageBg: string }
  | { type: "system"; messageBg: string };
