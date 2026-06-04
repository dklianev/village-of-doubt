import type { Client } from "colyseus";
import {
  getRoleNameBg,
  type GameConfig,
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
