import type { Client } from "colyseus";

const JOIN_RATE_WINDOW_MS = 10_000;
const JOIN_RATE_LIMIT = 5;

export class PlayerPresenceManager {
  private static usedNonces = new Map<string, number>();
  private static joinAttempts = new Map<string, number[]>();
  private static nonceJanitorInterval: ReturnType<typeof setInterval> | undefined;
  private static joinJanitorInterval: ReturnType<typeof setInterval> | undefined;

  private clientsByUserId = new Map<string, Client>();

  static {
    PlayerPresenceManager.nonceJanitorInterval = setInterval(() => {
      const now = Date.now();
      for (const [nonce, expiresAt] of PlayerPresenceManager.usedNonces) {
        if (expiresAt <= now) {
          PlayerPresenceManager.usedNonces.delete(nonce);
        }
      }
    }, 60_000);
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
    if (PlayerPresenceManager.usedNonces.has(nonce)) {
      return false;
    }
    PlayerPresenceManager.usedNonces.set(nonce, expiresAtMs);
    return true;
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
