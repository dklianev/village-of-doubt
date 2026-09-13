import { describe, expect, it, vi } from "vitest";

vi.mock("../game-config.js", () => {
  throw new Error("Phase labels must not load room configuration");
});
vi.mock("../roles.js", () => {
  throw new Error("Phase labels must not load role catalogues");
});

describe("standalone phase vocabulary", () => {
  it("resolves family and mode labels without configuration or role data", async () => {
    const vocabulary = import("../phase-vocabulary.js");
    await expect(vocabulary).resolves.toHaveProperty("phaseLabelBg");
    const { phaseLabelBg } = await vocabulary;

    expect(phaseLabelBg("night", "werewolves_classic")).toBe("Нощ");
    expect(phaseLabelBg("night", "mafia_free")).toBe("Сделките започват");
    expect(phaseLabelBg("night", "mafia_sport")).toBe("Нощни договорки");
    expect(phaseLabelBg("day_discussion", "mafia_sport")).toBe("Речи на масата");
    expect(phaseLabelBg("voting", "mafia")).toBe("Обвинение");
    expect(phaseLabelBg("voting")).toBe("Гласуване");
    expect(phaseLabelBg("paused", "mafia_sport")).toBe("Пауза");
  });
});
