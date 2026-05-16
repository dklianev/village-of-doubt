import { describe, expect, it } from "vitest";
import { assignRoles } from "../role-assignment.js";
import { countRoles, getWerewolvesClassicPreset, type RoleDistribution } from "../game-config.js";

describe("assignRoles", () => {
  it("is deterministic with the same random source", () => {
    const preset = getWerewolvesClassicPreset(8);
    const users = usersFor(8);
    const a = assignRoles(users, preset, seededRandom("fixed-seed"));
    const b = assignRoles(users, preset, seededRandom("fixed-seed"));

    expect(a).toEqual(b);
  });

  it("usually differs with a different random source", () => {
    const preset = getWerewolvesClassicPreset(8);
    const users = usersFor(8);
    const a = assignRoles(users, preset, seededRandom("seed-a"));
    const b = assignRoles(users, preset, seededRandom("seed-b"));

    expect(a).not.toEqual(b);
  });

  it("assigns exactly one role to every player", () => {
    const preset = getWerewolvesClassicPreset(10);
    const users = usersFor(10);
    const result = assignRoles(users, preset, seededRandom("unique"));

    expect(result).toHaveLength(10);
    expect(new Set(result.map((item) => item.playerId))).toEqual(new Set(users));
    expect(result.every((item) => item.role)).toBe(true);
  });

  it("preserves the preset role balance", () => {
    const preset = getWerewolvesClassicPreset(10);
    const result = assignRoles(usersFor(10), preset, seededRandom("balance"));
    const assignedDistribution = result.reduce<RoleDistribution>((distribution, item) => {
      distribution[item.role] = (distribution[item.role] ?? 0) + 1;
      return distribution;
    }, {});

    expect(assignedDistribution.werewolf).toBe(preset.werewolf);
    expect(countRoles(assignedDistribution)).toBe(countRoles(preset));
  });

  it("throws when player count does not match the role count", () => {
    const preset = getWerewolvesClassicPreset(8);

    expect(() => assignRoles(["u1", "u2"], preset, seededRandom("too-few"))).toThrow("не съвпада");
  });
});

function usersFor(count: number) {
  return Array.from({ length: count }, (_, index) => `user-${index + 1}`);
}

function seededRandom(seed: string) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
