import { describe, expect, it, vi } from "vitest";
import {
  MAX_PUBLIC_CHAT,
  MAX_PUBLIC_EVENTS,
  areLivingNightActorsReady,
  ensureNightActionAllowed,
  generateRoomCode,
  getActionTargetUserId,
  getPhaseDurationMs,
  hashRoomCode,
  haveLivingPlayersVoted,
  isNightPhase,
  normalizeChatMessage,
  parseChatChannel,
  type PrivatePlayerState,
} from "../game-room-runtime.js";
import type { GameConfig } from "@werewolf/shared";

const timers = {
  roleRevealSeconds: 7,
  factionNightActionSeconds: 30,
  dayDiscussionSeconds: 60,
  voteSeconds: 20,
  resolutionSeconds: 5,
};

describe("game-room-runtime helpers", () => {
  it("keeps public state caps stable", () => {
    expect(MAX_PUBLIC_EVENTS).toBe(120);
    expect(MAX_PUBLIC_CHAT).toBe(80);
  });

  it("generates room codes using the configured alphabet shape", () => {
    const codes = Array.from({ length: 25 }, () => generateRoomCode());

    expect(codes.every((code) => /^[A-Z0-9]{6}$/.test(code))).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(20);
  });

  it("hashes room codes without exposing the raw code", () => {
    const hash = hashRoomCode("ABC123");

    expect(hash).toMatch(/^[a-f0-9]{8}$/);
    expect(hash).not.toContain("ABC123");
  });

  it("parses chat channels and normalizes messages", () => {
    expect(parseChatChannel("werewolves")).toBe("werewolves");
    expect(parseChatChannel("unknown")).toBeNull();
    expect(normalizeChatMessage("x".repeat(600))).toHaveLength(500);
    expect(() => normalizeChatMessage(42)).toThrow("Невалидно съобщение.");
  });

  it("identifies night phases and action target ids", () => {
    expect(isNightPhase("first_night")).toBe(true);
    expect(isNightPhase("day_discussion")).toBe(false);
    expect(getActionTargetUserId({ kind: "check_role", targetUserId: "target" })).toBe("target");
    expect(getActionTargetUserId({ kind: "cupid_link", firstUserId: "a", secondUserId: "b" })).toBe("a");
    expect(getActionTargetUserId({ kind: "skip" })).toBeNull();
  });

  it("guards night action permissions", () => {
    expect(() =>
      ensureNightActionAllowed("werewolf", { kind: "faction_kill", targetUserId: "target" }, "night"),
    ).not.toThrow();
    expect(() =>
      ensureNightActionAllowed("ordinary_villager", { kind: "faction_kill", targetUserId: "target" }, "night"),
    ).toThrow("Тази роля няма право на това нощно действие.");
    expect(() =>
      ensureNightActionAllowed(
        "thief",
        { kind: "thief_steal", targetUserId: "target" },
        "night",
      ),
    ).toThrow("Тази роля няма право на това нощно действие.");
  });

  it("computes phase durations from the room config", () => {
    const config = { timers } as GameConfig;

    expect(getPhaseDurationMs(config, "role_reveal")).toBe(7_000);
    expect(getPhaseDurationMs(config, "night")).toBe(30_000);
    expect(getPhaseDurationMs(config, "day_discussion")).toBe(60_000);
    expect(getPhaseDurationMs(config, "voting")).toBe(20_000);
    expect(getPhaseDurationMs(config, "resolution")).toBe(5_000);
    expect(getPhaseDurationMs(config, "paused")).toBe(0);
  });

  it("checks living night actor readiness without leaking role state", () => {
    const players: PrivatePlayerState[] = [
      { userId: "wolf", role: "werewolf", alive: true },
      { userId: "witch", role: "witch", alive: true, witchHealUsed: true },
      { userId: "dead-seer", role: "seer", alive: false },
    ];
    const hasPendingNightAction = vi.fn((userId: string, kind?: string) => {
      return userId === "wolf" || (userId === "witch" && kind === "witch_poison");
    });

    expect(areLivingNightActorsReady(players, "night", hasPendingNightAction)).toBe(true);
    expect(hasPendingNightAction).toHaveBeenCalledWith("witch", "witch_poison");
  });

  it("checks living player vote completion", () => {
    const players: PrivatePlayerState[] = [
      { userId: "alive-1", role: "ordinary_villager", alive: true },
      { userId: "alive-2", role: "werewolf", alive: true },
      { userId: "dead", role: "seer", alive: false },
    ];

    expect(
      haveLivingPlayersVoted(players, (userId) => ({ hasVoted: userId === "alive-1" || userId === "alive-2" })),
    ).toBe(true);
    expect(haveLivingPlayersVoted(players, (userId) => ({ hasVoted: userId === "alive-1" }))).toBe(false);
  });
});
