import { describe, expect, it } from "vitest";
import { countRoles, type GameFamily } from "@werewolf/shared";
import { lobbyFormReducer } from "./reducer";
import { adjustManualRoleRoster, currentConfig, criticalRoleWarnings } from "./selectors";
import { initialState } from "./url";

describe("create capacity validation", () => {
  it.each(["werewolves", "mafia"] as const)("keeps %s configuration valid for invalid capacity input", (family) => {
    const initial = initialState({ family });
    for (const [value, expected] of [
      [31, 30],
      [13.5, 14],
      [Number.NaN, initial.playerCount],
      [Number.POSITIVE_INFINITY, initial.playerCount],
      [Number.NEGATIVE_INFINITY, initial.playerCount],
      [0, initial.playerCount],
      [-1, initial.playerCount],
      [30, 30],
    ] as const) {
      const state = lobbyFormReducer(initial, { type: "SET_ADVANCED", key: "maxPlayers", value });
      expect(() => currentConfig(state)).not.toThrow();
      expect(currentConfig(state).maxPlayers).toBe(expected);
    }
  });

  it("retains a previously chosen valid capacity when a numeric input is incomplete", () => {
    let state = lobbyFormReducer(initialState({ family: "werewolves" }), {
      type: "SET_ADVANCED", key: "maxPlayers", value: 18,
    });
    state = lobbyFormReducer(state, { type: "SET_ADVANCED", key: "maxPlayers", value: Number.NaN });
    expect(currentConfig(state).maxPlayers).toBe(18);
  });

  it("keeps sport capacity fixed even when an invalid capacity action is received", () => {
    const initial = initialState({ family: "mafia", urlParams: new URLSearchParams("mode=mafia_sport") });
    const state = lobbyFormReducer(initial, { type: "SET_ADVANCED", key: "maxPlayers", value: 31 });
    expect(currentConfig(state).maxPlayers).toBe(10);
  });
});

function editedRoster(family: GameFamily) {
  const initial = lobbyFormReducer(initialState({ family }), { type: "SET_MANUAL_ROLES_ENABLED", enabled: true });
  const adjusted = adjustManualRoleRoster({
    family,
    roles: initial.manualRoles,
    playerCount: initial.playerCount,
    role: family === "werewolves" ? "healer" : "detective",
    delta: 1,
  });
  return lobbyFormReducer(initial, { type: "SET_MANUAL_ROLES", roles: adjusted.roles });
}

describe.each(["werewolves", "mafia"] as const)("%s manual history after resizing", (family) => {
  it.each([-1, 1])("does not undo a roster edit from a different table size after a %i resize", (delta) => {
    const edited = editedRoster(family);
    const players = edited.playerCount + delta;
    const resized = lobbyFormReducer(edited, { type: "SET_PLAYER_COUNT", playerCount: players });
    const undone = lobbyFormReducer(resized, { type: "UNDO_MANUAL_ROLES" });

    expect(countRoles(currentConfig(undone).roles)).toBe(players);
    expect(undone.manualRoles).toEqual(resized.manualRoles);
    expect(criticalRoleWarnings(undone)).toEqual([]);
  });

  it.each([-1, 1])("does not redo a roster edit from a different table size after a %i resize", (delta) => {
    const undone = lobbyFormReducer(editedRoster(family), { type: "UNDO_MANUAL_ROLES" });
    const players = undone.playerCount + delta;
    const resized = lobbyFormReducer(undone, { type: "SET_PLAYER_COUNT", playerCount: players });
    const redone = lobbyFormReducer(resized, { type: "REDO_MANUAL_ROLES" });

    expect(countRoles(currentConfig(redone).roles)).toBe(players);
    expect(redone.manualRoles).toEqual(resized.manualRoles);
    expect(criticalRoleWarnings(redone)).toEqual([]);
  });

  it("retains working undo and redo when the player count does not change", () => {
    const edited = editedRoster(family);
    const unchanged = lobbyFormReducer(edited, { type: "SET_PLAYER_COUNT", playerCount: edited.playerCount });
    const undone = lobbyFormReducer(unchanged, { type: "UNDO_MANUAL_ROLES" });
    const role = family === "werewolves" ? "healer" : "detective";

    expect(undone.manualRoles[role]).toBeUndefined();
    expect(lobbyFormReducer(undone, { type: "REDO_MANUAL_ROLES" }).manualRoles).toEqual(edited.manualRoles);
  });

  it("records new role edits at the resized table size", () => {
    const edited = editedRoster(family);
    const resized = lobbyFormReducer(edited, { type: "SET_PLAYER_COUNT", playerCount: edited.playerCount + 1 });
    const adjusted = adjustManualRoleRoster({
      family, roles: resized.manualRoles, playerCount: resized.playerCount, role: "jester", delta: 1,
    });
    const changed = lobbyFormReducer(resized, { type: "SET_MANUAL_ROLES", roles: adjusted.roles });
    const undone = lobbyFormReducer(changed, { type: "UNDO_MANUAL_ROLES" });

    expect(undone.manualRoles).toEqual(resized.manualRoles);
    expect(lobbyFormReducer(undone, { type: "REDO_MANUAL_ROLES" }).manualRoles).toEqual(changed.manualRoles);
    expect(countRoles(undone.manualRoles)).toBe(resized.playerCount);
  });
});
