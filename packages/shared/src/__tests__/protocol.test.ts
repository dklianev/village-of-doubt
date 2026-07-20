import { describe, expect, it } from "vitest";
import { parseClientCommand, parseNightActionCommand, type ServerEvent } from "../protocol.js";

describe("runtime command parsing", () => {
  it("parses valid client and night-action commands", () => {
    expect(parseClientCommand("ready", { ready: true })).toEqual({ type: "ready", ready: true });
    expect(parseClientCommand("submitNomination", { targetUserId: "player-2" })).toEqual({
      type: "submitNomination",
      targetUserId: "player-2",
    });
    expect(parseClientCommand("submitNightAction", {
      action: { kind: "cupid_link", firstUserId: "a", secondUserId: "b" },
    })).toEqual({
      type: "submitNightAction",
      action: { kind: "cupid_link", firstUserId: "a", secondUserId: "b" },
    });
    expect(parseNightActionCommand({ kind: "skip" })).toEqual({ kind: "skip" });
    expect(parseClientCommand("narratorPause", undefined)).toEqual({ type: "narratorPause" });
    expect(parseClientCommand("narratorPause", {})).toEqual({ type: "narratorPause" });
    expect(parseClientCommand("narratorPause", { reason: "Кратка пауза" })).toEqual({
      type: "narratorPause",
      reason: "Кратка пауза",
    });
  });

  it("rejects malformed payloads instead of trusting TypeScript casts", () => {
    expect(parseClientCommand("ready", { ready: "yes" })).toBeNull();
    expect(parseClientCommand("submitVote", { targetUserId: "" })).toBeNull();
    expect(parseClientCommand("submitNomination", { targetUserId: "" })).toBeNull();
    expect(parseClientCommand("submitNomination", { targetUserId: 42 })).toBeNull();
    expect(parseClientCommand("narratorExtendTimer", { seconds: Number.POSITIVE_INFINITY })).toBeNull();
    expect(parseClientCommand("submitNightAction", { action: { kind: "witch_poison" } })).toBeNull();
    expect(parseClientCommand("submitNightAction", { action: { kind: "unknown", targetUserId: "a" } })).toBeNull();
    expect(parseClientCommand("narratorPause", null)).toBeNull();
    expect(parseClientCommand("narratorPause", "pause")).toBeNull();
    expect(parseClientCommand("narratorPause", { reason: 42 })).toBeNull();
  });

  it("uses the transport message type even when payload data tries to spoof it", () => {
    expect(parseClientCommand("ready", { type: "startGame", ready: false })).toEqual({
      type: "ready",
      ready: false,
    });
  });

  it("models faction rosters and check results as private server events", () => {
    const roster = {
      type: "private_faction_roster",
      faction: "mafia",
      members: [{ userId: "ally", displayName: "Съюзник" }],
    } satisfies ServerEvent;
    const result = {
      type: "private_check_result",
      targetUserId: "target",
      isCommissioner: true,
    } satisfies ServerEvent;

    expect(roster.members).toEqual([{ userId: "ally", displayName: "Съюзник" }]);
    expect(result.isCommissioner).toBe(true);
  });

  it("models the authoritative nomination acknowledgement", () => {
    const acknowledgement = {
      type: "nomination_ack",
      phase: "day_discussion",
      round: 2,
      targetUserId: "player-4",
      replaced: true,
    } satisfies ServerEvent;

    expect(acknowledgement).toEqual(expect.objectContaining({
      targetUserId: "player-4",
      replaced: true,
    }));
  });
});
