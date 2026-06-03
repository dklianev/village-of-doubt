import {
  getRoleTeam,
  type GamePhase,
  type NightActionCapabilities,
  type NightActionKind,
} from "@werewolf/shared";
import { isNightPhase, type PrivatePlayerState } from "./game-room-runtime.js";

interface PublicCapabilityPlayer {
  userId: string;
  playing: boolean;
  alive: boolean;
}

interface BuildNightActionCapabilitiesOptions {
  actor: PrivatePlayerState;
  phase: GamePhase;
  players: Iterable<PublicCapabilityPlayer>;
}

const WITCH_HEAL_USED_REASON = "Лечебната отвара вече е използвана.";
const WITCH_POISON_USED_REASON = "Отровата вече е използвана.";
const PRIEST_BLESS_USED_REASON = "Благословията вече е дадена.";
const BLACKSMITH_USED_REASON = "Мечът вече е изкован.";
const INVESTIGATOR_USED_REASON = "Проверката вече е използвана.";
const VAMPIRE_HUNTER_DISARMED_REASON = "Убиецът на вампири е обезоръжен.";
const HEALER_REPEAT_TARGET_REASON = "Не можеш да лекуваш същия играч две нощи поред.";

export function buildNightActionCapabilities({
  actor,
  phase,
  players,
}: BuildNightActionCapabilitiesOptions): NightActionCapabilities {
  const capabilities: NightActionCapabilities = {
    availableKinds: [],
    usedFlags: {},
    disallowedTargetsByKind: {},
  };

  if (!isNightPhase(phase) || !actor.alive || !actor.role) {
    return capabilities;
  }

  const addAvailable = (kind: NightActionKind) => {
    capabilities.availableKinds.push(kind);
  };
  const markUsed = (kind: NightActionKind, reasonBg: string) => {
    capabilities.usedFlags[kind] = { reasonBg };
  };
  const role = actor.role;
  const team = getRoleTeam(role);

  if (
    team === "mafia" ||
    team === "werewolves" ||
    team === "vampires" ||
    role === "vigilante" ||
    role === "maniac"
  ) {
    addAvailable("faction_kill");
  }

  if (role === "vampire_hunter") {
    if (actor.vampireHunterDisarmed) {
      markUsed("faction_kill", VAMPIRE_HUNTER_DISARMED_REASON);
    } else {
      addAvailable("faction_kill");
    }
  }

  if (role === "commissioner" || role === "detective") {
    addAvailable("check_alignment");
  }
  if (role === "seer" || role === "oracle" || role === "informant") {
    addAvailable("check_role");
  }
  if (role === "don") {
    addAvailable("check_commissioner");
  }
  if (role === "roleblocker") {
    addAvailable("roleblock");
  }
  if (role === "lawyer") {
    addAvailable("lawyer_cover");
  }
  if (role === "medium") {
    addAvailable("medium_contact");
  }

  if (role === "investigator") {
    if (actor.investigatorUsed) {
      markUsed("investigator_check", INVESTIGATOR_USED_REASON);
    } else {
      addAvailable("investigator_check");
    }
  }

  if (role === "witch") {
    if (actor.witchHealUsed) {
      markUsed("witch_heal", WITCH_HEAL_USED_REASON);
    } else {
      addAvailable("witch_heal");
    }
    if (actor.witchPoisonUsed) {
      markUsed("witch_poison", WITCH_POISON_USED_REASON);
    } else {
      addAvailable("witch_poison");
    }
  }

  if (role === "healer" || role === "doctor" || role === "bodyguard") {
    addAvailable("healer_protect");
  }
  if (role === "healer" && actor.lastResolvedHealerTargetUserId) {
    const previousTargetId = actor.lastResolvedHealerTargetUserId;
    const previousTarget = [...players].find((player) => player.userId === previousTargetId);
    if (previousTarget?.playing && previousTarget.alive) {
      capabilities.disallowedTargetsByKind.healer_protect = [{
        id: previousTarget.userId,
        reasonBg: HEALER_REPEAT_TARGET_REASON,
      }];
    }
  }

  if (role === "priest") {
    if (actor.priestBlessUsed) {
      markUsed("priest_bless", PRIEST_BLESS_USED_REASON);
    } else {
      addAvailable("priest_bless");
    }
  }

  if (role === "blacksmith") {
    if (actor.blacksmithUsed) {
      markUsed("blacksmith_sword", BLACKSMITH_USED_REASON);
    } else {
      addAvailable("blacksmith_sword");
    }
  }

  if (role === "stray_cat") {
    addAvailable("stray_cat_choose");
  }
  if (role === "thief" && phase === "first_night") {
    addAvailable("thief_steal");
  }
  if ((role === "cupid" || role === "lovers") && phase === "first_night") {
    addAvailable("cupid_link");
  }

  return capabilities;
}

export function hasNightActionCapabilities(capabilities: NightActionCapabilities) {
  return capabilities.availableKinds.length > 0
    || Object.keys(capabilities.usedFlags).length > 0
    || Object.values(capabilities.disallowedTargetsByKind).some((targets) => (targets?.length ?? 0) > 0);
}
