import { describe, expect, it } from "vitest";
import { createGameConfigFromOptions, createRoomOptionsFromConfig } from "@werewolf/shared";
import { nextRoomOptionsForState } from "../next-room-options";

describe("next room snapshot settings", () => {
  it("projects complete safe settings and keeps the reference stable between patches", () => {
    const options = createRoomOptionsFromConfig(createGameConfigFromOptions({
      playerCount: 8, rolePreset: "beginner", roomVisibility: "public",
      tempoProfile: "manual", customTimers: { voteSeconds: 73, autoAdvanceWhenReady: false },
    }));
    const state = { nextRoomOptionsJson: JSON.stringify(options) };
    const result = nextRoomOptionsForState(state);
    expect(result).toEqual(options);
    expect(nextRoomOptionsForState(state, result)).toBe(result);
    expect(nextRoomOptionsForState({ nextRoomOptionsJson: JSON.stringify({ ...options, roomName: "Changed" }) }, result))
      .not.toBe(result);
  });

  it("never carries identity or private fields through the adapter", () => {
    const result = nextRoomOptionsForState({ nextRoomOptionsJson: JSON.stringify({
      ...createRoomOptionsFromConfig(createGameConfigFromOptions()),
      code: "ABC234", userId: "private-user", token: "private-token", spectator: true,
      privatePlayers: { "private-user": { role: "werewolf" } },
    }) });
    expect(result).toBeDefined();
    expect(result).not.toHaveProperty("code");
    expect(result).not.toHaveProperty("spectator");
    expect(JSON.stringify(result)).not.toContain("private-");
  });

  it("normalizes room names and manual timers without losing the server's preset identity", () => {
    const options = createRoomOptionsFromConfig(createGameConfigFromOptions({
      rolePreset: "beginner", tempoProfile: "manual",
    }));
    const result = nextRoomOptionsForState({ nextRoomOptionsJson: JSON.stringify({
      ...options,
      roomName: "  Вечер с приятели  ",
      customTimers: { ...options.customTimers, voteSeconds: 10_000, roleRevealSeconds: 0 },
    }) });
    expect(result).toMatchObject({
      roomName: "Вечер с приятели", rolePreset: "beginner",
      customTimers: { voteSeconds: 240, roleRevealSeconds: 5 },
    });
  });

  it.each([
    { roles: { werewolf: 1.5 } },
    { roles: { unknown_role: 1 } },
    { roles: { werewolf: -1 } },
    { roles: { seer: 2 } },
    { roles: { mafioso: 1 } },
    { playerCount: 8.5 },
    { playerCount: 31 },
    { rolePreset: "unknown" },
    { communicationMode: "unknown" },
    { narratorMode: "full_human" },
    { customTimers: { voteSeconds: "60" } },
    { customTimers: { unknownTimer: 60 } },
    { customTimers: { autoAdvanceWhenReady: 1 } },
    { loversEnabled: "false" },
    { roomName: "   " },
  ])("rejects malformed settings instead of silently repairing them: %j", (invalid) => {
    const options = createRoomOptionsFromConfig(createGameConfigFromOptions());
    expect(nextRoomOptionsForState({ nextRoomOptionsJson: JSON.stringify({ ...options, ...invalid }) }))
      .toBeUndefined();
  });

  it.each([undefined, "", "not-json", "null", "[]", "{}", '{"mode":"invalid"}'])(
    "does not invent repeat settings for an old or invalid snapshot: %s", (nextRoomOptionsJson) => {
      expect(nextRoomOptionsForState(nextRoomOptionsJson === undefined ? {} : { nextRoomOptionsJson })).toBeUndefined();
    },
  );
});
