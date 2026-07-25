import { describe, expect, it } from "vitest";
import {
  assignRoles,
  countRoles,
  createDefaultGameConfig,
  createGameConfigFromOptions,
  evaluateWinCondition,
  getGameFamily,
  getRoleBalanceScore,
  getRoleRuntimeStatus,
  getRolesForFamily,
  getMafiaFreePreset,
  getMafiaSportPreset,
  getWerewolfAdvancedPreset,
  getWerewolfVampiresPreset,
  getWerewolvesMvpPreset,
  phaseLabelBg,
  ROLE_DEFINITIONS,
  TEMPO_PRESETS,
  validateRoleDistribution,
  validateRoleDistributionForMode,
} from "../index.js";

describe("role presets", () => {
  it("matches the 10-player sport mafia preset", () => {
    const preset = getMafiaSportPreset(10);

    expect(preset).toEqual({
      civilian: 6,
      commissioner: 1,
      mafioso: 2,
      don: 1,
    });
    expect(countRoles(preset)).toBe(10);
  });

  it("scales werewolves with the player count", () => {
    expect(getWerewolvesMvpPreset(8).werewolf).toBe(2);
    expect(getWerewolvesMvpPreset(11).werewolf).toBe(3);
    expect(getWerewolvesMvpPreset(12).werewolf).toBe(3);
    expect(getWerewolvesMvpPreset(16).werewolf).toBe(4);
  });

  it("keeps every 6-30 player werewolves preset exact", () => {
    for (let playerCount = 6; playerCount <= 30; playerCount += 1) {
      expect(countRoles(getWerewolvesMvpPreset(playerCount))).toBe(playerCount);
    }
  });

  it("keeps advanced werewolf presets playable until manual-only roles are wired", () => {
    expect(getWerewolvesMvpPreset(14).vampire).toBeUndefined();
    expect(getWerewolfAdvancedPreset(12).oracle).toBe(1);
    expect(getWerewolfAdvancedPreset(12).priest).toBeUndefined();
    expect(getWerewolfAdvancedPreset(12).blacksmith).toBeUndefined();
    expect(getWerewolfAdvancedPreset(12).vampire_hunter).toBeUndefined();
    expect(getWerewolfVampiresPreset(14).werewolf).toBeGreaterThanOrEqual(3);
    expect(getWerewolfVampiresPreset(14).vampire).toBeGreaterThanOrEqual(3);
    expect(getWerewolvesMvpPreset(10).healer).toBeUndefined();
    expect(getWerewolvesMvpPreset(10).witch).toBe(1);
    expect("guardian" in ROLE_DEFINITIONS).toBe(false);
  });

  it("does not assign manual-only roles from default presets", () => {
    expect(getRoleRuntimeStatus("stray_cat")).toBe("manual_only");
    expect(getRoleRuntimeStatus("guard_dog")).toBe("manual_only");

    for (let playerCount = 6; playerCount <= 30; playerCount += 1) {
      for (const role of Object.keys(getWerewolvesMvpPreset(playerCount))) {
        expect(getRoleRuntimeStatus(role as keyof typeof ROLE_DEFINITIONS)).toBe("playable");
      }
    }

    for (let playerCount = 4; playerCount <= 24; playerCount += 1) {
      for (const role of Object.keys(getMafiaFreePreset(playerCount))) {
        expect(getRoleRuntimeStatus(role as keyof typeof ROLE_DEFINITIONS)).toBe("playable");
      }
    }

    for (const role of Object.keys(getMafiaSportPreset(10))) {
      expect(getRoleRuntimeStatus(role as keyof typeof ROLE_DEFINITIONS)).toBe("playable");
    }
  });

  it("adds Cupid only when lovers are enabled", () => {
    const withoutLovers = getWerewolvesMvpPreset(10);
    const withLovers = getWerewolvesMvpPreset(10, true);

    expect(withoutLovers.cupid).toBeUndefined();
    expect(withLovers.cupid).toBe(1);
    expect(countRoles(withLovers)).toBe(10);
    expect((withLovers.ordinary_villager ?? 0) + 1).toBe(withoutLovers.ordinary_villager);
  });

  it("warns on impossible manual role counts", () => {
    expect(validateRoleDistribution(8, { ordinary_villager: 4, werewolf: 2, seer: 1 })).toContain(
      "Броят роли (7) не съвпада с броя играчи (8).",
    );
  });

  it("enforces role maxCopies in validation and config creation", () => {
    expect(validateRoleDistributionForMode("werewolves_classic", 8, {
      ordinary_villager: 4,
      werewolf: 2,
      witch: 2,
    })).toContain("Вещица може да участва най-много 1 път.");

    expect(() => createGameConfigFromOptions({
      mode: "werewolves_classic",
      playerCount: 8,
      roles: { ordinary_villager: 4, werewolf: 2, witch: 2 },
    })).toThrow("Превишен е максималният брой копия");
  });

  it("validates canonical role dependencies and balance warnings for werewolf", () => {
    expect(
      validateRoleDistributionForMode("werewolves_classic", 8, {
        ordinary_villager: 4,
        werewolf: 2,
        red_riding_hood: 1,
        seer: 1,
      }),
    ).toContain("Червена шапчица може да се включи само ако Ловецът също е в играта.");

    expect(
      validateRoleDistributionForMode("werewolves_classic", 12, {
        ordinary_villager: 6,
        werewolf: 3,
        seer: 1,
        priest: 1,
        hunter: 1,
      }),
    ).toContain("Свещеникът изисква Ковач.");

    expect(getRoleBalanceScore({ werewolf: 3, ordinary_villager: 3, seer: 1, witch: 1, cupid: 1, hunter: 1, mayor: 1 })).toBe(0);
  });

  it.each([
    {
      name: "зависимост между роли",
      options: {
        mode: "werewolves_classic" as const,
        playerCount: 8,
        roles: { ordinary_villager: 4, werewolf: 2, red_riding_hood: 1, seer: 1 },
      },
      message: "Червена шапчица може да се включи само ако Ловецът също е в играта.",
    },
    {
      name: "минимум за две вражески фракции",
      options: {
        mode: "werewolves_classic" as const,
        playerCount: 8,
        werewolfVariant: "three_teams" as const,
        roles: { ordinary_villager: 4, werewolf: 1, vampire: 1, seer: 1, healer: 1 },
      },
      message: "При едновременни Върколаци и Вампири трябва да има поне 3 Върколака и 3 Вампира.",
    },
    {
      name: "публичен Кмет за Кучето пазач",
      options: {
        mode: "werewolves_classic" as const,
        playerCount: 8,
        mayorMode: "secret_role" as const,
        promoRolesEnabled: true,
        roles: { ordinary_villager: 3, werewolf: 2, seer: 1, mayor: 1, guard_dog: 1 },
      },
      message: "Куче пазач може да се използва само с публично избран Кмет.",
    },
  ])("rejects hard role compatibility on the strict server path: $name", ({ options, message }) => {
    const strictOptions = {
      ...options,
      enforceRoleCompatibility: true,
    } as Parameters<typeof createGameConfigFromOptions>[0];

    expect(() => createGameConfigFromOptions(strictOptions)).toThrow(message);
  });

  it("builds config from lobby options with matching timers and live mode", () => {
    const config = createGameConfigFromOptions({
      mode: "werewolves_classic",
      playerCount: 14,
      narratorMode: "honest_human",
      communicationMode: "no_chat",
      tempoProfile: "live",
      loversEnabled: true,
    });

    expect(config.playerCount).toBe(14);
    expect(config.narratorMode).toBe("honest_human");
    expect(config.communicationMode).toBe("no_chat");
    expect(config.liveMode).toBe(true);
    expect(config.roles.cupid).toBe(1);
    expect(config.timers.autoAdvanceWhenReady).toBe(false);
  });

  it("derives lovers from Cupid in a manual role composition", () => {
    const config = createGameConfigFromOptions({
      mode: "werewolves_classic",
      playerCount: 9,
      loversEnabled: false,
      roles: {
        ordinary_villager: 4,
        werewolf: 2,
        seer: 1,
        hunter: 1,
        cupid: 1,
      },
    });

    expect(config.roles.cupid).toBe(1);
    expect(config.loversEnabled).toBe(true);
  });

  it("keeps the legacy lovers flag by adding Cupid to an eligible preset", () => {
    const config = createGameConfigFromOptions({
      mode: "werewolves_classic",
      playerCount: 9,
      loversEnabled: true,
      rolePreset: "classic",
    });

    expect(config.roles.cupid).toBe(1);
    expect(config.loversEnabled).toBe(true);
    expect(countRoles(config.roles)).toBe(9);
  });

  it("normalizes lovers to false when the resolved roles do not contain Cupid", () => {
    const config = createGameConfigFromOptions({
      mode: "werewolves_classic",
      playerCount: 8,
      loversEnabled: true,
      roles: {
        ordinary_villager: 4,
        werewolf: 2,
        seer: 1,
        hunter: 1,
      },
    });

    expect(config.roles.cupid).toBeUndefined();
    expect(config.loversEnabled).toBe(false);
  });

  it("keeps the authoritative sport Mafia tempo fixed", () => {
    const config = createGameConfigFromOptions({
      mode: "mafia_sport",
      playerCount: 10,
      maxPlayers: 30,
      tempoProfile: "live",
      allowSkipVote: true,
    });

    expect(config.tempoProfile).toBe("sport_mafia");
    expect(config.timers).toEqual(TEMPO_PRESETS.sport_mafia);
    expect(config.maxPlayers).toBe(10);
    expect(config.allowSkipVote).toBe(false);
  });

  it("preserves rule overrides and never sets capacity below playerCount", () => {
    const config = createGameConfigFromOptions({
      mode: "werewolves_classic",
      playerCount: 8,
      maxPlayers: 4,
      tieBreaker: "revote",
      firstNightKill: false,
    });

    expect(config.maxPlayers).toBe(8);
    expect(config.tieBreaker).toBe("revote");
    expect(config.firstNightKill).toBe(false);
  });

  it("caps room capacity at the supported 30-player limit", () => {
    const config = createGameConfigFromOptions({
      mode: "werewolves_classic",
      playerCount: 8,
      maxPlayers: 999,
    });

    expect(config.maxPlayers).toBe(30);
    expect(() => createGameConfigFromOptions({
      mode: "werewolves_classic",
      playerCount: 31,
    })).toThrow("Играта поддържа най-много 30 играчи.");
  });

  it("uses bounded custom timers only for manual tempo", () => {
    const config = createGameConfigFromOptions({
      mode: "werewolves_classic",
      playerCount: 12,
      tempoProfile: "manual",
      customTimers: {
        dayDiscussionSeconds: 420,
        factionNightActionSeconds: 75,
        voteSeconds: 45,
        autoAdvanceWhenReady: true,
      },
    });

    expect(config.tempoProfile).toBe("manual");
    expect(config.timers.dayDiscussionSeconds).toBe(420);
    expect(config.timers.factionNightActionSeconds).toBe(75);
    expect(config.timers.personalNightActionSeconds).toBe(75);
    expect(config.timers.voteSeconds).toBe(45);
    expect(config.timers.autoAdvanceWhenReady).toBe(true);

    const presetConfig = createGameConfigFromOptions({
      mode: "werewolves_classic",
      playerCount: 12,
      tempoProfile: "fast_online",
      customTimers: { dayDiscussionSeconds: 420, autoAdvanceWhenReady: false },
    });
    expect(presetConfig.timers.dayDiscussionSeconds).toBe(90);
    expect(presetConfig.timers.autoAdvanceWhenReady).toBe(true);
  });

  it("supports manual role distribution from lobby options", () => {
    const config = createGameConfigFromOptions({
      mode: "werewolves_classic",
      playerCount: 6,
      roles: {
        ordinary_villager: 3,
        werewolf: 2,
        seer: 1,
        witch: 0,
      },
    });

    expect(config.rolePreset).toBe("manual");
    expect(config.roles).toEqual({
      ordinary_villager: 3,
      werewolf: 2,
      seer: 1,
    });
  });

  it("rejects manual roles from the wrong game family", () => {
    expect(() =>
      createGameConfigFromOptions({
        mode: "mafia_free",
        playerCount: 4,
        roles: {
          civilian: 3,
          werewolf: 1,
        },
      }),
    ).toThrow("Тези роли не са налични за Мафия: Върколак.");

    expect(() =>
      createGameConfigFromOptions({
        mode: "werewolves_classic",
        playerCount: 6,
        roles: {
          ordinary_villager: 5,
          don: 1,
        },
      }),
    ).toThrow("Тези роли не са налични за Върколак: Кръстник.");
  });

  it("separates mafia and werewolves families without duplicating role definitions", () => {
    expect(getGameFamily("werewolves_classic")).toBe("werewolves");
    expect(getGameFamily("mafia_sport")).toBe("mafia");
    expect(getGameFamily("mafia_free")).toBe("mafia");
    expect(getRolesForFamily("mafia")).toEqual(
      expect.arrayContaining(["civilian", "commissioner", "doctor", "mafioso", "don", "jester"]),
    );
    expect(getRolesForFamily("werewolves")).toContain("werewolf");
    expect(getRolesForFamily("werewolves")).not.toContain("mafioso");
    expect(getRolesForFamily("werewolves")).toEqual(expect.arrayContaining(["oracle", "blacksmith", "stray_cat", "guard_dog"]));
    expect(ROLE_DEFINITIONS.werewolf.availableInFamilies).toEqual(["werewolves"]);
    expect(ROLE_DEFINITIONS.mafioso.availableInFamilies).toEqual(["mafia"]);
  });

  it("uses mode-aware Bulgarian phase labels", () => {
    expect(phaseLabelBg("night", "werewolves_classic")).toBe("Нощ");
    expect(phaseLabelBg("night", "mafia_free")).toBe("Сделките започват");
    expect(phaseLabelBg("day_discussion", "mafia_sport")).toBe("Речи на масата");
    expect(phaseLabelBg("resolution", "mafia_free")).toBe("Присъда");
  });

  it("never exposes a skip-vote option in Sport Mafia", () => {
    expect(createDefaultGameConfig("mafia_sport", 10).allowSkipVote).toBe(false);
    expect(createGameConfigFromOptions({
      mode: "mafia_sport",
      playerCount: 10,
      allowSkipVote: true,
    }).allowSkipVote).toBe(false);
  });
});

