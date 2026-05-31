import { describe, expect, it } from "vitest";
import {
  buildPrimaryNightAction,
  requiresExplicitNightActionChoice,
  secondaryShortcutTargets,
  shortcutTargets,
} from "@/lib/play/night-actions";
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
});
