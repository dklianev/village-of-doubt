import { describe, expect, it } from "vitest";
import { createGameConfigFromOptions, createRoomOptionsFromConfig } from "@werewolf/shared";
import { roomOptionsToQuery } from "@/lib/room-options";
import { initialState, queryFromState } from "./url";
import { lobbyFormReducer } from "./reducer";
import {
  adjustManualRoleRoster,
  createRoomCode,
  currentConfig,
  estimatedDurationSeconds,
  optionsFromState,
  replaceManualRoleInRoster,
} from "./selectors";

describe("lobby form configuration invariants", () => {
  it("generates room codes from cryptographically secure random values", () => {
    const fillRandomValues = (values: Uint32Array) => {
      values.set([0, 1, 2, 3, 4, 5]);
      return values;
    };

    expect(createRoomCode(fillRandomValues)).toBe("ABCDEF");
  });

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

describe.each(["werewolves", "mafia"] as const)("%s Jester death-reveal preference", (family) => {
  const mode = family === "mafia" ? "mafia_free" : "werewolves_classic";

  it.each([true, false])("preserves reveal=%s through a URL round-trip and Jester removal", (requested) => {
    const original = initialState({
      family,
      urlParams: new URLSearchParams({ mode, players: "10", reveal: String(Number(requested)) }),
    });
    const withJester = lobbyFormReducer(original, { type: "SET_ADVANCED", key: "jesterEnabled", value: true });
    const params = new URLSearchParams(queryFromState(withJester));
    expect(params.get("reveal")).toBe(String(Number(requested)));

    const hydrated = initialState({ family, urlParams: params });
    expect(hydrated.formError).toBe("");
    expect(hydrated.advanced.revealRolesOnDeath).toBe(requested);
    expect(currentConfig(hydrated).roles.jester).toBe(1);
    expect(currentConfig(hydrated).revealRolesOnDeath).toBe(false);
    expect(new URLSearchParams(queryFromState(hydrated)).get("reveal")).toBe(String(Number(requested)));

    const removed = lobbyFormReducer(hydrated, { type: "SET_ADVANCED", key: "jesterEnabled", value: false });
    expect(currentConfig(removed).roles.jester ?? 0).toBe(0);
    expect(currentConfig(removed).revealRolesOnDeath).toBe(requested);
  });

  it.each([true, false])("preserves reveal=%s when a URL-loaded manual Jester is removed", (requested) => {
    const roster = createGameConfigFromOptions({ mode, playerCount: 10, jesterEnabled: true }).roles;
    const hydrated = initialState({
      family,
      urlParams: new URLSearchParams(roomOptionsToQuery({
        mode, playerCount: 10, rolePreset: "manual", roles: roster,
        revealRolesOnDeath: requested, jesterEnabled: false,
      })),
    });
    expect(hydrated.formError).toBe("");
    expect(hydrated.manualRolesEnabled).toBe(true);
    expect(hydrated.advanced.revealRolesOnDeath).toBe(requested);
    expect(currentConfig(hydrated).revealRolesOnDeath).toBe(false);

    const adjustment = adjustManualRoleRoster({
      family, playerCount: 10, roles: hydrated.manualRoles, role: "jester", delta: -1,
    });
    expect(adjustment.status).toBe("changed");
    const removed = lobbyFormReducer(hydrated, { type: "SET_MANUAL_ROLES", roles: adjustment.roles });
    expect(currentConfig(removed).roles.jester ?? 0).toBe(0);
    expect(currentConfig(removed).revealRolesOnDeath).toBe(requested);
  });

  it.each([true, false])("restores reveal=%s below the Jester player threshold and retains it on reload", (requested) => {
    const hydrated = initialState({
      family,
      urlParams: new URLSearchParams({ mode, players: "10", jester: "1", reveal: String(Number(requested)) }),
    });
    expect(currentConfig(hydrated).roles.jester).toBe(1);
    expect(currentConfig(hydrated).revealRolesOnDeath).toBe(false);

    const smaller = lobbyFormReducer(hydrated, { type: "SET_PLAYER_COUNT", playerCount: 6 });
    expect(currentConfig(smaller).roles.jester ?? 0).toBe(0);
    expect(currentConfig(smaller).revealRolesOnDeath).toBe(requested);
    const reloaded = initialState({ family, urlParams: new URLSearchParams(queryFromState(smaller)) });
    expect(reloaded.formError).toBe("");
    expect(reloaded.advanced.revealRolesOnDeath).toBe(requested);
    expect(currentConfig(reloaded).revealRolesOnDeath).toBe(requested);

    const larger = lobbyFormReducer(reloaded, { type: "SET_PLAYER_COUNT", playerCount: 10 });
    expect(currentConfig(larger).roles.jester).toBe(1);
    expect(currentConfig(larger).revealRolesOnDeath).toBe(false);
    expect(larger.advanced.revealRolesOnDeath).toBe(requested);
  });

  it.each([true, false])("preserves reveal=%s in repeated-room options after manual Jester removal", (requested) => {
    const original = createGameConfigFromOptions({
      mode, playerCount: 10, jesterEnabled: true, revealRolesOnDeath: requested,
    });
    const options = createRoomOptionsFromConfig(original);
    expect(original.revealRolesOnDeath).toBe(false);
    expect(options.revealRolesOnDeath).toBe(requested);

    const repeated = initialState({ family, urlParams: new URLSearchParams(roomOptionsToQuery(options)) });
    expect(repeated.formError).toBe("");
    expect(currentConfig(repeated).roles).toEqual(original.roles);
    expect(currentConfig(repeated).revealRolesOnDeath).toBe(false);
    expect(repeated.advanced.revealRolesOnDeath).toBe(requested);

    const adjustment = adjustManualRoleRoster({
      family, playerCount: 10, roles: repeated.manualRoles, role: "jester", delta: -1,
    });
    const removed = lobbyFormReducer(repeated, { type: "SET_MANUAL_ROLES", roles: adjustment.roles });
    expect(currentConfig(removed).roles.jester ?? 0).toBe(0);
    expect(currentConfig(removed).revealRolesOnDeath).toBe(requested);
  });

  it("retains the default requested reveal when the URL enables Jester without a reveal option", () => {
    const hydrated = initialState({ family, urlParams: new URLSearchParams({ mode, players: "10", jester: "1" }) });
    expect(currentConfig(hydrated).revealRolesOnDeath).toBe(false);
    expect(hydrated.advanced.revealRolesOnDeath).toBe(true);
    const removed = lobbyFormReducer(hydrated, { type: "SET_ADVANCED", key: "jesterEnabled", value: false });
    expect(currentConfig(removed).revealRolesOnDeath).toBe(true);
  });
});
