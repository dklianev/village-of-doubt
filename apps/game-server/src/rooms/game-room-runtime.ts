import { createHash, randomInt } from "node:crypto";
import type { Client } from "colyseus";
import {
  getRoleTeam,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type ClientCommand,
  type ChatChannel,
  type GameConfig,
  type GamePhase,
  type NightActionCommand,
  type RoleCode,
  type AvatarId,
} from "@werewolf/shared";

export interface ClientAuth {
  userId: string;
  displayName: string;
  avatarId: AvatarId;
  tokenNonce?: string;
  tokenExpiresAtMs?: number;
  tokenNonceConsumed?: boolean;
}

export interface PrivatePlayerState {
  userId: string;
  role?: RoleCode;
  alive: boolean;
  loverId?: string | null;
  witchHealUsed?: boolean;
  witchPoisonUsed?: boolean;
  priestBlessUsed?: boolean;
  priestBlessed?: boolean;
  priestBlessedTargetUserId?: string;
  blacksmithUsed?: boolean;
  investigatorUsed?: boolean;
  vampireHunterDisarmed?: boolean;
  drunkRealRole?: RoleCode;
  lastResolvedHealerTargetUserId?: string;
  lastVoteTarget?: string;
  isMayor?: boolean;
  deathRound?: number;
  deathCause?: string;
}

export const MAX_PUBLIC_EVENTS = 120;
export const MAX_PUBLIC_CHAT = 80;

type CommandRateBucket = "action" | "control" | "typing";

const COMMAND_RATE_POLICIES: Record<CommandRateBucket, { limit: number; windowMs: number }> = {
  action: { limit: 12, windowMs: 5_000 },
  control: { limit: 30, windowMs: 5_000 },
  typing: { limit: 20, windowMs: 5_000 },
};

export class CommandRateLimiter {
  private attempts = new Map<string, Map<CommandRateBucket, number[]>>();

  allow(userId: string, commandType: ClientCommand["type"], now = Date.now()) {
    if (commandType === "sendChat") {
      return true;
    }

    return this.allowBucket(userId, commandBucket(commandType), now);
  }

  allowInvalid(userId: string, now = Date.now()) {
    return this.allowBucket(userId, "control", now);
  }

  private allowBucket(userId: string, bucket: CommandRateBucket, now: number) {
    const policy = COMMAND_RATE_POLICIES[bucket];
    const userAttempts = this.attempts.get(userId) ?? new Map<CommandRateBucket, number[]>();
    const cutoff = now - policy.windowMs;
    const recent = (userAttempts.get(bucket) ?? []).filter((timestamp) => timestamp > cutoff);
    if (recent.length >= policy.limit) {
      userAttempts.set(bucket, recent);
      this.attempts.set(userId, userAttempts);
      return false;
    }

    recent.push(now);
    userAttempts.set(bucket, recent);
    this.attempts.set(userId, userAttempts);
    return true;
  }

  delete(userId: string) {
    this.attempts.delete(userId);
  }

  clear() {
    this.attempts.clear();
  }
}

function commandBucket(commandType: ClientCommand["type"]): CommandRateBucket {
  if (commandType === "typing") {
    return "typing";
  }
  if (
    commandType === "submitNightAction"
    || commandType === "submitNomination"
    || commandType === "submitVote"
    || commandType === "submitHunterRevenge"
  ) {
    return "action";
  }
  return "control";
}

export const PHASE_FLOW: Partial<Record<GamePhase, GamePhase>> = {
  role_reveal: "first_night",
  first_night: "day_announcement",
  night: "day_announcement",
  day_announcement: "day_discussion",
  day_discussion: "voting",
  voting: "resolution",
  resolution: "night",
};

export function hashRoomCode(code: string): string {
  return createHash("sha256").update(code).digest("hex").slice(0, 8);
}

export function getAuth(client: Client): ClientAuth | undefined {
  return client.userData as ClientAuth | undefined;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNightPhase(phase: string): phase is "first_night" | "night" {
  return phase === "first_night" || phase === "night";
}

export function getActionTargetUserId(action: NightActionCommand): string | null {
  switch (action.kind) {
    case "faction_kill":
    case "check_alignment":
    case "check_role":
    case "check_commissioner":
    case "witch_heal":
    case "witch_poison":
    case "healer_protect":
    case "priest_bless":
    case "investigator_check":
    case "stray_cat_choose":
    case "thief_steal":
    case "roleblock":
    case "lawyer_cover":
    case "medium_contact":
      return action.targetUserId;
    case "blacksmith_sword":
      return action.targetUserId;
    case "cupid_link":
      return action.firstUserId;
    case "skip":
      return null;
  }
}

export function parseChatChannel(channel: string): ChatChannel | null {
  return channel === "public" ||
    channel === "mafia" ||
    channel === "werewolves" ||
    channel === "vampires" ||
    channel === "dead" ||
    channel === "system"
    ? channel
    : null;
}

export function normalizeChatMessage(message: unknown): string {
  if (typeof message !== "string") {
    throw new Error("Невалидно съобщение.");
  }
  return message.slice(0, 500);
}

export function ensureNightActionAllowed(role: RoleCode, action: NightActionCommand, phase: string): void {
  const team = getRoleTeam(role);
  const allowed =
    action.kind === "skip" ||
    (action.kind === "faction_kill" &&
      (team === "mafia" ||
        team === "werewolves" ||
        team === "vampires" ||
        role === "vigilante" ||
        role === "maniac" ||
        role === "vampire_hunter")) ||
    (action.kind === "check_alignment" && (role === "commissioner" || role === "detective")) ||
    (action.kind === "check_role" && (role === "seer" || role === "oracle" || role === "informant")) ||
    (action.kind === "check_commissioner" && role === "don") ||
    (action.kind === "investigator_check" && role === "investigator") ||
    (action.kind === "witch_heal" && role === "witch") ||
    (action.kind === "witch_poison" && role === "witch") ||
    (action.kind === "healer_protect" && (role === "healer" || role === "doctor" || role === "bodyguard")) ||
    (action.kind === "priest_bless" && role === "priest") ||
    (action.kind === "blacksmith_sword" && role === "blacksmith") ||
    (action.kind === "stray_cat_choose" && role === "stray_cat") ||
    (action.kind === "thief_steal" && role === "thief" && phase === "first_night") ||
    (action.kind === "cupid_link" && (role === "cupid" || role === "lovers") && phase === "first_night") ||
    (action.kind === "roleblock" && role === "roleblocker") ||
    (action.kind === "lawyer_cover" && role === "lawyer") ||
    (action.kind === "medium_contact" && role === "medium");

  if (!allowed) {
    throw new Error("Тази роля няма право на това нощно действие.");
  }
}

export function generateRoomCode() {
  return Array.from(
    { length: ROOM_CODE_LENGTH },
    () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)],
  ).join("");
}

