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

  it.each(["werewolves_classic", "mafia_free"] as const)("retains host intent across repeated Jester rooms in %s", (mode) => {
    for (const revealRolesOnDeath of [true, false]) {
      const config = createGameConfigFromOptions({ mode, playerCount: 10, jesterEnabled: true, revealRolesOnDeath });
      const options = createRoomOptionsFromConfig(config);
      expect(options.revealRolesOnDeath).toBe(revealRolesOnDeath);
      expect(options).not.toHaveProperty("requestedRevealRolesOnDeath");
      const repeated = createGameConfigFromOptions(options);
      expect(repeated.revealRolesOnDeath).toBe(false);
      expect(repeated.requestedRevealRolesOnDeath).toBe(revealRolesOnDeath);
      const { roles: _roles, ...presetOptions } = createRoomOptionsFromConfig(repeated);
      const withoutJester = createGameConfigFromOptions({ ...presetOptions, jesterEnabled: false });
      expect(withoutJester.roles.jester ?? 0).toBe(0);
      expect(withoutJester.revealRolesOnDeath).toBe(revealRolesOnDeath);
    }
  });

  it("preserves the effective setting for older saved configs without a requested preference", () => {
    for (const revealRolesOnDeath of [true, false]) {
      const config = createGameConfigFromOptions({ revealRolesOnDeath });
      Reflect.deleteProperty(config, "requestedRevealRolesOnDeath");
      expect(createRoomOptionsFromConfig(config).revealRolesOnDeath).toBe(revealRolesOnDeath);
    }
  });
});

function configWithoutPrivateData(config: ReturnType<typeof createGameConfigFromOptions>) {
  const { code: _code, userId: _userId, token: _token, privatePlayers: _players, ...safe } = config as typeof config & {
    code?: string; userId?: string; token?: string; privatePlayers?: unknown;
  };
  return safe;
}
