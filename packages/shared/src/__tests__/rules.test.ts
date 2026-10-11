import { describe, expect, it } from "vitest";
import { MAFIA_RULES_BG } from "../games/mafia/rules.js";
import { WEREWOLF_RULES_BG } from "../games/werewolf/rules.js";
import { evaluateWinCondition } from "../win-conditions.js";

describe("onboarding rules", () => {
  it.each([MAFIA_RULES_BG, WEREWOLF_RULES_BG])("keeps $gameId basics before optional roles without duplicate day/night chapters", (rules) => {
    expect(rules.sections.map((section) => section.titleBg)).toEqual([
      "Цел на играта", "Преди първата игра", expect.stringContaining("по избор"),
    ]);
    expect(rules.sections[1].bulletsBg.join(" ")).toContain("След елиминация не гласуваш");
  });

  it("does not teach a formal Werewolf nomination flow", () => {
    expect(JSON.stringify(WEREWOLF_RULES_BG)).not.toMatch(/номинир|номинаци/iu);
  });

  it("explains why a living Maniac prevents either main Mafia team winning", () => {
    const [objective, , optional] = MAFIA_RULES_BG.sections;
    expect(objective.bulletsBg[0]).toContain("няма жив Маниак");
    expect(objective.bulletsBg[1]).toContain("Жив Маниак блокира тази победа");
    expect(optional.bulletsBg[1]).toContain("няма друга жива смъртоносна страна");
    expect(optional.bulletsBg[2]).toContain("не прекратява автоматично играта");
    const players = [
      { playerId: "mafia-1", role: "mafioso" as const, alive: true },
      { playerId: "mafia-2", role: "mafioso" as const, alive: true },
      { playerId: "maniac", role: "maniac" as const, alive: true },
      { playerId: "citizen", role: "civilian" as const, alive: true },
    ];
    expect(evaluateWinCondition(players).winner).toBeNull();
    expect(evaluateWinCondition(players.filter((player) => player.role !== "mafioso")).winner).toBe("maniac");
    expect(evaluateWinCondition(players.filter((player) => player.role !== "maniac")).winner).toBe("mafia");
  });

  it("explains rival lethal factions and optional Werewolf victory exceptions", () => {
    const [objective, , optional] = WEREWOLF_RULES_BG.sections;
    expect(objective.bulletsBg[0]).toContain("всички включени Вампири");
    expect(objective.bulletsBg[1]).toContain("Докато има живи Вампири, играта продължава");
    expect(optional.bulletsBg[0]).toContain("няма друга жива смъртоносна страна, включително Върколаци");
    expect(optional.bulletsBg[2]).toContain("последните двама живи");
    expect(optional.bulletsBg[3]).toContain("Готвачът е изключение");
    expect(evaluateWinCondition([
      { playerId: "wolf-1", role: "werewolf", alive: true },
      { playerId: "wolf-2", role: "werewolf", alive: true },
      { playerId: "vampire", role: "vampire", alive: true },
      { playerId: "villager", role: "ordinary_villager", alive: true },
    ]).winner).toBeNull();
  });
});