export function chooseDrunkRealRole(roles: Partial<Record<RoleCode, number>>): RoleCode {
  const preferred: RoleCode[] = [
    "ordinary_villager",
    "healer",
    "hunter",
    "seer",
    "witch",
    "oracle",
    "priest",
    "cook",
    "red_riding_hood",
  ];
  return preferred.find((role) => (roles[role] ?? 0) > 0 && role !== "drunk") ?? "ordinary_villager";
}

export function areLivingNightActorsReady(
  privatePlayers: Iterable<PrivatePlayerState>,
  phase: string,
  hasPendingNightAction: (actorUserId: string, kind?: NightActionCommand["kind"]) => boolean,
  isFactionKillAllowed: (privatePlayer: PrivatePlayerState) => boolean = () => true,
) {
  return [...privatePlayers].every((privatePlayer) => {
    if (!privatePlayer.alive || !privatePlayer.role) {
      return true;
    }
    const team = getRoleTeam(privatePlayer.role);
    if (privatePlayer.role === "witch") {
      return (
        hasPendingNightAction(privatePlayer.userId, "skip") ||
        ((privatePlayer.witchHealUsed || hasPendingNightAction(privatePlayer.userId, "witch_heal")) &&
          (privatePlayer.witchPoisonUsed || hasPendingNightAction(privatePlayer.userId, "witch_poison")))
      );
    }
    if (privatePlayer.role === "don") {
      return hasPendingNightAction(privatePlayer.userId, "skip") || (
        hasPendingNightAction(privatePlayer.userId, "check_commissioner") &&
        (!isFactionKillAllowed(privatePlayer) || hasPendingNightAction(privatePlayer.userId, "faction_kill"))
      );
    }
    const needsAction =
      team === "mafia" ||
      team === "werewolves" ||
      team === "vampires" ||
      privatePlayer.role === "seer" ||
      privatePlayer.role === "oracle" ||
      privatePlayer.role === "commissioner" ||
      privatePlayer.role === "healer" ||
      privatePlayer.role === "doctor" ||
      privatePlayer.role === "bodyguard" ||
      privatePlayer.role === "detective" ||
      privatePlayer.role === "vigilante" ||
      privatePlayer.role === "maniac" ||
      privatePlayer.role === "roleblocker" ||
      privatePlayer.role === "lawyer" ||
      privatePlayer.role === "informant" ||
      privatePlayer.role === "medium" ||
      (privatePlayer.role === "vampire_hunter" && !privatePlayer.vampireHunterDisarmed) ||
      (privatePlayer.role === "blacksmith" && !privatePlayer.blacksmithUsed) ||
      (privatePlayer.role === "investigator" && !privatePlayer.investigatorUsed) ||
      privatePlayer.role === "stray_cat" ||
      (privatePlayer.role === "priest" && !privatePlayer.priestBlessUsed) ||
      (privatePlayer.role === "thief" && phase === "first_night") ||
      ((privatePlayer.role === "cupid" || privatePlayer.role === "lovers") && phase === "first_night");

    return !needsAction || hasPendingNightAction(privatePlayer.userId);
  });
}

export function haveLivingPlayersVoted(
  privatePlayers: Iterable<PrivatePlayerState>,
  findPlayerByUserId: (userId: string) => { hasVoted?: boolean } | undefined,
) {
  return [...privatePlayers].every((privatePlayer) => {
    const publicPlayer = findPlayerByUserId(privatePlayer.userId);
    return !privatePlayer.alive || Boolean(publicPlayer?.hasVoted);
  });
}

export function getPhaseDurationMs(config: GameConfig, phase: GamePhase) {
  const timers = config.timers;
  if (config.mode === "mafia_sport") {
    if (phase === "day_discussion" || phase === "defense") {
      return timers.playerSpeechSeconds * 1000;
    }
    if (phase === "nomination") {
      return timers.resolutionSeconds * 1000;
    }
  }

  const seconds =
    phase === "role_reveal"
      ? timers.roleRevealSeconds
      : isNightPhase(phase)
        ? timers.factionNightActionSeconds
        : phase === "day_discussion"
          ? timers.dayDiscussionSeconds
          : phase === "voting"
            ? timers.voteSeconds
            : phase === "resolution" || phase === "day_announcement"
              ? timers.resolutionSeconds
              : 0;

  return seconds * 1000;
}
