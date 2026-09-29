import { describe, expect, it } from "vitest";
import { evaluateWinCondition, ROLE_DEFINITIONS, type RoleCode } from "@werewolf/shared";
import type { PublicPlayer } from "../types";
import { nightActionHelpBg, nightInstructionBg, nightTargetHeadingBg, phaseGuideBg, roleWakeHint, winnerBg } from "../copy";
import { formatPrivateResult, ROLE_GUIDE_BG } from "../private-copy";

describe("nightTargetHeadingBg", () => {
  it.each([
    ["healer", "Защита за Борис"],
    ["doctor", "Защита за Борис"],
    ["bodyguard", "Защита за Борис"],
    ["priest", "Благословия за Борис"],
    ["commissioner", "Проверка на Борис"],
    ["detective", "Проверка на Борис"],
    ["informant", "Проверка на Борис"],
    ["don", "Проверка на Борис"],
    ["seer", "Проверка на Борис"],
    ["oracle", "Проверка на Борис"],
    ["investigator", "Проверка на Борис"],
    ["lawyer", "Алиби за Борис"],
    ["medium", "Връзка с Борис"],
    ["roleblocker", "Блокиране на Борис"],
    ["witch", "Решение за Борис"],
    ["stray_cat", "Избран дом: Борис"],
    ["thief", "Кражба от Борис"],
    ["cupid", "Първа връзка: Борис"],
    ["lovers", "Първа връзка: Борис"],
    ["blacksmith", "Първа цел: Борис"],
    ["werewolf", "Нощна цел: Борис"],
    ["vampire", "Нощна цел: Борис"],
    ["mafioso", "Нощна цел: Борис"],
  ] as const)("uses role-appropriate copy for %s", (role, expected) => {
    expect(nightTargetHeadingBg(role, "Борис")).toBe(expected);
  });
});

const anna: PublicPlayer = {
  userId: "anna", displayName: "Анна", connected: true, ready: true,
  playing: true, alive: true, host: false, narrator: false,
  acceptedFullNarrator: true, mayor: false, hasVoted: false,
  actedThisPhase: false, revealedRole: "",
};

