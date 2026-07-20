import type { GamePhase, NightActionCapabilities, NightActionCommand, NightActionKind, RoleCode } from "@werewolf/shared";
import { canFactionKill } from "@/lib/play/role-rules";
import type { PublicPlayer } from "@/lib/play/types";

interface NightActionCapabilityOptions {
  nightActionCapabilities?: NightActionCapabilities | null | undefined;
}

export function shortcutTargets(
  phase: GamePhase,
  privateRole: RoleCode | undefined,
  players: PublicPlayer[],
  livingPlayers: PublicPlayer[],
  currentUserId: string,
  options: { doctorCanSelfProtect?: boolean } & NightActionCapabilityOptions = {},
) {
  const livingTargets = livingPlayers.filter((player) => player.userId !== currentUserId);
  const livingIncludingSelf = livingPlayers;
  const capabilityFilter = (targets: PublicPlayer[]) =>
    filterTargetsByCapabilities(targets, targetKindsForRole(privateRole, phase), options.nightActionCapabilities);

  if (phase === "voting" || phase === "hunter_revenge") {
    return livingTargets;
  }
  if (phase !== "first_night" && phase !== "night") {
    return [];
  }
  if (privateRole === "medium") {
    return capabilityFilter(players.filter((player) => player.playing && !player.alive && player.userId !== currentUserId));
  }
  if (!privateRole || !roleHasNightAction(privateRole, phase)) {
    return [];
  }

  if (canFactionKill(privateRole)) {
    return capabilityFilter(livingTargets);
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
    return capabilityFilter(livingTargets);
  }

  if (privateRole === "blacksmith") {
    return capabilityFilter(livingIncludingSelf);
  }

  if ((privateRole === "cupid" || privateRole === "lovers") && phase === "first_night") {
    return capabilityFilter(livingIncludingSelf);
  }

  if (privateRole === "witch") {
    return capabilityFilter(livingIncludingSelf);
  }

  if (privateRole === "doctor") {
    return capabilityFilter(options.doctorCanSelfProtect ? livingIncludingSelf : livingTargets);
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
  options: NightActionCapabilityOptions = {},
) {
  if (!primaryTargetId || !needsSecondNightTarget(privateRole, phase)) {
    return [];
  }

  if (privateRole === "blacksmith") {
    return filterTargetsByCapabilities(livingPlayers.filter(
      (player) => player.userId !== currentUserId && player.userId !== primaryTargetId,
    ), ["blacksmith_sword"], options.nightActionCapabilities);
  }

  return filterTargetsByCapabilities(
    livingPlayers.filter((player) => player.userId !== primaryTargetId),
    targetKindsForRole(privateRole, phase),
    options.nightActionCapabilities,
  );
}

export function buildPrimaryNightAction(
  role: RoleCode,
  targetUserId: string,
  secondTargetUserId: string,
  phase: GamePhase,
  options: NightActionCapabilityOptions = {},
): NightActionCommand | null {
  if (!targetUserId) {
    return null;
  }

  if (requiresExplicitNightActionChoice(role, phase)) {
    return null;
  }

  if (canFactionKill(role)) {
    if (!canUseNightKindForTarget("faction_kill", targetUserId, options.nightActionCapabilities)) {
      return null;
    }
    return { kind: "faction_kill", targetUserId };
  }
  if (role === "commissioner" || role === "detective") {
    if (!canUseNightKindForTarget("check_alignment", targetUserId, options.nightActionCapabilities)) {
      return null;
    }
    return { kind: "check_alignment", targetUserId };
  }
  if (role === "seer" || role === "oracle") {
    if (!canUseNightKindForTarget("check_role", targetUserId, options.nightActionCapabilities)) {
      return null;
    }
    return { kind: "check_role", targetUserId };
  }
  if (role === "medium") {
    if (!canUseNightKindForTarget("medium_contact", targetUserId, options.nightActionCapabilities)) {
      return null;
    }
    return { kind: "medium_contact", targetUserId };
  }
  if (role === "investigator") {
    if (!canUseNightKindForTarget("investigator_check", targetUserId, options.nightActionCapabilities)) {
      return null;
    }
    return { kind: "investigator_check", targetUserId };
  }
  if (role === "healer" || role === "doctor" || role === "bodyguard") {
    if (!canUseNightKindForTarget("healer_protect", targetUserId, options.nightActionCapabilities)) {
      return null;
    }
    return { kind: "healer_protect", targetUserId };
  }
  if (role === "priest") {
    if (!canUseNightKindForTarget("priest_bless", targetUserId, options.nightActionCapabilities)) {
      return null;
    }
    return { kind: "priest_bless", targetUserId };
  }
  if (role === "blacksmith" && secondTargetUserId) {
    if (!canUseNightKindForTarget("blacksmith_sword", targetUserId, options.nightActionCapabilities)) {
      return null;
    }
    return { kind: "blacksmith_sword", targetUserId, receiverUserId: secondTargetUserId };
  }
  if (role === "stray_cat") {
    if (!canUseNightKindForTarget("stray_cat_choose", targetUserId, options.nightActionCapabilities)) {
      return null;
    }
    return { kind: "stray_cat_choose", targetUserId };
  }
  if (role === "thief" && phase === "first_night") {
    if (!canUseNightKindForTarget("thief_steal", targetUserId, options.nightActionCapabilities)) {
      return null;
    }
    return { kind: "thief_steal", targetUserId };
  }
  if ((role === "cupid" || role === "lovers") && phase === "first_night" && secondTargetUserId) {
    if (!canUseNightKindForTarget("cupid_link", targetUserId, options.nightActionCapabilities)) {
      return null;
    }
    return { kind: "cupid_link", firstUserId: targetUserId, secondUserId: secondTargetUserId };
  }

  return null;
}

export function isNightActionKindAvailable(
  capabilities: NightActionCapabilities | null | undefined,
  kind: NightActionKind,
) {
  return !capabilities || kind === "skip" || capabilities.availableKinds.includes(kind);
}

export function nightActionUsedReason(
  capabilities: NightActionCapabilities | null | undefined,
  kind: NightActionKind,
) {
  return capabilities?.usedFlags[kind]?.reasonBg ?? null;
}

export function disallowedNightTargetReason(
  capabilities: NightActionCapabilities | null | undefined,
  kind: NightActionKind,
  targetUserId: string,
) {
  return capabilities?.disallowedTargetsByKind[kind]?.find((target) => target.id === targetUserId)?.reasonBg ?? null;
}

export function nightActionUnavailableReasons(
  capabilities: NightActionCapabilities | null | undefined,
  kinds: NightActionKind[],
) {
  const reasons = new Set<string>();
  for (const kind of kinds) {
    const usedReason = nightActionUsedReason(capabilities, kind);
    if (usedReason) {
      reasons.add(usedReason);
    }
    for (const target of capabilities?.disallowedTargetsByKind[kind] ?? []) {
      reasons.add(target.reasonBg);
    }
  }
  return [...reasons];
}

function filterTargetsByCapabilities(
  targets: PublicPlayer[],
  kinds: NightActionKind[],
  capabilities: NightActionCapabilities | null | undefined,
) {
  if (!capabilities || kinds.length === 0) {
    return targets;
  }

  const availableKinds = kinds.filter((kind) => isNightActionKindAvailable(capabilities, kind));
  if (availableKinds.length === 0) {
    return [];
  }

  return targets.filter((player) =>
    availableKinds.some((kind) => !disallowedNightTargetReason(capabilities, kind, player.userId)));
}

export function canUseNightKindForTarget(
  kind: NightActionKind,
  targetUserId: string,
  capabilities: NightActionCapabilities | null | undefined,
) {
  return isNightActionKindAvailable(capabilities, kind)
    && !disallowedNightTargetReason(capabilities, kind, targetUserId);
}

export function targetKindsForRole(role: RoleCode | undefined, phase: GamePhase): NightActionKind[] {
  if (!role) {
    return [];
  }
  if (role === "don") {
    return ["faction_kill", "check_commissioner"];
  }
  if (role === "informant") {
    return ["faction_kill", "check_role"];
  }
  if (role === "lawyer") {
    return ["faction_kill", "lawyer_cover"];
  }
  if (role === "roleblocker") {
    return ["faction_kill", "roleblock"];
  }
  if (canFactionKill(role)) {
    return ["faction_kill"];
  }
  if (role === "commissioner" || role === "detective") {
    return ["check_alignment"];
  }
  if (role === "seer" || role === "oracle") {
    return ["check_role"];
  }
  if (role === "investigator") {
    return ["investigator_check"];
  }
  if (role === "witch") {
    return ["witch_heal", "witch_poison"];
  }
  if (role === "healer" || role === "doctor" || role === "bodyguard") {
    return ["healer_protect"];
  }
  if (role === "priest") {
    return ["priest_bless"];
  }
  if (role === "blacksmith") {
    return ["blacksmith_sword"];
  }
  if (role === "stray_cat") {
    return ["stray_cat_choose"];
  }
  if (role === "thief" && phase === "first_night") {
    return ["thief_steal"];
  }
  if ((role === "cupid" || role === "lovers") && phase === "first_night") {
    return ["cupid_link"];
  }
  if (role === "medium") {
    return ["medium_contact"];
  }
  return [];
}
