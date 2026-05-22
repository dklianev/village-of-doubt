import type { GamePhase, NightActionCommand, RoleCode } from "@werewolf/shared";
import { canFactionKill } from "@/lib/play/role-rules";
import type { PublicPlayer } from "@/lib/play/types";

export function shortcutTargets(
  phase: GamePhase,
  privateRole: RoleCode | undefined,
  players: PublicPlayer[],
  livingPlayers: PublicPlayer[],
  currentUserId: string,
) {
  if (phase === "voting" || phase === "hunter_revenge") {
    return livingPlayers.filter((player) => player.userId !== currentUserId);
  }
  if (privateRole === "medium") {
    return players.filter((player) => player.playing && !player.alive);
  }
  return livingPlayers;
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

  if (canFactionKill(role)) {
    return { kind: "faction_kill", targetUserId };
  }
  if (role === "commissioner" || role === "detective") {
    return { kind: "check_alignment", targetUserId };
  }
  if (role === "informant" || role === "seer" || role === "oracle") {
    return { kind: "check_role", targetUserId };
  }
  if (role === "roleblocker") {
    return { kind: "roleblock", targetUserId };
  }
  if (role === "lawyer") {
    return { kind: "lawyer_cover", targetUserId };
  }
  if (role === "medium") {
    return { kind: "medium_contact", targetUserId };
  }
  if (role === "don") {
    return { kind: "check_commissioner", targetUserId };
  }
  if (role === "investigator") {
    return { kind: "investigator_check", targetUserId };
  }
  if (role === "witch") {
    return { kind: "witch_heal", targetUserId };
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
