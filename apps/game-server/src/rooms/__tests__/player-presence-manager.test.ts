import { describe, expect, it, beforeEach } from "vitest";
import { PlayerPresenceManager } from "../player-presence-manager.js";

describe("PlayerPresenceManager", () => {
  beforeEach(() => {
    PlayerPresenceManager.resetForTests();
  });

  it("accepts a fresh token nonce once", () => {
    expect(PlayerPresenceManager.consumeTokenNonce("nonce-1", Date.now() + 60_000)).toBe(true);
    expect(PlayerPresenceManager.consumeTokenNonce("nonce-1", Date.now() + 60_000)).toBe(false);
  });

  it("rate-limits repeated joins inside the rolling window", () => {
    const attempts = Array.from({ length: 5 }, () => PlayerPresenceManager.checkJoinRateLimit("user-1"));
    expect(attempts).toEqual([true, true, true, true, true]);
    expect(PlayerPresenceManager.checkJoinRateLimit("user-1")).toBe(false);
  });

  it("tracks and detaches the active client for a user", () => {
    const manager = new PlayerPresenceManager();
    const firstClient = { sessionId: "first" };
    const secondClient = { sessionId: "second" };

    manager.attachClient("user-1", firstClient as never);
    expect(manager.getClient("user-1")).toBe(firstClient);

    manager.detachClient("user-1", secondClient as never);
    expect(manager.getClient("user-1")).toBe(firstClient);

    manager.detachClient("user-1", firstClient as never);
    expect(manager.getClient("user-1")).toBeUndefined();
  });
});
