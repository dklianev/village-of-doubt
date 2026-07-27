import { describe, expect, it } from "vitest";
import {
  buildPrimaryNightAction,
  canUseNightKindForTarget,
  isNightActionKindAvailable,
  nightActionUnavailableReasons,
  requiresExplicitNightActionChoice,
  secondaryShortcutTargets,
  shortcutTargets,
} from "@/lib/play/night-actions";
import type { NightActionCapabilities } from "@werewolf/shared";
import type { PublicPlayer } from "@/lib/play/types";

function player(userId: string): PublicPlayer {
  return {
    userId,
    displayName: userId,
    connected: true,
    ready: true,
    playing: true,
    alive: true,
    host: false,
    narrator: false,
    acceptedFullNarrator: true,
    mayor: false,
    hasVoted: false,
    actedThisPhase: false,
    revealedRole: "",
  };
}

describe("night action target helpers", () => {
  const livingPlayers = [player("actor"), player("target"), player("receiver")];

  it("allows Blacksmith to choose self as the sword target but not as the receiver", () => {
    expect(shortcutTargets("night", "blacksmith", livingPlayers, livingPlayers, "actor").map((item) => item.userId))
      .toEqual(["actor", "target", "receiver"]);

    expect(secondaryShortcutTargets("night", "blacksmith", livingPlayers, "actor", "target").map((item) => item.userId))
      .toEqual(["receiver"]);
  });

  it("allows Cupid to include the actor as one lover while requiring two different seats", () => {
    expect(shortcutTargets("first_night", "cupid", livingPlayers, livingPlayers, "actor").map((item) => item.userId))
      .toEqual(["actor", "target", "receiver"]);

    expect(secondaryShortcutTargets("first_night", "cupid", livingPlayers, "actor", "target").map((item) => item.userId))
      .toEqual(["actor", "receiver"]);
  });

  it("keeps Doctor self-protection out of the default target list", () => {
    expect(shortcutTargets("night", "doctor", livingPlayers, livingPlayers, "actor").map((item) => item.userId))
      .toEqual(["target", "receiver"]);
  });

  it("includes Doctor self-protection when the room option allows it", () => {
    expect(shortcutTargets("night", "doctor", livingPlayers, livingPlayers, "actor", { doctorCanSelfProtect: true }).map((item) => item.userId))
      .toEqual(["actor", "target", "receiver"]);
  });

  it("does not expose night targets when reused outside night phases", () => {
    expect(shortcutTargets("day_discussion", "medium", [player("dead")], livingPlayers, "actor"))
      .toEqual([]);
    expect(shortcutTargets("resolution", "werewolf", livingPlayers, livingPlayers, "actor"))
      .toEqual([]);
  });

  it("does not guess a default command for roles with multiple night buttons", () => {
    expect(requiresExplicitNightActionChoice("don", "night")).toBe(true);
    expect(buildPrimaryNightAction("don", "target", "", "night")).toBeNull();
    expect(buildPrimaryNightAction("witch", "target", "", "night")).toBeNull();
    expect(buildPrimaryNightAction("informant", "target", "", "night")).toBeNull();
    expect(buildPrimaryNightAction("roleblocker", "target", "", "night")).toBeNull();
    expect(buildPrimaryNightAction("lawyer", "target", "", "night")).toBeNull();
  });

  it("keeps Enter-submit available for unambiguous night actions", () => {
    expect(buildPrimaryNightAction("seer", "target", "", "night"))
      .toEqual({ kind: "check_role", targetUserId: "target" });
    expect(buildPrimaryNightAction("doctor", "target", "", "night"))
      .toEqual({ kind: "healer_protect", targetUserId: "target" });
    expect(buildPrimaryNightAction("blacksmith", "target", "receiver", "night"))
      .toEqual({ kind: "blacksmith_sword", targetUserId: "target", receiverUserId: "receiver" });
    expect(requiresExplicitNightActionChoice("thief", "first_night")).toBe(false);
    expect(buildPrimaryNightAction("thief", "target", "", "first_night"))
      .toEqual({ kind: "thief_steal", targetUserId: "target" });
  });

  it("filters the previous Healer target from table selection", () => {
    const capabilities: NightActionCapabilities = {
      availableKinds: ["healer_protect"],
      usedFlags: {},
      disallowedTargetsByKind: {
        healer_protect: [{ id: "target", reasonBg: "Не можеш да лекуваш същия играч две нощи поред." }],
      },
    };

    expect(shortcutTargets(
      "night",
      "healer",
      livingPlayers,
      livingPlayers,
      "actor",
      { nightActionCapabilities: capabilities },
    ).map((item) => item.userId)).toEqual(["receiver"]);
    expect(buildPrimaryNightAction("healer", "target", "", "night", { nightActionCapabilities: capabilities }))
      .toBeNull();
  });

  it("removes allied faction-kill targets using the private capability reason", () => {
    const capabilities: NightActionCapabilities = {
      availableKinds: ["faction_kill"],
      usedFlags: {},
      disallowedTargetsByKind: {
        faction_kill: [{ id: "target", reasonBg: "Не можеш да избереш свой съотборник." }],
      },
    };

    expect(shortcutTargets(
      "night",
      "mafioso",
      livingPlayers,
      livingPlayers,
      "actor",
      { nightActionCapabilities: capabilities },
    ).map((item) => item.userId)).toEqual(["receiver"]);
    expect(canUseNightKindForTarget("faction_kill", "target", capabilities)).toBe(false);
  });

  it.each([
    ["don", "check_commissioner"],
    ["informant", "check_role"],
    ["lawyer", "lawyer_cover"],
  ] as const)("keeps %s targets available through %s when faction kill is disabled", (role, specialKind) => {
    const capabilities: NightActionCapabilities = {
      availableKinds: [specialKind],
      usedFlags: {
        faction_kill: { reasonBg: "Убийствата са изключени през тази нощ." },
      },
      disallowedTargetsByKind: {},
    };

    expect(shortcutTargets(
      "first_night",
      role,
      livingPlayers,
      livingPlayers,
      "actor",
      { nightActionCapabilities: capabilities },
    ).map((item) => item.userId)).toEqual(["target", "receiver"]);
    expect(isNightActionKindAvailable(capabilities, specialKind)).toBe(true);
  });

  it("removes spent Witch potion choices independently", () => {
    const capabilities: NightActionCapabilities = {
      availableKinds: ["witch_heal"],
      usedFlags: {
        witch_poison: { reasonBg: "Отровата вече е използвана." },
      },
      disallowedTargetsByKind: {},
      allowedTargetIdsByKind: {
        witch_heal: ["target"],
      },
    };

    expect(shortcutTargets(
      "night",
      "witch",
      livingPlayers,
      livingPlayers,
      "actor",
      { nightActionCapabilities: capabilities },
    ).map((item) => item.userId)).toEqual(["target"]);
    expect(isNightActionKindAvailable(capabilities, "witch_heal")).toBe(true);
    expect(isNightActionKindAvailable(capabilities, "witch_poison")).toBe(false);
    expect(canUseNightKindForTarget("witch_heal", "actor", capabilities)).toBe(false);
    expect(canUseNightKindForTarget("witch_heal", "target", capabilities)).toBe(true);
    expect(nightActionUnavailableReasons(capabilities, ["witch_heal", "witch_poison"]))
      .toEqual(["Отровата вече е използвана."]);
  });

  it("keeps Witch poison unrestricted while healing only the faction victim", () => {
    const capabilities: NightActionCapabilities = {
      availableKinds: ["witch_heal", "witch_poison"],
      usedFlags: {},
      disallowedTargetsByKind: {},
      allowedTargetIdsByKind: {
        witch_heal: ["target"],
      },
    };

    expect(shortcutTargets(
      "night",
      "witch",
      livingPlayers,
      livingPlayers,
      "actor",
      { nightActionCapabilities: capabilities },
    ).map((item) => item.userId)).toEqual(["actor", "target", "receiver"]);
    expect(canUseNightKindForTarget("witch_heal", "actor", capabilities)).toBe(false);
    expect(canUseNightKindForTarget("witch_poison", "actor", capabilities)).toBe(true);
  });

  it("removes spent Priest, Blacksmith, Investigator and Vampire Hunter actions", () => {
    const used = (kind: "priest_bless" | "blacksmith_sword" | "investigator_check" | "faction_kill", reasonBg: string): NightActionCapabilities => ({
      availableKinds: [],
      usedFlags: { [kind]: { reasonBg } },
      disallowedTargetsByKind: {},
    });

    expect(shortcutTargets("night", "priest", livingPlayers, livingPlayers, "actor", {
      nightActionCapabilities: used("priest_bless", "Благословията вече е дадена."),
    })).toEqual([]);
    expect(shortcutTargets("night", "blacksmith", livingPlayers, livingPlayers, "actor", {
      nightActionCapabilities: used("blacksmith_sword", "Мечът вече е изкован."),
    })).toEqual([]);
    expect(shortcutTargets("night", "investigator", livingPlayers, livingPlayers, "actor", {
      nightActionCapabilities: used("investigator_check", "Проверката вече е използвана."),
    })).toEqual([]);
    expect(shortcutTargets("night", "vampire_hunter", livingPlayers, livingPlayers, "actor", {
      nightActionCapabilities: used("faction_kill", "Убиецът на вампири е обезоръжен."),
    })).toEqual([]);
  });
});
