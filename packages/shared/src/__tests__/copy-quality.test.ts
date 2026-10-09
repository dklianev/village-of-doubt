import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, getAchievementById } from "../achievements.js";
import { MAFIA_ROLE_DEFINITIONS } from "../games/mafia/roles.js";
import { MAFIA_RULES_BG } from "../games/mafia/rules.js";
import { WEREWOLF_ROLE_DEFINITIONS } from "../games/werewolf/roles.js";
import { WEREWOLF_RULES_BG } from "../games/werewolf/rules.js";

describe("Bulgarian production copy", () => {
  it("explains the Jester's immediate private win and concealed night death", () => {
    const role = MAFIA_ROLE_DEFINITIONS.jester;
    expect(role.availableInFamilies).toEqual(["mafia", "werewolves"]);
    expect(role.winConditionBg).toBe("Печели лично, ако бъде елиминиран чрез дневно гласуване.");
    expect(role.fullDescriptionBg).toContain("чрез дневно гласуване, веднага печелиш лична победа");
    expect(role.fullDescriptionBg).toContain("Само ти получаваш съобщение за нея");
    expect(role.fullDescriptionBg).toContain("не прекратява автоматично играта");
    expect(role.fullDescriptionBg).toContain("В игра с Шут ролите на елиминираните остават скрити до края");
    expect(role.fullDescriptionBg).toContain("Тогава се разкриват всички роли и останалите научават за личната ти победа");
    expect(role.fullDescriptionBg).toContain("При нощна смърт не печелиш");
  });

  it.each([MAFIA_RULES_BG, WEREWOLF_RULES_BG])("explains the private Jester outcome in $gameId rules", (rules) => {
    expect(rules.sections[1].bulletsBg.join(" ")).toContain("Разкриването на роли при смърт е по избор само в игра без Шут");
    const jester = rules.sections.flatMap((section) => [...section.bulletsBg])
      .find((bullet) => bullet.startsWith("Шутът"));
    expect(jester).toBeDefined();
    expect(jester).toContain("веднага печели лична победа при елиминиране чрез дневно гласуване");
    expect(jester).toContain("Само той получава съобщение за нея");
    expect(jester).toContain("не прекратява автоматично играта");
    expect(jester).toContain("В игра с Шут ролите на елиминираните остават скрити до края");
    expect(jester).toContain("Тогава се разкриват всички роли и личната победа на Шута, ако е спечелена");
    expect(jester).toContain("При нощна смърт той не печели");
  });

  it("описва Първа кръв според реалното условие за отключване", () => {
    expect(getAchievementById("first_blood")?.descriptionBg).toBe(
      "Напускаш играта още през първата нощ.",
    );
  });

  it("не показва вътрешни или англоезични термини в роли и правила", () => {
    const roleCopy = [...Object.values(WEREWOLF_ROLE_DEFINITIONS), ...Object.values(MAFIA_ROLE_DEFINITIONS)]
      .flatMap((role) => [role.nameBg, role.shortDescriptionBg, role.fullDescriptionBg, role.winConditionBg ?? ""])
      .join("\n");
    const rulesCopy = [WEREWOLF_RULES_BG, MAFIA_RULES_BG]
      .flatMap((rules) => [
        rules.introBg,
        ...rules.sections.flatMap((section) => [section.titleBg, section.bodyBg, ...section.bulletsBg]),
      ])
      .join("\n");
    const achievementCopy = ACHIEVEMENTS.flatMap((achievement) => [
      achievement.titleBg,
      achievement.descriptionBg,
    ]).join("\n");

    expect(`${roleCopy}\n${rulesCopy}\n${achievementCopy}`).not.toMatch(/\badvanced\b|чат/iu);
  });
});
