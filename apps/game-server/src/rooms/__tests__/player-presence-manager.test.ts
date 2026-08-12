import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerPresenceManager } from "../player-presence-manager.js";
import type { PlayerSecurityStore } from "../player-security-store.js";

describe("PlayerPresenceManager", () => {
  beforeEach(() => {
    PlayerPresenceManager.resetForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a fresh token nonce once", async () => {
    await expect(PlayerPresenceManager.consumeTokenNonce("nonce-1", Date.now() + 60_000)).resolves.toBe(true);
    await expect(PlayerPresenceManager.consumeTokenNonce("nonce-1", Date.now() + 60_000)).resolves.toBe(false);
  });

  it("bounds nonce replay memory and fails closed at capacity", async () => {
    const expiresAt = Date.now() + 60_000;
    for (let index = 0; index < PlayerPresenceManager.MAX_USED_NONCES; index += 1) {
      await expect(PlayerPresenceManager.consumeTokenNonce(`nonce-${index}`, expiresAt)).resolves.toBe(true);
    }

    expect(PlayerPresenceManager.getUsedNonceCountForTests()).toBe(PlayerPresenceManager.MAX_USED_NONCES);
    await expect(PlayerPresenceManager.consumeTokenNonce("nonce-over-capacity", expiresAt)).resolves.toBe(false);
    expect(PlayerPresenceManager.getUsedNonceCountForTests()).toBe(PlayerPresenceManager.MAX_USED_NONCES);
  }, 15_000);

  it("prunes expired nonce entries before admitting a fresh token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    await expect(PlayerPresenceManager.consumeTokenNonce("expires-soon", Date.now() + 1_000)).resolves.toBe(true);

    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    await expect(PlayerPresenceManager.consumeTokenNonce("fresh-after-prune", Date.now() + 60_000)).resolves.toBe(true);
    expect(PlayerPresenceManager.getUsedNonceCountForTests()).toBe(1);
  });

  it("rate-limits repeated joins inside the rolling window", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 5 }, () => PlayerPresenceManager.checkJoinRateLimit("user-1")),
    );
    expect(attempts).toEqual([true, true, true, true, true]);
    await expect(PlayerPresenceManager.checkJoinRateLimit("user-1")).resolves.toBe(false);
  });

  it("delegates nonce and join guards to the configured shared store", async () => {
    const store: PlayerSecurityStore = {
      consumeTokenNonce: vi.fn(async () => false),
      checkJoinRateLimit: vi.fn(async () => false),
      claimActiveRoom: vi.fn(async () => false),
      releaseActiveRoom: vi.fn(async () => undefined),
      isGameSessionRevoked: vi.fn(async () => true),
    };
    PlayerPresenceManager.configureSecurityStore(store);

    await expect(PlayerPresenceManager.consumeTokenNonce("nonce-1", Date.now() + 60_000)).resolves.toBe(false);
    await expect(PlayerPresenceManager.checkJoinRateLimit("user-1")).resolves.toBe(false);
    await expect(PlayerPresenceManager.isGameSessionRevoked("user-1", 1_000)).resolves.toBe(true);
    expect(store.consumeTokenNonce).toHaveBeenCalledOnce();
    expect(store.checkJoinRateLimit).toHaveBeenCalledOnce();
    expect(store.isGameSessionRevoked).toHaveBeenCalledOnce();
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
