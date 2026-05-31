import type { Room } from "@colyseus/sdk";
import type { ChatChannel, GameMode, GamePhase, NarratorVoice, RoleCode } from "@werewolf/shared";

export interface PublicPlayer {
  userId: string;
  displayName: string;
  connected: boolean;
  ready: boolean;
  playing: boolean;
  alive: boolean;
  host: boolean;
  narrator: boolean;
  acceptedFullNarrator: boolean;
  mayor: boolean;
  hasVoted: boolean;
  actedThisPhase: boolean;
  revealedRole: string;
}

export interface PublicEvent {
  id: string;
  messageBg: string;
}

export interface PublicChatMessage {
  id: string;
  channel: string;
  senderName: string;
  message: string;
}

export interface PrivateChatMessage {
  channel: ChatChannel;
  senderUserId: string;
  senderName: string;
  message: string;
  createdAt: number;
}

export interface TypingNotice {
  channel: ChatChannel;
  senderUserId: string;
  senderName: string;
  active: boolean;
  createdAt: number;
}

export interface PublicRoleCount {
  role: RoleCode;
  count: number;
}

export interface VoteTallyItem {
  targetUserId: string;
  targetName: string;
  count: number;
  hasMayorVote: boolean;
}

export interface GameSnapshot {
  code: string;
  mode: GameMode;
  playerCount: number;
  narratorMode: string;
  communicationMode: string;
  tempoProfile: string;
  dayDiscussionSeconds: number;
  voteSeconds: number;
  revealRolesOnDeath: boolean;
  loversEnabled: boolean;
  doctorCanSelfProtect?: boolean;
  allowSkipVote: boolean;
  majorityMode: string;
  narratorVoice: NarratorVoice;
  phase: GamePhase;
  round: number;
  phaseEndsAt: number;
  winnerTeam: string;
  winnerReasonBg: string;
  players: PublicPlayer[];
  roleCounts: PublicRoleCount[];
  voteTally: VoteTallyItem[];
  publicEvents: PublicEvent[];
  publicChat: PublicChatMessage[];
}

export type PhaseSlice = {
  phase: GamePhase;
  round: number;
  phaseEndsAt: number;
};

export interface PrivateResult {
  targetUserId: string;
  targetUserIds?: string[];
  role?: RoleCode;
  isEvil?: boolean;
  isCommissioner?: boolean;
  messageBg?: string;
}

export interface PrivateLover {
  loverUserId: string;
  loverName: string;
}

export interface NarratorRoleSnapshot {
  roles: Array<{ userId: string; displayName: string; role: RoleCode; roleNameBg: string }>;
}

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "lost" | "error";
export type CueMode = "silent" | "visual" | "audio_vibration";

export type ShortcutState = {
  room: Room | null;
  phase: GamePhase;
  selectedTargetId: string;
  secondTargetId: string;
  privateRole: { role: RoleCode; roleNameBg: string } | null;
  players: PublicPlayer[];
  livingPlayers: PublicPlayer[];
  actionTargets: PublicPlayer[];
  currentUserId: string;
  ownPlayer: PublicPlayer | undefined;
  showShortcuts: boolean;
  liveMode: boolean;
};
