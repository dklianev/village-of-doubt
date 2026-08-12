import type { Client } from "colyseus";
import {
  MemoryPlayerSecurityStore,
  type PlayerSecurityStore,
} from "./player-security-store.js";

export class PlayerPresenceManager {
  static readonly MAX_USED_NONCES = 10_000;
  private static securityStore: PlayerSecurityStore = PlayerPresenceManager.createMemorySecurityStore();

  private clientsByUserId = new Map<string, Client>();
  private connectionGenerationByUserId = new Map<string, number>();

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

  static claimActiveRoom(userId: string, roomCode: string, expiresAtMs: number) {
    return PlayerPresenceManager.securityStore.claimActiveRoom(userId, roomCode, expiresAtMs);
  }

  static releaseActiveRoom(userId: string, roomCode: string) {
    return PlayerPresenceManager.securityStore.releaseActiveRoom(userId, roomCode);
  }

  static isGameSessionRevoked(userId: string, tokenIssuedAtMs: number) {
    return PlayerPresenceManager.securityStore.isGameSessionRevoked(userId, tokenIssuedAtMs);
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

  activateClient(userId: string, client: Client) {
    const generation = (this.connectionGenerationByUserId.get(userId) ?? 0) + 1;
    this.connectionGenerationByUserId.set(userId, generation);
    this.attachClient(userId, client);
    return generation;
  }

  isCurrentConnectionGeneration(userId: string, generation: number | undefined) {
    return generation !== undefined && this.connectionGenerationByUserId.get(userId) === generation;
  }

  invalidateConnectionGeneration(userId: string) {
    const generation = (this.connectionGenerationByUserId.get(userId) ?? 0) + 1;
    this.connectionGenerationByUserId.set(userId, generation);
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
    this.connectionGenerationByUserId.clear();
  }
}
