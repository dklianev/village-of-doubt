import { describe, expect, it } from "vitest";
import { initialState, queryFromState } from "./url";
import { lobbyFormReducer } from "./reducer";
import {
  adjustManualRoleRoster,
  estimatedDurationSeconds,
  optionsFromState,
  replaceManualRoleInRoster,
} from "./selectors";

describe("lobby form configuration invariants", () => {
  it("replaces a villager when a special role is added to a full werewolf table", () => {
    const result = adjustManualRoleRoster({
      family: "werewolves",
      playerCount: 12,
      role: "healer",
      delta: 1,
      roles: {
        ordinary_villager: 6,
        werewolf: 3,
        seer: 1,
        witch: 1,
        hunter: 1,
      },
    });

    expect(result.status).toBe("changed");
    expect(result.roles).toEqual({
      ordinary_villager: 5,
      werewolf: 3,
      seer: 1,
      witch: 1,
      hunter: 1,
      healer: 1,
    });
    expect(result.removedRole).toBe("ordinary_villager");
  });

  it("returns a removed special role to the table as a villager", () => {
    const result = adjustManualRoleRoster({
      family: "werewolves",
      playerCount: 12,
      role: "healer",
      delta: -1,
      roles: {
        ordinary_villager: 5,
        werewolf: 3,
        seer: 1,
        witch: 1,
        hunter: 1,
        healer: 1,
      },
    });

    expect(result.status).toBe("changed");
    expect(result.roles.healer).toBeUndefined();
    expect(result.roles.ordinary_villager).toBe(6);
    expect(result.addedRole).toBe("ordinary_villager");
  });

  it("asks for an explicit replacement when a full table has no ordinary role", () => {
    const result = adjustManualRoleRoster({
      family: "werewolves",
      playerCount: 12,
      role: "priest",
      delta: 1,
      roles: {
        werewolf: 3,
        vampire: 3,
        seer: 1,
        witch: 1,
        healer: 1,
        hunter: 1,
        oracle: 1,
        cupid: 1,
      },
    });

    expect(result.status).toBe("replacement-required");
    expect(result.roles).not.toHaveProperty("priest");
  });

  it("uses a civilian as the reserve seat for a full mafia table", () => {
    const result = adjustManualRoleRoster({
      family: "mafia",
      playerCount: 10,
      role: "detective",
      delta: 1,
      roles: {
        civilian: 5,
        commissioner: 1,
        doctor: 1,
        mafioso: 2,
        don: 1,
      },
    });

    expect(result.status).toBe("changed");
    expect(result.roles.civilian).toBe(4);
    expect(result.roles.detective).toBe(1);
    expect(result.removedRole).toBe("civilian");
  });

  it("replaces an explicitly selected role when no reserve seat remains", () => {
    const result = replaceManualRoleInRoster({
      addRole: "priest",
      removeRole: "vampire",
      roles: {
        werewolf: 3,
        vampire: 3,
        seer: 1,
        witch: 1,
        healer: 1,
        hunter: 1,
        oracle: 1,
        cupid: 1,
      },
    });

    expect(result.priest).toBe(1);
    expect(result.vampire).toBe(2);
    expect(Object.values(result).reduce((sum, count) => sum + (count ?? 0), 0)).toBe(12);
  });

  it("fills new manual werewolf seats with villagers when the table grows", () => {
    const configured = lobbyFormReducer(initialState({ family: "werewolves" }), {
      type: "SET_MANUAL_ROLES",
      roles: {
        ordinary_villager: 6,
        werewolf: 3,
        seer: 1,
        witch: 1,
        hunter: 1,
      },
    });

    const resized = lobbyFormReducer(configured, { type: "SET_PLAYER_COUNT", playerCount: 14 });

    expect(resized.manualRoles).toEqual({
      ordinary_villager: 8,
      werewolf: 3,
      seer: 1,
      witch: 1,
      hunter: 1,
    });
  });

  it("removes reserve civilians before special roles when a manual Mafia table shrinks", () => {
    const configured = lobbyFormReducer(initialState({ family: "mafia" }), {
      type: "SET_MANUAL_ROLES",
      roles: {
        civilian: 5,
        commissioner: 1,
        doctor: 1,
        mafioso: 2,
        don: 1,
      },
    });

    const resized = lobbyFormReducer(configured, { type: "SET_PLAYER_COUNT", playerCount: 8 });

    expect(resized.manualRoles).toEqual({
      civilian: 3,
      commissioner: 1,
      doctor: 1,
      mafioso: 2,
      don: 1,
    });
  });

  it("keeps a manual table seat-complete when it shrinks without reserve roles", () => {
    const configured = lobbyFormReducer(initialState({ family: "werewolves" }), {
      type: "SET_MANUAL_ROLES",
      roles: {
        werewolf: 3,
        vampire: 3,
        seer: 1,
        witch: 1,
        healer: 1,
        hunter: 1,
        oracle: 1,
        cupid: 1,
      },
    });

    const resized = lobbyFormReducer(configured, { type: "SET_PLAYER_COUNT", playerCount: 8 });

    expect(Object.values(resized.manualRoles).reduce((sum, count) => sum + (count ?? 0), 0)).toBe(8);
    expect(resized.manualRoles.werewolf).toBeGreaterThan(0);
    expect(resized.manualRoles.vampire).toBeGreaterThan(0);
  });

  it("serializes lovers from a manual Cupid roster", () => {
    const initial = initialState({
      family: "werewolves",
      urlParams: new URLSearchParams("players=9&preset=beginner"),
    });
    const state = lobbyFormReducer(initial, {
      type: "SET_MANUAL_ROLES",
      roles: {
        ordinary_villager: 4,
        werewolf: 2,
        seer: 1,
        hunter: 1,
        cupid: 1,
      },
    });

    expect(optionsFromState(state).loversEnabled).toBe(true);
  });

  it("drops a stale lovers flag when the manual roster has no Cupid", () => {
    const initial = initialState({
      family: "werewolves",
      urlParams: new URLSearchParams("players=9&preset=classic&lovers=1"),
    });
    const state = lobbyFormReducer(initial, {
      type: "SET_MANUAL_ROLES",
      roles: {
        ordinary_villager: 5,
        werewolf: 2,
        seer: 1,
        hunter: 1,
      },
    });

    expect(optionsFromState(state).loversEnabled).toBe(false);
  });

  it("omits an empty optional room name from create options", () => {
    const initial = initialState({ family: "mafia" });
    const state = lobbyFormReducer(initial, { type: "SET_ROOM_NAME", roomName: "" });

    expect(optionsFromState(state).roomName).toBeUndefined();
  });

  it("normalizes the retired Mafia Lovers card without changing the role total", () => {
    const state = initialState({
      family: "mafia",
      urlParams: new URLSearchParams(
        "mode=mafia_free&players=8&roles=civilian%3A4%2Ccommissioner%3A1%2Cmafioso%3A2%2Clovers%3A1",
      ),
    });

    expect(state.manualRoles.lovers).toBeUndefined();
    expect(state.manualRoles.civilian).toBe(5);
    expect(state.formError).toContain("стария избор");
  });

  it("normalizes a retired Mafia Lovers card loaded from a saved manual template", () => {
    const state = lobbyFormReducer(initialState({ family: "mafia" }), {
      type: "SET_MANUAL_ROLES",
      roles: {
        civilian: 4,
        commissioner: 1,
        mafioso: 2,
        lovers: 1,
      },
    });

    expect(state.manualRoles.lovers).toBeUndefined();
    expect(state.manualRoles.civilian).toBe(5);
  });

  it("falls back to a valid preset when a manual deep link contains roles from the wrong game", () => {
    const state = initialState({
      family: "werewolves",
      urlParams: new URLSearchParams(
        "mode=werewolves_classic&players=8&roles=civilian%3A5%2Cmafioso%3A2%2Ccommissioner%3A1",
      ),
    });

    expect(state.formError).toContain("невалидни роли");
    expect(state.manualRolesEnabled).toBe(false);
    expect(() => optionsFromState(state)).not.toThrow();
    expect(optionsFromState(state).roles).toBeUndefined();
  });

  it("preserves supported legacy options until a new experience is chosen", () => {
    const state = initialState({
      family: "werewolves",
      urlParams: new URLSearchParams(
        "mode=werewolves_classic&players=14&preset=advanced&visibility=public&beginner=1&advanced=1&variant=three_teams&mayorMode=public_vote&promo=1&spectator=1",
      ),
    });

    expect(optionsFromState(state)).toMatchObject({
      roomVisibility: "public",
      beginnerMode: true,
      advancedMode: true,
      werewolfVariant: "three_teams",
      mayorMode: "public_vote",
      promoRolesEnabled: true,
      spectator: true,
    });
    expect(queryFromState(state)).toContain("visibility=public");

    const reset = lobbyFormReducer(state, {
      type: "APPLY_TEMPLATE",
      template: {
        mode: "werewolves_classic",
        playerCount: 12,
        rolePreset: "classic",
      },
    });

    expect(optionsFromState(reset).roomVisibility).toBeUndefined();
    expect(optionsFromState(reset).werewolfVariant).toBeUndefined();
    expect(optionsFromState(reset).spectator).toBeUndefined();
  });

  it("estimates the per-player speaking rounds in sport Mafia", () => {
    const state = initialState({
      family: "mafia",
      urlParams: new URLSearchParams("mode=mafia_sport&players=10&preset=sport"),
    });

    expect(estimatedDurationSeconds(state)).toBeGreaterThanOrEqual(50 * 60);
  });
});
