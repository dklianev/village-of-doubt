import type { GamePhase, NightActionCommand, RoleCode } from "@werewolf/shared";
import { canFactionKill } from "@/lib/play/role-rules";
import type { PublicPlayer } from "@/lib/play/types";

export function shortcutTargets(
  phase: GamePhase,
  privateRole: RoleCode | undefined,
  players: PublicPlayer[],
  livingPlayers: PublicPlayer[],
  currentUserId: string,
  options: { doctorCanSelfProtect?: boolean } = {},
) {
  const livingTargets = livingPlayers.filter((player) => player.userId !== currentUserId);
  const livingIncludingSelf = livingPlayers;

  if (phase === "voting" || phase === "hunter_revenge") {
    return livingTargets;
  }
  if (phase !== "first_night" && phase !== "night") {
    return [];
  }
  if (privateRole === "medium") {
    return players.filter((player) => player.playing && !player.alive && player.userId !== currentUserId);
  }
  if (!privateRole || !roleHasNightAction(privateRole, phase)) {
    return [];
  }

  if (canFactionKill(privateRole)) {
    return livingTargets;
  }

  if (
    privateRole === "commissioner"
    || privateRole === "detective"
    || privateRole === "informant"
    || privateRole === "seer"
    || privateRole === "oracle"
    || privateRole === "roleblocker"
    || privateRole === "lawyer"
    || privateRole === "don"
    || privateRole === "investigator"
    || privateRole === "healer"
    || privateRole === "bodyguard"
    || privateRole === "priest"
    || privateRole === "stray_cat"
    || (privateRole === "thief" && phase === "first_night")
  ) {
    return livingTargets;
  }

  if (privateRole === "blacksmith") {
    return livingIncludingSelf;
  }

  if ((privateRole === "cupid" || privateRole === "lovers") && phase === "first_night") {
    return livingIncludingSelf;
  }

  if (privateRole === "witch") {
    return livingIncludingSelf;
  }

  if (privateRole === "doctor") {
    return options.doctorCanSelfProtect ? livingIncludingSelf : livingTargets;
  }

  return [];
}

export function roleHasNightAction(role: RoleCode, phase: GamePhase) {
  return canFactionKill(role)
    || role === "commissioner"
    || role === "detective"
    || role === "informant"
    || role === "seer"
    || role === "oracle"
    || role === "roleblocker"
    || role === "lawyer"
    || role === "don"
    || role === "investigator"
    || role === "witch"
    || role === "healer"
    || role === "doctor"
    || role === "bodyguard"
    || role === "priest"
    || role === "blacksmith"
    || role === "stray_cat"
    || role === "medium"
    || (role === "thief" && phase === "first_night")
    || ((role === "cupid" || role === "lovers") && phase === "first_night");
}

export function needsSecondNightTarget(role: RoleCode | undefined, phase: GamePhase) {
  return role === "blacksmith" || ((role === "cupid" || role === "lovers") && phase === "first_night");
}

export function requiresExplicitNightActionChoice(role: RoleCode, _phase: GamePhase) {
  return role === "witch"
    || role === "don"
    || role === "informant"
    || role === "roleblocker"
    || role === "lawyer";
}

export function secondaryShortcutTargets(
  phase: GamePhase,
  privateRole: RoleCode | undefined,
  livingPlayers: PublicPlayer[],
  currentUserId: string,
  primaryTargetId: string,
) {
  if (!primaryTargetId || !needsSecondNightTarget(privateRole, phase)) {
    return [];
  }

  if (privateRole === "blacksmith") {
    return livingPlayers.filter(
      (player) => player.userId !== currentUserId && player.userId !== primaryTargetId,
    );
  }

  return livingPlayers.filter((player) => player.userId !== primaryTargetId);
}

export function buildPrimaryNightAction(
  role: RoleCode,
  targetUserId: string,
  secondTargetUserId: string,
  phase: GamePhase,
): NightActionCommand | null {
  if (!targetUserId) {
    return null;
  }

  if (requiresExplicitNightActionChoice(role, phase)) {
    return null;
  }

  if (canFactionKill(role)) {
    return { kind: "faction_kill", targetUserId };
  }
  if (role === "commissioner" || role === "detective") {
    return { kind: "check_alignment", targetUserId };
  }
  if (role === "seer" || role === "oracle") {
    return { kind: "check_role", targetUserId };
  }
  if (role === "medium") {
    return { kind: "medium_contact", targetUserId };
  }
  if (role === "investigator") {
    return { kind: "investigator_check", targetUserId };
  }
  if (role === "healer" || role === "doctor" || role === "bodyguard") {
    return { kind: "healer_protect", targetUserId };
  }
  if (role === "priest") {
    return { kind: "priest_bless", targetUserId };
  }
  if (role === "blacksmith" && secondTargetUserId) {
    return { kind: "blacksmith_sword", targetUserId, receiverUserId: secondTargetUserId };
  }
  if (role === "stray_cat") {
    return { kind: "stray_cat_choose", targetUserId };
  }
  if (role === "thief" && phase === "first_night") {
    return { kind: "thief_steal", targetUserId };
  }
  if ((role === "cupid" || role === "lovers") && phase === "first_night" && secondTargetUserId) {
    return { kind: "cupid_link", firstUserId: targetUserId, secondUserId: secondTargetUserId };
  }

  return null;
}
