import { describe, expect, it } from "vitest";
import { initialState, queryFromState } from "./url";
import { lobbyFormReducer } from "./reducer";
import { estimatedDurationSeconds, optionsFromState } from "./selectors";

describe("lobby form configuration invariants", () => {
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