describe("truthful play guidance", () => {
  it.each(["mafia_free", "mafia_sport"] as const)("inherits common guidance without losing %s overrides", (mode) => {
    for (const phase of ["role_reveal", "nomination", "defense", "voting", "resolution"] as const) {
      expect(phaseGuideBg(phase, mode).wakes).toBe(phaseGuideBg(phase, "werewolves_classic").wakes);
    }
    for (const phase of ["day_announcement", "resolution"] as const) {
      expect(phaseGuideBg(phase, mode).body).toBe(phaseGuideBg(phase, "werewolves_classic").body);
    }
    expect(phaseGuideBg("role_reveal", mode).title).toBe("Виж тайно досието си");
    expect(phaseGuideBg("nomination", mode).title).toBe(mode === "mafia_sport" ? "Преглед на номинациите" : "Обвинения");
    expect(phaseGuideBg("day_announcement", mode).wakes).toBe("Градът се събужда.");
  });

  it("limits Sport Mafia nominations to the current speaker's daytime speech", () => {
    const speech = phaseGuideBg("day_discussion", "mafia_sport");
    expect(speech.title).toBe("Дневни речи");
    expect(speech.body).toContain("Само текущият говорител може да номинира друг жив играч");
    expect(speech.body).toContain("смени номинацията си");
    expect(speech.wakes).toBe("Говори и номинира само текущият говорител.");

    const review = phaseGuideBg("nomination", "mafia_sport");
    expect(review.title).toBe("Преглед на номинациите");
    expect(review.body).toContain("Номинациите от дневните речи са приключили");
    expect(review.body).toContain("без номинирани денят завършва без гласуване");
    expect(review.wakes).toBe("В тази фаза не се подават номинации.");
  });

  it.each(["mafia_free", "werewolves_classic"] as const)("does not promise Sport Mafia commands in %s", (mode) => {
    expect(phaseGuideBg("day_discussion", mode).wakes).toBe("Всички живи играчи говорят.");
    const nomination = phaseGuideBg("nomination", mode);
    expect(nomination.body).toContain("само в Спортна Мафия, по време на дневните речи");
    expect(nomination.wakes).toBe("В тази фаза не се подават номинации.");
  });

  it("limits Sport Mafia voting guidance to the eligible nominees", () => {
    const { body } = phaseGuideBg("voting", "mafia_sport");
    expect(body).toContain("гласува сред номинираните");
    expect(body).toContain("При прегласуване изборът е само между останалите кандидати");
    expect(phaseGuideBg("voting", "mafia_free").body).not.toContain("номинираните");
  });

  it("describes a single blessing with persistent protection from night deaths", () => {
    const { summary } = ROLE_GUIDE_BG.priest!;
    expect(summary).toContain("Веднъж благославяш");
    expect(summary).toContain("от нощна смърт до края на играта");
    expect(summary).toContain("не се изчерпва при атака");
    expect(summary).not.toContain("първото убийство");
    expect(nightActionHelpBg("priest")).toContain("защитата остава до края на играта");
  });

  it("describes the canonical seer as a threat check, not an exact-role check", () => {
    expect(nightInstructionBg("seer")).toContain(ROLE_DEFINITIONS.seer.nameBg);
    expect(nightInstructionBg("seer")).toContain("заплаха");
    expect(nightActionHelpBg("seer")).toContain("дали");
    expect(nightActionHelpBg("seer")).toContain("Върколак или Вампир");
    expect(nightActionHelpBg("seer")).not.toMatch(/вижда точната роля|Ясновидка/u);
  });

  it("does not present Don or Witch actions as mutually exclusive", () => {
    expect(ROLE_GUIDE_BG.don?.summary).not.toContain("убийството или");
    expect(nightActionHelpBg("don")).not.toContain("убийството или");
    expect(nightInstructionBg("don")).not.toContain("жертва или");
    expect(nightInstructionBg("witch")).not.toContain("лекува или");
  });

  it("explains readiness as automatic-start eligibility, not a host-start requirement", () => {
    const { body } = phaseGuideBg("lobby", "werewolves_classic");
    expect(body).toContain("автоматично");
    expect(body).toContain("Домакинът може да започне и без всички да са готови");
    expect(body).not.toContain("Всички трябва да са готови преди началото");
  });

  it.each(["mayor_successor", "paused"] as const)("uses natural host copy during %s", (phase) => {
    const guide = phaseGuideBg(phase, "werewolves_classic");
    expect(`${guide.body} ${guide.wakes}`).not.toMatch(/хост/u);
    expect(`${guide.body} ${guide.wakes}`).toContain("домакин");
  });

  it("does not give a spectator a retained role's active instruction", () => {
    expect(roleWakeHint("seer", "night", { ...anna, playing: false })).toContain("наблюдаваш");
  });

  it("lets the eliminated Hunter see the revenge hint before the generic death hint", () => {
    expect(roleWakeHint("hunter", "hunter_revenge", { ...anna, alive: false })).toContain("изстрел");
    expect(roleWakeHint("hunter", "night", { ...anna, alive: false })).toContain("елиминиран");
    expect(roleWakeHint("seer", "hunter_revenge", { ...anna, alive: false })).toContain("елиминиран");
  });

  it("does not offer a living Hunter a revenge shot", () => {
    expect(roleWakeHint("hunter", "hunter_revenge", anna)).not.toContain("избери");
  });
});

