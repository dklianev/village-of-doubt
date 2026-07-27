import type { Client } from "colyseus";
import {
  MemoryPlayerSecurityStore,
  type PlayerSecurityStore,
} from "./player-security-store.js";

export class PlayerPresenceManager {
  static readonly MAX_USED_NONCES = 10_000;
  private static securityStore: PlayerSecurityStore = PlayerPresenceManager.createMemorySecurityStore();

  private clientsByUserId = new Map<string, Client>();

  static configureSecurityStore(store: PlayerSecurityStore) {
    PlayerPresenceManager.securityStore = store;
  }

  static consumeTokenNonce(nonce: string, expiresAtMs: number) {
    return PlayerPresenceManager.securityStore.consumeTokenNonce(nonce, expiresAtMs);
  }

  static getUsedNonceCountForTests() {
    return PlayerPresenceManager.securityStore instanceof MemoryPlayerSecurityStore
      ? PlayerPresenceManager.securityStore.getUsedNonceCountForTests()
      : 0;
  }

  static checkJoinRateLimit(userId: string) {
    return PlayerPresenceManager.securityStore.checkJoinRateLimit(userId);
  }

  static resetForTests() {
    PlayerPresenceManager.securityStore = PlayerPresenceManager.createMemorySecurityStore();
  }

  private static createMemorySecurityStore() {
    return new MemoryPlayerSecurityStore({
      maxUsedNonces: PlayerPresenceManager.MAX_USED_NONCES,
    });
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
