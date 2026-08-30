import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, getAchievementById } from "../achievements.js";
import { MAFIA_ROLE_DEFINITIONS } from "../games/mafia/roles.js";
import { MAFIA_RULES_BG } from "../games/mafia/rules.js";
import { WEREWOLF_ROLE_DEFINITIONS } from "../games/werewolf/roles.js";
import { WEREWOLF_RULES_BG } from "../games/werewolf/rules.js";

describe("Bulgarian production copy", () => {
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
