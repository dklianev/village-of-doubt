import { describe, expect, it } from "vitest";
import { ROLE_DEFINITIONS } from "@werewolf/shared";
import type { PublicPlayer } from "../types";
import { nightActionHelpBg, nightInstructionBg, nightTargetHeadingBg, phaseGuideBg, roleWakeHint, winnerBg } from "../copy";
import { formatPrivateResult, ROLE_GUIDE_BG } from "../private-copy";

describe("nightTargetHeadingBg", () => {
  it.each([
    ["doctor", "Защита за Борис"],
    ["priest", "Благословия за Борис"],
    ["seer", "Проверка на Борис"],
    ["lawyer", "Алиби за Борис"],
    ["werewolf", "Нощна цел: Борис"],
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
