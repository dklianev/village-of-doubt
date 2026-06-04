import { describe, expect, it, vi } from "vitest";
import type { GameConfig } from "@werewolf/shared";
import { PlayerPublicState } from "../schemas/GameState.js";
import { PlayerPresenceManager } from "../player-presence-manager.js";
import { PrivateEventDispatcher } from "../private-event-dispatcher.js";
import type { PrivatePlayerState } from "../game-room-runtime.js";

function makeClient() {
  return { send: vi.fn() };
}

function makePublicPlayer(userId: string, displayName: string, narrator = false) {
  const player = new PlayerPublicState();
  player.userId = userId;
  player.displayName = displayName;
  player.narrator = narrator;
  player.playing = !narrator;
  player.alive = true;
  return player;
}

function createDispatcher(opts?: { narratorMode?: GameConfig["narratorMode"] }) {
  const playerPresence = new PlayerPresenceManager();
  const publicPlayers = new Map<string, PlayerPublicState>([
    ["seer", makePublicPlayer("seer", "Ясновидка")],
    ["lover", makePublicPlayer("lover", "Любим")],
    ["narrator", makePublicPlayer("narrator", "Разказвач", true)],
    ["villager", makePublicPlayer("villager", "Селянин")],
  ]);
  const privatePlayers = new Map<string, PrivatePlayerState>([
    ["seer", { userId: "seer", role: "seer", alive: true, loverId: "lover" }],
    ["lover", { userId: "lover", role: "ordinary_villager", alive: true, loverId: "seer" }],
    ["villager", { userId: "villager", role: "ordinary_villager", alive: true }],
  ]);
  const clients = {
    seer: makeClient(),
    lover: makeClient(),
    narrator: makeClient(),
    villager: makeClient(),
  };
  playerPresence.attachClient("seer", clients.seer as never);
  playerPresence.attachClient("lover", clients.lover as never);
  playerPresence.attachClient("narrator", clients.narrator as never);
  playerPresence.attachClient("villager", clients.villager as never);

  const dispatcher = new PrivateEventDispatcher({
    getConfig: () => ({ narratorMode: opts?.narratorMode ?? "full_human" }) as GameConfig,
    getPrivatePlayer: (userId) => privatePlayers.get(userId),
    getPrivatePlayers: () => privatePlayers.values(),
    getPublicPlayers: () => publicPlayers.values(),
    findPlayerByUserId: (userId) => publicPlayers.get(userId),
    playerPresence,
  });

  return { dispatcher, clients, privatePlayers };
}

describe("PrivateEventDispatcher", () => {
  it("sends private role only to the requested client and includes lover context", () => {
    const { dispatcher, clients } = createDispatcher();

    dispatcher.sendPrivateRole(clients.seer as never, "seer");

    expect(clients.seer.send).toHaveBeenCalledWith(
      "private_role",
      expect.objectContaining({ role: "seer", roleNameBg: "Гадателка" }),
    );
    expect(clients.seer.send).toHaveBeenCalledWith(
      "private_lovers",
      expect.objectContaining({ loverUserId: "lover", loverName: "Любим" }),
    );
    expect(clients.lover.send).not.toHaveBeenCalled();
    expect(clients.villager.send).not.toHaveBeenCalled();
  });

  it("dispatches lover events only to the addressed user", () => {
    const { dispatcher, clients } = createDispatcher();

    dispatcher.sendPrivateLover("seer", "lover");
    dispatcher.sendPrivateLover("lover", "seer");

    expect(clients.seer.send).toHaveBeenCalledWith(
      "private_lovers",
      expect.objectContaining({ loverUserId: "lover", loverName: "Любим" }),
    );
    expect(clients.lover.send).toHaveBeenCalledWith(
      "private_lovers",
      expect.objectContaining({ loverUserId: "seer", loverName: "Ясновидка" }),
    );
    expect(clients.villager.send).not.toHaveBeenCalled();
  });

  it("sends narrator role snapshots only to accepted full-human narrators", () => {
    const { dispatcher, clients } = createDispatcher();

    dispatcher.sendNarratorRoleSnapshot(clients.villager as never, "villager");
    dispatcher.sendNarratorRoleSnapshot(clients.narrator as never, "narrator");

    expect(clients.villager.send).not.toHaveBeenCalled();
    expect(clients.narrator.send).toHaveBeenCalledWith(
      "narrator_role_snapshot",
      expect.objectContaining({
        roles: expect.arrayContaining([
          expect.objectContaining({ userId: "seer", role: "seer", roleNameBg: "Гадателка" }),
        ]),
      }),
    );
  });

  it("does not send narrator snapshots when narrator mode is not full-human", () => {
    const { dispatcher, clients } = createDispatcher({ narratorMode: "automatic" });

    dispatcher.sendNarratorRoleSnapshot(clients.narrator as never, "narrator");

    expect(clients.narrator.send).not.toHaveBeenCalled();
  });

  it("ignores missing private recipients without throwing", () => {
    const { dispatcher, clients } = createDispatcher();

    expect(() => dispatcher.sendPrivateRole(clients.seer as never, "missing")).not.toThrow();
    expect(() => dispatcher.sendPrivateLover("missing", "lover")).not.toThrow();

    expect(clients.seer.send).not.toHaveBeenCalled();
  });
});