describe("assignment and win conditions", () => {
  it("assigns exactly one role per player", () => {
    const config = createDefaultGameConfig("werewolves_classic", 8);
    const assignments = assignRoles(
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      config.roles,
      () => 0.42,
    );

    expect(assignments).toHaveLength(8);
    expect(new Set(assignments.map((assignment) => assignment.playerId)).size).toBe(8);
  });

  it("declares village victory when no evil role is alive", () => {
    const result = evaluateWinCondition([
      { playerId: "a", role: "ordinary_villager", alive: true },
      { playerId: "b", role: "seer", alive: true },
      { playerId: "c", role: "werewolf", alive: false },
    ]);

    expect(result.winner).toBe("village");
  });

  it("declares lovers victory when mixed lovers are final two", () => {
    const result = evaluateWinCondition([
      { playerId: "a", role: "ordinary_villager", alive: true, loverId: "b" },
      { playerId: "b", role: "werewolf", alive: true, loverId: "a" },
      { playerId: "c", role: "seer", alive: false },
    ]);

    expect(result.winner).toBe("lovers");
  });

  it("keeps play active when Werewolves and Vampires tie without village opposition", () => {
    const result = evaluateWinCondition([
      { playerId: "a", role: "vampire", alive: true },
      { playerId: "b", role: "werewolf", alive: true },
    ]);

    expect(result.winner).toBeNull();
    expect(result.reasonBg).toBeNull();
  });

  it("does not let a lone neutral jester count as village", () => {
    const result = evaluateWinCondition([{ playerId: "a", role: "jester", alive: true }]);

    expect(result.winner).toBe("draw");
  });
});
