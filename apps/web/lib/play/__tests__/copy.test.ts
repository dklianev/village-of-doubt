import { describe, expect, it } from "vitest";
import { nightTargetHeadingBg } from "../copy";

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
