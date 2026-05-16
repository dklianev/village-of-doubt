import { describe, expect, it } from "vitest";
import {
  countRoles,
  getMafiaFreePreset,
  getMafiaSportPreset,
  getRoleBalanceScore,
  getWerewolvesClassicPreset,
} from "../game-config.js";

const ACCEPTABLE_WEREWOLF_RANGE = [-3, 6] as const;
const ACCEPTABLE_MAFIA_RANGE = [-6, 4] as const;

const DOCUMENTED_WEREWOLF_EDGE_RANGES: Partial<Record<number, readonly [number, number]>> = {
  9: [-3, 7],
  10: [-3, 8],
  23: [-5, 6],
  24: [-4, 6],
  29: [-6, 6],
  30: [-5, 6],
};

function werewolfRangeFor(playerCount: number): readonly [number, number] {
  return DOCUMENTED_WEREWOLF_EDGE_RANGES[playerCount] ?? ACCEPTABLE_WEREWOLF_RANGE;
}

describe("Werewolf preset balance scores", () => {
  for (let playerCount = 6; playerCount <= 18; playerCount += 1) {
    it(`preset for ${playerCount} players has a documented balance score`, () => {
      const preset = getWerewolvesClassicPreset(playerCount);
      const score = getRoleBalanceScore(preset);
      const [minimum, maximum] = werewolfRangeFor(playerCount);

      expect(score).toBeGreaterThanOrEqual(minimum);
      expect(score).toBeLessThanOrEqual(maximum);
    });

    it(`preset for ${playerCount} players has the correct total count`, () => {
      const preset = getWerewolvesClassicPreset(playerCount);
      expect(countRoles(preset)).toBe(playerCount);
    });
  }

  it("scaling presets (19-30 players) stay in documented launch bounds", () => {
    for (let playerCount = 19; playerCount <= 30; playerCount += 1) {
      const preset = getWerewolvesClassicPreset(playerCount);
      const score = getRoleBalanceScore(preset);
      const [minimum, maximum] = werewolfRangeFor(playerCount);

      expect(score).toBeGreaterThanOrEqual(minimum);
      expect(score).toBeLessThanOrEqual(maximum);
      expect(countRoles(preset)).toBe(playerCount);
    }
  });

  it("adds a seventh werewolf only for 29-30 player tables", () => {
    expect(getWerewolvesClassicPreset(28).werewolf).toBe(6);
    expect(getWerewolvesClassicPreset(29).werewolf).toBe(7);
    expect(getWerewolvesClassicPreset(30).werewolf).toBe(7);
  });
});

describe("Mafia preset balance scores", () => {
  it("sport mafia (10) is within acceptable range", () => {
    const preset = getMafiaSportPreset(10);
    const score = getRoleBalanceScore(preset);

    expect(score).toBeGreaterThanOrEqual(ACCEPTABLE_MAFIA_RANGE[0]);
    expect(score).toBeLessThanOrEqual(ACCEPTABLE_MAFIA_RANGE[1]);
    expect(countRoles(preset)).toBe(10);
  });

  it("free mafia presets are within range", () => {
    for (let playerCount = 4; playerCount <= 24; playerCount += 1) {
      const preset = getMafiaFreePreset(playerCount);
      const score = getRoleBalanceScore(preset);

      expect(score).toBeGreaterThanOrEqual(ACCEPTABLE_MAFIA_RANGE[0]);
      expect(score).toBeLessThanOrEqual(ACCEPTABLE_MAFIA_RANGE[1]);
      expect(countRoles(preset)).toBe(playerCount);
    }
  });
});

describe("Preset role count integrity", () => {
  it("werewolf presets always include at least 2 werewolves", () => {
    for (let playerCount = 6; playerCount <= 30; playerCount += 1) {
      const preset = getWerewolvesClassicPreset(playerCount);
      expect(preset.werewolf ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it("werewolf presets always include a seer", () => {
    for (let playerCount = 6; playerCount <= 30; playerCount += 1) {
      const preset = getWerewolvesClassicPreset(playerCount);
      expect(preset.seer ?? 0).toBeGreaterThanOrEqual(1);
    }
  });
});
