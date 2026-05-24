import { createHash } from "node:crypto";
import {
  getRoleTeam,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type ChatChannel,
  type GamePhase,
  type NightActionCommand,
  type RoleCode,
} from "@werewolf/shared";
import type { Client } from "colyseus";

export interface ClientAuth {
  userId: string;
  displayName: string;
}

export const MAX_PUBLIC_EVENTS = 120;
export const MAX_PUBLIC_CHAT = 80;

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
    () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)],
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

export function getGameTokenSecret() {
  const secret =
    process.env.GAME_TOKEN_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    "dev-only-secret-replace-before-production-32-chars";

  if (process.env.NODE_ENV === "production" && (!process.env.GAME_TOKEN_SECRET || !isProductionSecret(secret))) {
    throw new Error("GAME_TOKEN_SECRET трябва да е реална production тайна от поне 32 символа.");
  }

  return secret;
}

export function isProductionSecret(secret: string) {
  return secret.length >= 32 && !/dev-only|replace|change-me|placeholder/i.test(secret);
}
