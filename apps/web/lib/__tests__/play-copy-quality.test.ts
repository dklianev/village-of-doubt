import { describe, expect, it } from "vitest";
import {
  ROLE_GUIDE_BG,
  communicationBg,
  narratorBg,
  nightActionHelpBg,
  phaseGuideBg,
  tempoBg,
} from "@/lib/play/copy";

describe("play copy quality", () => {
  it("describes role mechanics without contradicting the authoritative rules", () => {
    expect(ROLE_GUIDE_BG.seer?.summary).toContain("дали избран играч е Върколак или Вампир");
    expect(ROLE_GUIDE_BG.seer?.summary).not.toContain("точната роля");
    expect(ROLE_GUIDE_BG.healer?.summary).toContain("Не можеш да пазиш себе си");
    expect(nightActionHelpBg("doctor")).toContain("нощна смърт");
  });

  it("addresses the acting player directly", () => {
    expect(nightActionHelpBg("mafioso")).toMatch(/^Координирай се/u);
    expect(nightActionHelpBg("werewolf")).toMatch(/^Избери/u);
  });

  it("uses natural labels for narrator, communication, and tempo settings", () => {
    expect(narratorBg("honest_human")).toBe("Човешки Разказвач");
    expect(narratorBg("full_human")).toBe("Пълен Разказвач");
    expect(communicationBg("system_only")).toBe("Само системни съобщения");
    expect(tempoBg("fast_online")).toBe("Бърза онлайн игра");
    expect(tempoBg("normal_online")).toBe("Стандартна онлайн игра");
  });

  it("explains phases as player-facing rules rather than implementation notes", () => {
    const copy = [
      phaseGuideBg("night", "werewolves_classic"),
      phaseGuideBg("day_discussion", "werewolves_classic"),
      phaseGuideBg("resolution", "werewolves_classic"),
      phaseGuideBg("voting", "mafia_free"),
      phaseGuideBg("resolution", "mafia_free"),
    ];

    expect(copy.map(({ body }) => body).join(" ")).not.toMatch(/сървър|източникът на истината|валидира/u);
  });
});
