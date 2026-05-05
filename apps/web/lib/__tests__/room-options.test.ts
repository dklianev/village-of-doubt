import { describe, expect, it } from "vitest";
import { parseRoomCreateOptions, roomOptionsToQuery, stringifyRolesParam } from "../room-options";

describe("room options query helpers", () => {
  it("serializes and parses manual role distributions", () => {
    const query = roomOptionsToQuery({
      mode: "werewolves_classic",
      playerCount: 8,
      roles: {
        ordinary_villager: 5,
        werewolf: 2,
        seer: 1,
      },
    });
    const params = Object.fromEntries(new URLSearchParams(query.slice(1)));

    expect(parseRoomCreateOptions(params)).toMatchObject({
      mode: "werewolves_classic",
      playerCount: 8,
      roles: {
        ordinary_villager: 5,
        werewolf: 2,
        seer: 1,
      },
    });
  });

  it("drops unknown roles from the compact roles parameter", () => {
    expect(parseRoomCreateOptions({ roles: "werewolf:2,unknown:9,seer:1" }).roles).toEqual({
      werewolf: 2,
      seer: 1,
    });
  });

  it("keeps the compact role string stable", () => {
    expect(stringifyRolesParam({ civilian: 6, commissioner: 1, mafioso: 2, don: 1 })).toBe(
      "civilian:6,commissioner:1,mafioso:2,don:1",
    );
  });

  it("serializes and parses wired lobby rule toggles", () => {
    const query = roomOptionsToQuery({
      mode: "mafia_free",
      playerCount: 10,
      allowSkipVote: true,
      majorityMode: "absolute",
      autoStart: true,
      mafiaNightKill: false,
      commissionerResultMode: "exact_role",
      maniacEnabled: true,
      jesterEnabled: true,
      narratorVoice: "inspector",
      spectator: true,
    });
    const params = Object.fromEntries(new URLSearchParams(query.slice(1)));

    expect(parseRoomCreateOptions(params)).toMatchObject({
      mode: "mafia_free",
      playerCount: 10,
      allowSkipVote: true,
      majorityMode: "absolute",
      autoStart: true,
      mafiaNightKill: false,
      commissionerResultMode: "exact_role",
      maniacEnabled: true,
      jesterEnabled: true,
      narratorVoice: "inspector",
      spectator: true,
    });
  });
});
