import { describe, expect, it } from "vitest";
import { phaseLabelBg } from "../phase-vocabulary.js";

describe("phaseLabelBg", () => {
  it("returns werewolf-specific defaults for werewolves_classic", () => {
    expect(phaseLabelBg("night", "werewolves_classic")).toBe("Нощ");
    expect(phaseLabelBg("first_night", "werewolves_classic")).toContain("Първа нощ");
  });

  it("returns mafia-specific labels for mafia_sport", () => {
    expect(phaseLabelBg("night", "mafia_sport")).toBe("Нощни договорки");
    expect(phaseLabelBg("resolution", "mafia_sport")).toBe("Присъда");
  });

  it("keeps family labels non-empty", () => {
    expect(phaseLabelBg("day_discussion", "werewolves")).toBeTruthy();
    expect(phaseLabelBg("day_discussion", "mafia")).toBeTruthy();
  });

  it("returns a safe runtime fallback for an unknown phase", () => {
    expect(phaseLabelBg("unknown_phase" as never, "werewolves_classic")).toBe("unknown_phase");
  });
});
