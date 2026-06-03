import { describe, expect, it } from "vitest";
import { buildNightActionCapabilities } from "../night-action-capabilities.js";
import type { PrivatePlayerState } from "../game-room-runtime.js";

const players = [
  { userId: "actor", playing: true, alive: true },
  { userId: "target", playing: true, alive: true },
  { userId: "receiver", playing: true, alive: true },
];

function actor(overrides: Partial<PrivatePlayerState>): PrivatePlayerState {
  return {
    userId: "actor",
    alive: true,
    ...overrides,
  };
}

describe("night action capabilities", () => {
  it("marks the previous Healer target as unavailable without removing other targets", () => {
    const capabilities = buildNightActionCapabilities({
      phase: "night",
      players,
      actor: actor({
        role: "healer",
        lastResolvedHealerTargetUserId: "target",
      }),
    });

    expect(capabilities.availableKinds).toContain("healer_protect");
    expect(capabilities.disallowedTargetsByKind.healer_protect).toEqual([{
      id: "target",
      reasonBg: "Не можеш да лекуваш същия играч две нощи поред.",
    }]);
  });

  it("removes Witch potions independently after each consumable is used", () => {
    const fresh = buildNightActionCapabilities({
      phase: "night",
      players,
      actor: actor({ role: "witch" }),
    });
    const spentHeal = buildNightActionCapabilities({
      phase: "night",
      players,
      actor: actor({ role: "witch", witchHealUsed: true }),
    });
    const spentBoth = buildNightActionCapabilities({
      phase: "night",
      players,
      actor: actor({ role: "witch", witchHealUsed: true, witchPoisonUsed: true }),
    });

    expect(fresh.availableKinds).toEqual(expect.arrayContaining(["witch_heal", "witch_poison"]));
    expect(spentHeal.availableKinds).not.toContain("witch_heal");
    expect(spentHeal.availableKinds).toContain("witch_poison");
    expect(spentHeal.usedFlags.witch_heal).toEqual({ reasonBg: "Лечебната отвара вече е използвана." });
    expect(spentBoth.availableKinds).not.toContain("witch_poison");
    expect(spentBoth.usedFlags.witch_poison).toEqual({ reasonBg: "Отровата вече е използвана." });
  });

  it("removes Priest blessing after it has already been given", () => {
    const fresh = buildNightActionCapabilities({
      phase: "night",
      players,
      actor: actor({ role: "priest" }),
    });
    const spent = buildNightActionCapabilities({
      phase: "night",
      players,
      actor: actor({ role: "priest", priestBlessUsed: true }),
    });

    expect(fresh.availableKinds).toContain("priest_bless");
    expect(spent.availableKinds).not.toContain("priest_bless");
    expect(spent.usedFlags.priest_bless).toEqual({ reasonBg: "Благословията вече е дадена." });
  });

  it("marks already blessed Priest targets as unavailable", () => {
    const capabilities = buildNightActionCapabilities({
      phase: "night",
      players: [
        { userId: "actor", playing: true, alive: true },
        { userId: "target", playing: true, alive: true, priestBlessed: true },
        { userId: "receiver", playing: true, alive: true },
      ],
      actor: actor({ role: "priest" }),
    });

    expect(capabilities.availableKinds).toContain("priest_bless");
    expect(capabilities.disallowedTargetsByKind.priest_bless).toEqual([{
      id: "target",
      reasonBg: "Този играч вече е благословен.",
    }]);
  });

  it("removes Blacksmith and Investigator one-shot actions once spent", () => {
    const blacksmith = buildNightActionCapabilities({
      phase: "night",
      players,
      actor: actor({ role: "blacksmith", blacksmithUsed: true }),
    });
    const investigator = buildNightActionCapabilities({
      phase: "night",
      players,
      actor: actor({ role: "investigator", investigatorUsed: true }),
    });

    expect(blacksmith.availableKinds).not.toContain("blacksmith_sword");
    expect(blacksmith.usedFlags.blacksmith_sword).toEqual({ reasonBg: "Мечът вече е изкован." });
    expect(investigator.availableKinds).not.toContain("investigator_check");
    expect(investigator.usedFlags.investigator_check).toEqual({ reasonBg: "Проверката вече е използвана." });
  });

  it("removes Vampire Hunter kill after the hunter is disarmed", () => {
    const armed = buildNightActionCapabilities({
      phase: "night",
      players,
      actor: actor({ role: "vampire_hunter" }),
    });
    const disarmed = buildNightActionCapabilities({
      phase: "night",
      players,
      actor: actor({ role: "vampire_hunter", vampireHunterDisarmed: true }),
    });

    expect(armed.availableKinds).toContain("faction_kill");
    expect(disarmed.availableKinds).not.toContain("faction_kill");
    expect(disarmed.usedFlags.faction_kill).toEqual({ reasonBg: "Убиецът на вампири е обезоръжен." });
  });

  it("does not expose capabilities outside night phases or for dead actors", () => {
    expect(buildNightActionCapabilities({
      phase: "day_discussion",
      players,
      actor: actor({ role: "witch" }),
    })).toEqual({ availableKinds: [], usedFlags: {}, disallowedTargetsByKind: {} });
    expect(buildNightActionCapabilities({
      phase: "night",
      players,
      actor: actor({ role: "witch", alive: false }),
    })).toEqual({ availableKinds: [], usedFlags: {}, disallowedTargetsByKind: {} });
  });
});
