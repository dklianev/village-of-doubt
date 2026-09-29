import { describe, expect, it } from "vitest";
import {
  readPractice,
  TUTORIAL_MODES,
  TUTORIAL_PLAYERS,
  tutorialMode,
  tutorialWorld,
} from "../tutorial-scenario";
import { nightFinding, playerName } from "../tutorial-feedback";

describe("authored tutorial scenario", () => {
  it.each(TUTORIAL_MODES)("honors explicit %s over an invitation family", (mode) => {
    expect(tutorialMode(mode, "/mafia/join/ABC123?mode=mafia_sport")).toBe(mode);
    expect(tutorialMode(mode, "/werewolf/join/ABC123")).toBe(mode);
  });

  it.each([
    [null, null, "werewolves_classic"],
    ["unknown", null, "werewolves_classic"],
    [null, "/mafia", "mafia_free"],
    [null, "/mafia/join/ABC123?from=friend#invite", "mafia_free"],
    [null, "/mafia/create?mode=mafia_sport", "mafia_sport"],
    [null, "/mafia/create?mode=unknown", "mafia_free"],
    [null, "/mafia-other/join", "werewolves_classic"],
    [null, "/werewolf/join/ABC123", "werewolves_classic"],
  ])("resolves %s and safe destination %s to %s", (game, redirect, expected) => {
    expect(tutorialMode(game, redirect)).toBe(expected);
  });

  it.each([
    ["werewolves_classic", "werewolf", "Гадателка", "/werewolf/create"],
    ["mafia_free", "mafia", "Комисар", "/mafia/create"],
    ["mafia_sport", "mafia", "Комисар", "/mafia/create?mode=mafia_sport"],
  ] as const)("keeps %s role and creation destination in its family", (mode, family, role, create) => {
    expect(tutorialWorld(mode)).toMatchObject({ family, role, create });
  });

  it("uses three synthetic players with distinct portraits", () => {
    expect(TUTORIAL_PLAYERS.map(({ name }) => name)).toEqual(["Анна", "Борис", "Галя"]);
    expect(new Set(TUTORIAL_PLAYERS.map(({ portrait }) => portrait)).size).toBe(3);
    expect(playerName(null)).toBe("");
    expect(playerName("boris")).toBe("Борис");
  });

  it.each([null, undefined, false, 12, "invalid", [], {}])("defaults invalid stored practice %j", (value) => {
    expect(readPractice(value)).toEqual({ night: null, vote: null, visited: [] });
  });

  it("preserves committed actions and sanitizes visited players without mutating storage input", () => {
    const value = { night: "boris", vote: "anna", visited: ["galya", "boris", "boris", "unknown", null] };
    expect(readPractice(value)).toEqual({ night: "boris", vote: "anna", visited: ["galya", "boris"] });
    expect(value.visited).toEqual(["galya", "boris", "boris", "unknown", null]);
    expect(readPractice({ night: "Анна", vote: {}, visited: "boris" })).toEqual({ night: null, vote: null, visited: [] });
  });

  it.each(TUTORIAL_MODES)("keeps Boris the authored threat in %s", (mode) => {
    const expected = mode === "werewolves_classic"
      ? ["Анна не е нощна заплаха.", "Борис е нощна заплаха.", "Галя не е нощна заплаха."]
      : ["Анна не е от Мафията.", "Борис е от Мафията.", "Галя не е от Мафията."];
    expect(TUTORIAL_PLAYERS.map(({ id }) => nightFinding(mode, id))).toEqual(expected);
  });
});
