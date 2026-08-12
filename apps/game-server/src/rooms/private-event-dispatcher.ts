import type { Client } from "@colyseus/core";
import {
  getRoleTeam,
  getRoleNameBg,
  type GameConfig,
  type PrivateCheckResult,
  type RoleCode,
  type ServerEvent,
} from "@werewolf/shared";
import type { PlayerPublicState } from "./schemas/GameState.js";
import type { PrivatePlayerState } from "./game-room-runtime.js";
import type { PlayerPresenceManager } from "./player-presence-manager.js";

interface PrivateEventDispatcherContext {
  getConfig: () => GameConfig;
  getPrivatePlayer: (userId: string) => PrivatePlayerState | undefined;
  getPrivatePlayers: () => Iterable<PrivatePlayerState>;
  getPublicPlayers: () => Iterable<PlayerPublicState>;
  findPlayerByUserId: (userId: string) => PlayerPublicState | undefined;
  playerPresence: PlayerPresenceManager;
}

export class PrivateEventDispatcher {
  private readonly retainedCheckResults = new Map<string, PrivateCheckResult>();

  constructor(private readonly context: PrivateEventDispatcherContext) {}

  sendPrivateRole(client: Client, userId: string) {
    const privatePlayer = this.context.getPrivatePlayer(userId);
    const role = privatePlayer?.role;
    if (!role) {
      return;
    }

    client.send("private_role", {
      type: "private_role",
      role,
      roleNameBg: getRoleNameBg(role),
    } satisfies ServerEvent);
    if (privatePlayer.loverId) {
      this.sendPrivateLover(userId, privatePlayer.loverId);
    }
    this.sendPrivateBlessing(client, userId);
    this.sendPrivateFactionRoster(client, userId);
    this.replayPrivateCheckResult(client, userId);
  }

  sendPrivateLover(userId: string, loverUserId: string) {
    const client = this.context.playerPresence.getClient(userId);
    const lover = this.context.findPlayerByUserId(loverUserId);
    if (!client || !lover) {
      return;
    }

    client.send("private_lovers", {
      type: "private_lovers",
      loverUserId,
      loverName: lover.displayName,
    } satisfies ServerEvent);
  }

  sendPrivateBlessing(client: Client, userId: string) {
    const privatePlayer = this.context.getPrivatePlayer(userId);
    const target = privatePlayer?.priestBlessed ? this.context.findPlayerByUserId(userId) : undefined;
    if (!target) {
      return;
    }

    client.send("private_blessing", {
      type: "private_blessing",
      targetUserId: userId,
      targetName: target.displayName,
    } satisfies ServerEvent);
  }

  sendPrivateFactionRoster(client: Client, userId: string) {
    const privatePlayer = this.context.getPrivatePlayer(userId);
    const faction = privatePlayer?.role ? getRoleTeam(privatePlayer.role) : undefined;
    if (faction !== "mafia" && faction !== "werewolves") {
      return;
    }

    const members = [...this.context.getPrivatePlayers()]
      .filter((player) => player.userId !== userId && player.role && getRoleTeam(player.role) === faction)
      .flatMap((player) => {
        const publicPlayer = this.context.findPlayerByUserId(player.userId);
        return publicPlayer ? [{ userId: player.userId, displayName: publicPlayer.displayName }] : [];
      });

    client.send("private_faction_roster", {
      type: "private_faction_roster",
      faction,
      members,
    } satisfies ServerEvent);
  }

  sendPrivateFactionRosters() {
    for (const player of this.context.getPrivatePlayers()) {
      const client = this.context.playerPresence.getClient(player.userId);
      if (client) {
        this.sendPrivateFactionRoster(client, player.userId);
      }
    }
  }

  sendPrivateCheckResult(userId: string, result: PrivateCheckResult) {
    this.retainedCheckResults.set(userId, result);
    const client = this.context.playerPresence.getClient(userId);
    if (client) {
      this.dispatchPrivateCheckResult(client, result);
    }
  }

  private replayPrivateCheckResult(client: Client, userId: string) {
    const result = this.retainedCheckResults.get(userId);
    if (result) {
      this.dispatchPrivateCheckResult(client, result);
    }
  }

  private dispatchPrivateCheckResult(client: Client, result: PrivateCheckResult) {
    client.send("private_check_result", {
      type: "private_check_result",
      ...result,
    } satisfies ServerEvent);
  }

  sendNarratorRoleSnapshot(client: Client, userId: string) {
    if (this.context.getConfig().narratorMode !== "full_human") {
      return;
    }

    const publicPlayer = this.context.findPlayerByUserId(userId);
    if (!publicPlayer?.narrator) {
      return;
    }

    const roles = [...this.context.getPrivatePlayers()]
      .filter((player): player is PrivatePlayerState & { role: RoleCode } => Boolean(player.role))
      .map((player) => {
        const publicState = this.context.findPlayerByUserId(player.userId);
        return {
          userId: player.userId,
          displayName: publicState?.displayName ?? player.userId,
          role: player.role,
          roleNameBg: getRoleNameBg(player.role),
        };
      });

    if (roles.length === 0) {
      return;
    }

    client.send("narrator_role_snapshot", {
      type: "narrator_role_snapshot",
      roles,
    } satisfies ServerEvent);
  }

  sendNarratorSnapshotsToNarrators() {
    for (const player of this.context.getPublicPlayers()) {
      const client = this.context.playerPresence.getClient(player.userId);
      if (client) {
        this.sendNarratorRoleSnapshot(client, player.userId);
      }
    }
  }
}
