import { describe, expect, it } from "vitest";
import { createGameConfigFromOptions } from "../game-config.js";
import { createRoomOptionsFromConfig } from "../repeat-room-options.js";

describe("repeat-room public settings", () => {
  it("round-trips every supported setting without retaining the previous room or viewer", () => {
    const config = createGameConfigFromOptions({
      mode: "mafia_free", roomName: "Next room", playerCount: 6, maxPlayers: 12,
      roomVisibility: "public", roles: { civilian: 4, mafioso: 1, doctor: 1 },
      tempoProfile: "manual", customTimers: { voteSeconds: 75, autoAdvanceWhenReady: false },
      revealRolesOnDeath: false, doctorCanSelfProtect: true, firstNightKill: false,
      tieBreaker: "revote", majorityMode: "absolute", narratorVoice: "inspector",
    });
    const options = createRoomOptionsFromConfig(Object.assign(config, {
      code: "ABC234", userId: "private-user", token: "private-token",
      privatePlayers: { "private-user": { role: "mafioso" } },
    }));
    expect(createGameConfigFromOptions(options)).toEqual(configWithoutPrivateData(config));
    expect(Object.keys(options).sort()).toEqual([
      "mode", "roomName", "playerCount", "maxPlayers", "roomVisibility", "rolePreset", "roles",
      "narratorMode", "communicationMode", "tempoProfile", "customTimers", "loversEnabled",
      "revealRolesOnDeath", "tieBreaker", "firstNightKill", "allowSkipVote", "majorityMode",
      "autoStart", "beginnerMode", "advancedMode", "werewolfVariant", "mayorMode",
      "promoRolesEnabled", "mafiaNightKill", "doctorCanSelfProtect", "commissionerResultMode",
      "maniacEnabled", "jesterEnabled", "narratorVoice",
    ].sort());
    expect(JSON.stringify(options)).not.toContain("private-");
    expect(options.roles).not.toBe(config.roles);
    expect(options.customTimers).not.toBe(config.timers);
  });

  it("preserves preset identity and filters unknown nested fields from public counts and timers", () => {
    const config = createGameConfigFromOptions({ playerCount: 8, rolePreset: "beginner" });
    Object.assign(config.roles, { userId: "private-user" });
    Object.assign(config.timers, { token: "private-token" });
    const options = createRoomOptionsFromConfig(config);
    expect(options.rolePreset).toBe("beginner");
    expect(options.roles?.werewolf).toBe(config.roles.werewolf);
    expect(JSON.stringify(options)).not.toContain("private-");
  });
});

function configWithoutPrivateData(config: ReturnType<typeof createGameConfigFromOptions>) {
  const { code: _code, userId: _userId, token: _token, privatePlayers: _players, ...safe } = config as typeof config & {
    code?: string; userId?: string; token?: string; privatePlayers?: unknown;
  };
  return safe;
}
