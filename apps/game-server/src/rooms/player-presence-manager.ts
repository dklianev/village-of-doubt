import type { Client } from "colyseus";

const JOIN_RATE_WINDOW_MS = 10_000;
const JOIN_RATE_LIMIT = 5;
const NONCE_PRUNE_INTERVAL_MS = 60_000;

export class PlayerPresenceManager {
  static readonly MAX_USED_NONCES = 10_000;
  private static usedNonces = new Map<string, number>();
  private static joinAttempts = new Map<string, number[]>();
  private static nextNoncePruneAtMs = 0;
  private static nonceJanitorInterval: ReturnType<typeof setInterval> | undefined;
  private static joinJanitorInterval: ReturnType<typeof setInterval> | undefined;

  private clientsByUserId = new Map<string, Client>();

  static {
    PlayerPresenceManager.nonceJanitorInterval = setInterval(() => {
      PlayerPresenceManager.pruneExpiredNonces(Date.now());
    }, NONCE_PRUNE_INTERVAL_MS);
    PlayerPresenceManager.nonceJanitorInterval.unref?.();

    PlayerPresenceManager.joinJanitorInterval = setInterval(() => {
      const cutoff = Date.now() - JOIN_RATE_WINDOW_MS;
      for (const [userId, timestamps] of PlayerPresenceManager.joinAttempts) {
        const remaining = timestamps.filter((timestamp) => timestamp > cutoff);
        if (remaining.length === 0) {
          PlayerPresenceManager.joinAttempts.delete(userId);
        } else {
          PlayerPresenceManager.joinAttempts.set(userId, remaining);
        }
      }
    }, 30_000);
    PlayerPresenceManager.joinJanitorInterval.unref?.();
  }

  static consumeTokenNonce(nonce: string, expiresAtMs: number) {
    const now = Date.now();
    if (expiresAtMs <= now) {
      return false;
    }
    if (PlayerPresenceManager.usedNonces.has(nonce)) {
      return false;
    }
    if (now >= PlayerPresenceManager.nextNoncePruneAtMs) {
      PlayerPresenceManager.pruneExpiredNonces(now);
      PlayerPresenceManager.nextNoncePruneAtMs = now + NONCE_PRUNE_INTERVAL_MS;
    }
    if (PlayerPresenceManager.usedNonces.size >= PlayerPresenceManager.MAX_USED_NONCES) {
      return false;
    }
    PlayerPresenceManager.usedNonces.set(nonce, expiresAtMs);
    return true;
  }

  private static pruneExpiredNonces(now: number) {
    for (const [nonce, expiresAt] of PlayerPresenceManager.usedNonces) {
      if (expiresAt <= now) {
        PlayerPresenceManager.usedNonces.delete(nonce);
      }
    }
  }

  static getUsedNonceCountForTests() {
    return PlayerPresenceManager.usedNonces.size;
  }

  static checkJoinRateLimit(userId: string) {
    const now = Date.now();
    const cutoff = now - JOIN_RATE_WINDOW_MS;
    const timestamps = (PlayerPresenceManager.joinAttempts.get(userId) ?? []).filter((timestamp) => timestamp > cutoff);
    if (timestamps.length >= JOIN_RATE_LIMIT) {
      PlayerPresenceManager.joinAttempts.set(userId, timestamps);
      return false;
    }

    timestamps.push(now);
    PlayerPresenceManager.joinAttempts.set(userId, timestamps);
    return true;
  }

  static resetForTests() {
    PlayerPresenceManager.usedNonces.clear();
    PlayerPresenceManager.joinAttempts.clear();
    PlayerPresenceManager.nextNoncePruneAtMs = 0;
  }

  attachClient(userId: string, client: Client) {
    this.clientsByUserId.set(userId, client);
  }

  detachClient(userId: string, client?: Client) {
    if (!client || this.clientsByUserId.get(userId) === client) {
      this.clientsByUserId.delete(userId);
    }
  }

  getClient(userId: string) {
    return this.clientsByUserId.get(userId);
  }

  clear() {
    this.clientsByUserId.clear();
  }
}
