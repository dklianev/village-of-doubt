import { describe, expect, it, vi } from "vitest";
import type { GameConfig } from "@werewolf/shared";
import { GameState, PlayerPublicState } from "../schemas/GameState.js";
import { RoomChatRouter } from "../room-chat-router.js";
import { MAX_PUBLIC_CHAT, type PrivatePlayerState } from "../game-room-runtime.js";

function makeClient(userId: string) {
  return { userId, send: vi.fn() };
}

function makePlayer(userId: string, displayName: string, alive = true) {
  const player = new PlayerPublicState();
  player.userId = userId;
  player.displayName = displayName;
  player.playing = true;
  player.alive = alive;
  return player;
}

function createRouter() {
  const state = new GameState();
  state.phase = "day_discussion";
  const config = { communicationMode: "built_in_chat" } as GameConfig;
  const clients = {
    wolf: makeClient("wolf"),
    wolfTwo: makeClient("wolf-two"),
    villager: makeClient("villager"),
    dead: makeClient("dead"),
  };
  const players = new Map([
    [clients.wolf, makePlayer("wolf", "Вълк")],
    [clients.wolfTwo, makePlayer("wolf-two", "Вълк две")],
    [clients.villager, makePlayer("villager", "Селянин")],
    [clients.dead, makePlayer("dead", "Мъртъв", false)],
  ]);
  const privatePlayers = new Map<string, PrivatePlayerState>([
    ["wolf", { userId: "wolf", role: "werewolf", alive: true }],
    ["wolf-two", { userId: "wolf-two", role: "werewolf", alive: true }],
    ["villager", { userId: "villager", role: "ordinary_villager", alive: true }],
    ["dead", { userId: "dead", role: "ordinary_villager", alive: false }],
  ]);
  const broadcast = vi.fn();
  const persistGameEvent = vi.fn();

  const router = new RoomChatRouter({
    getState: () => state,
    getConfig: () => config,
    getPublicPlayer: (client) => players.get(client as never)!,
    getPrivatePlayer: (userId) => privatePlayers.get(userId)!,
    getPrivatePlayers: () => privatePlayers,
    clientsFor: (predicate) =>
      [...players.entries()]
        .filter(([, player]) => predicate(player))
        .map(([client]) => client as never),
    broadcast,
    persistGameEvent,
  });

  return { router, state, config, clients, broadcast, persistGameEvent };
}

describe("RoomChatRouter", () => {
  it("records public chat during day discussion and enforces the FIFO cap", () => {
    const { router, state, clients, persistGameEvent } = createRouter();

    for (let i = 0; i < MAX_PUBLIC_CHAT + 2; i++) {
      router.sendChat(clients.villager as never, "public", `съобщение ${i}`);
    }

    expect(state.publicChat).toHaveLength(MAX_PUBLIC_CHAT);
    expect(state.publicChat[0]?.message).toBe("съобщение 2");
    expect(state.publicChat.at(-1)?.message).toBe(`съобщение ${MAX_PUBLIC_CHAT + 1}`);
    expect(persistGameEvent).toHaveBeenCalledWith(
      "chat",
      expect.objectContaining({ actorId: "villager", visibility: "public" }),
    );
  });

  it("rejects dead players from public day chat", () => {
    const { router, clients } = createRouter();

    expect(() => router.sendChat(clients.dead as never, "public", "тихо")).toThrow(
      "Само живи играчи могат да пишат в публичния дневен чат.",
    );
  });

  it("routes faction chat only to matching living faction members", () => {
    const { router, clients, persistGameEvent } = createRouter();

    router.sendChat(clients.wolf as never, "werewolves", "нощен план");

    expect(clients.wolf.send).toHaveBeenCalledWith(
      "private_chat",
      expect.objectContaining({ channel: "werewolves", message: "нощен план" }),
    );
    expect(clients.wolfTwo.send).toHaveBeenCalledWith(
      "private_chat",
      expect.objectContaining({ channel: "werewolves", message: "нощен план" }),
    );
    expect(clients.villager.send).not.toHaveBeenCalled();
    expect(clients.dead.send).not.toHaveBeenCalled();
    expect(persistGameEvent).toHaveBeenCalledWith(
      "chat",
      expect.objectContaining({ actorId: "wolf", visibility: "faction" }),
    );
  });

  it("rejects cross-faction private chat attempts", () => {
    const { router, clients } = createRouter();

    expect(() => router.sendChat(clients.villager as never, "werewolves", "чужд канал")).toThrow(
      "Няма достъп до този чат канал.",
    );
  });

  it("routes dead chat only to dead players", () => {
    const { router, clients } = createRouter();

    router.sendChat(clients.dead as never, "dead", "отвъд");

    expect(clients.dead.send).toHaveBeenCalledWith(
      "private_chat",
      expect.objectContaining({ channel: "dead", message: "отвъд" }),
    );
    expect(clients.wolf.send).not.toHaveBeenCalled();
    expect(clients.villager.send).not.toHaveBeenCalled();
  });

  it("routes typing notifications with the same public/private constraints", () => {
    const { router, clients, broadcast } = createRouter();

    router.sendTyping(clients.villager as never, "public", true);
    router.sendTyping(clients.wolf as never, "werewolves", true);

    expect(broadcast).toHaveBeenCalledWith(
      "typing",
      expect.objectContaining({ channel: "public", senderUserId: "villager", active: true }),
    );
    expect(clients.wolf.send).toHaveBeenCalledWith(
      "typing",
      expect.objectContaining({ channel: "werewolves", senderUserId: "wolf", active: true }),
    );
    expect(clients.wolfTwo.send).toHaveBeenCalledWith(
      "typing",
      expect.objectContaining({ channel: "werewolves", senderUserId: "wolf", active: true }),
    );
    expect(clients.villager.send).not.toHaveBeenCalled();
  });
});