describe("role goals", () => {
  it.each(["civilian", "commissioner"] as const)("includes the optional Maniac in %s's town goal", (role) => {
    expect(ROLE_GUIDE_BG[role]?.win).toBe("Елиминирайте Мафията и Маниака, ако участва");
    expect(evaluateWinCondition([
      { playerId: "town", role, alive: true },
      { playerId: "mafia", role: "mafioso", alive: false },
      { playerId: "killer", role: "maniac", alive: true },
      { playerId: "doctor", role: "doctor", alive: true },
    ]).winner).toBeNull();
  });

  it.each([
    ["mafioso", "maniac", "Маниака", "mafia"],
    ["don", "maniac", "Маниака", "mafia"],
    ["werewolf", "vampire", "Вампирите", "werewolves"],
    ["vampire", "werewolf", "Върколаците", "vampires"],
  ] as const)("does not equate %s parity with victory while %s survives", (role, rival, rivalName, winner) => {
    const goal = ROLE_GUIDE_BG[role]!.win;
    expect(goal).toContain(`Елиминирайте ${rivalName}, ако участва`);
    expect(goal).toContain("контрола над гласуването");
    expect(goal).not.toContain("паритет");
    const players = [
      { playerId: "faction-1", role, alive: true },
      { playerId: "faction-2", role, alive: true },
      { playerId: "rival", role: rival, alive: true },
      { playerId: "town", role: "ordinary_villager" as RoleCode, alive: true },
    ];
    expect(evaluateWinCondition(players).winner).toBeNull();
    expect(evaluateWinCondition(players.map((player) => player.playerId === "rival" ? { ...player, alive: false } : player)).winner).toBe(winner);
  });

  it.each(["ordinary_villager", "seer", "witch", "healer", "priest", "hunter", "cupid", "little_girl"] as const)("gives %s a village goal rather than a tactical task", (role) => {
    expect(ROLE_GUIDE_BG[role]?.win).toBe("Печелиш със селото след елиминиране на Върколаците и Вампирите");
  });

  it("keeps personal and changing-role goals distinct from faction goals", () => {
    expect(ROLE_GUIDE_BG.jester?.win).toBe("Бъди изгонен през гласуване");
    expect(ROLE_GUIDE_BG.thief?.win).toBe("След кражбата следваш целта на новата си роля");
  });
});

describe("formatPrivateResult", () => {
  it.each([
    [true, "Видението потвърди нощна заплаха."],
    [false, "Видението не откри Върколак или Вампир."],
  ])("keeps the target with the server-authored threat result %s", (isEvil, messageBg) => {
    const result = formatPrivateResult({ targetUserId: "anna", isEvil: isEvil as boolean, messageBg: messageBg as string }, [anna]);
    expect(result).toBe(`Проверката е за Анна. ${messageBg}`);
    expect(result).not.toMatch(/Анна е (Върколак|Вампир|Гадателка)/u);
  });

  it("preserves an inconclusive server message without fabricating an outcome", () => {
    const messageBg = "Не успя да получиш отговор.";
    expect(formatPrivateResult({ targetUserId: "anna", messageBg }, [anna]))
      .toBe(`Проверката е за Анна. ${messageBg}`);
  });

  it("uses a neutral target fallback without disclosing an identifier", () => {
    expect(formatPrivateResult({ targetUserId: "missing-user-id", messageBg: "Проверката изглежда чиста." }, []))
      .toBe("Проверката е за избрания играч. Проверката изглежда чиста.");
  });

  it("identifies the whole investigated group, not only its centre", () => {
    const players = [anna, { ...anna, userId: "boris", displayName: "Борис" }, { ...anna, userId: "vera", displayName: "Вера" }];
    const result = formatPrivateResult({ targetUserId: "boris", targetUserIds: ["anna", "boris", "vera"], isEvil: true, messageBg: "В тройката има нощна заплаха." }, players);
    expect(result).toBe("Проверката е за групата Анна, Борис, Вера. В тройката има нощна заплаха.");
    expect(result).not.toContain("Борис е от злата страна");
  });

  it("keeps targetless private notices unchanged", () => {
    expect(formatPrivateResult({ targetUserId: "", messageBg: "Не усети движение тази нощ." }, [anna]))
      .toBe("Не усети движение тази нощ.");
  });

  it("retains exact roles only when explicitly provided by the private result", () => {
    expect(formatPrivateResult({ targetUserId: "anna", role: "seer" }, [anna]))
      .toBe(`Анна е ${ROLE_DEFINITIONS.seer.nameBg}.`);
  });
});

describe("winnerBg", () => {
  it("uses citizens for a village-team Mafia victory and preserves the one-argument API", () => {
    expect(winnerBg("village", "mafia")).toBe("Гражданите печелят");
    expect(winnerBg("village", "werewolves")).toBe("Селото печели");
    expect(winnerBg("village")).toBe("Селото печели");
    expect(winnerBg("mafia", "mafia")).toBe("Мафията печели");
    expect(winnerBg("unknown")).toBe("unknown");
  });
});
