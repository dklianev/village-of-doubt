import type {
  CommissionerResultMode,
  CommunicationMode,
  GameMode,
  MajorityMode,
  MayorMode,
  NarratorMode,
  RoleDistribution,
  RolePreset,
  RoomVisibility,
  TempoProfile,
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
  loversEnabled?: boolean;
  revealRolesOnDeath?: boolean;
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
  roles?: RoleDistribution;
}

export interface JoinRoomOptions extends CreateRoomOptions {
  userId: string;
  displayName: string;
  token?: string;
}

export type ClientCommand =
  | { type: "ready"; ready: boolean }
  | { type: "startGame" }
  | { type: "submitNightAction"; action: NightActionCommand }
  | { type: "submitVote"; targetUserId: string }
  | { type: "submitHunterRevenge"; targetUserId: string }
  | { type: "sendChat"; channel: ChatChannel; message: string }
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
  | { kind: "witch_heal"; targetUserId: string }
  | { kind: "witch_poison"; targetUserId: string }
  | { kind: "healer_protect"; targetUserId: string }
  | { kind: "priest_bless"; targetUserId: string }
  | { kind: "thief_steal"; targetUserId: string }
  | { kind: "cupid_link"; firstUserId: string; secondUserId: string }
  | { kind: "skip" };

export type ServerEvent =
  | { type: "private_role"; role: RoleCode; roleNameBg: string }
  | {
      type: "narrator_role_snapshot";
      roles: Array<{ userId: string; displayName: string; role: RoleCode; roleNameBg: string }>;
    }
  | { type: "private_lovers"; loverUserId: string; loverName: string }
  | { type: "private_blessing"; targetUserId: string; targetName: string }
  | {
      type: "private_check_result";
      targetUserId: string;
      role?: RoleCode;
      isEvil?: boolean;
      isCommissioner?: boolean;
    }
  | {
      type: "private_chat";
      channel: ChatChannel;
      senderUserId: string;
      senderName: string;
      message: string;
      createdAt: number;
    }
  | { type: "safe_error"; messageBg: string }
  | { type: "system"; messageBg: string };
