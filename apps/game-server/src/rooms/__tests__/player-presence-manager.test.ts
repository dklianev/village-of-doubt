import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerPresenceManager } from "../player-presence-manager.js";

describe("PlayerPresenceManager", () => {
  beforeEach(() => {
    PlayerPresenceManager.resetForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a fresh token nonce once", () => {
    expect(PlayerPresenceManager.consumeTokenNonce("nonce-1", Date.now() + 60_000)).toBe(true);
    expect(PlayerPresenceManager.consumeTokenNonce("nonce-1", Date.now() + 60_000)).toBe(false);
  });

  it("bounds nonce replay memory and fails closed at capacity", () => {
    const expiresAt = Date.now() + 60_000;
    for (let index = 0; index < PlayerPresenceManager.MAX_USED_NONCES; index += 1) {
      expect(PlayerPresenceManager.consumeTokenNonce(`nonce-${index}`, expiresAt)).toBe(true);
    }

    expect(PlayerPresenceManager.getUsedNonceCountForTests()).toBe(PlayerPresenceManager.MAX_USED_NONCES);
    expect(PlayerPresenceManager.consumeTokenNonce("nonce-over-capacity", expiresAt)).toBe(false);
    expect(PlayerPresenceManager.getUsedNonceCountForTests()).toBe(PlayerPresenceManager.MAX_USED_NONCES);
  });

  it("prunes expired nonce entries before admitting a fresh token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(PlayerPresenceManager.consumeTokenNonce("expires-soon", Date.now() + 1_000)).toBe(true);

    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    expect(PlayerPresenceManager.consumeTokenNonce("fresh-after-prune", Date.now() + 60_000)).toBe(true);
    expect(PlayerPresenceManager.getUsedNonceCountForTests()).toBe(1);
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
