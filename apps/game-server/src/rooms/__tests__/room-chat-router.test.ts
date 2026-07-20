import { describe, expect, it, vi } from "vitest";
import type { GameConfig } from "@werewolf/shared";
import { GameState, PlayerPublicState } from "../schemas/GameState.js";
import { RoomChatRouter } from "../room-chat-router.js";
import { MAX_PUBLIC_CHAT, type PrivatePlayerState } from "../game-room-runtime.js";

function makeClient(userId: string) {
  return { userId, send: vi.fn() };
}

function makePlayer(userId: string, displayName: string, alive = true, playing = true, narrator = false) {
  const player = new PlayerPublicState();
  player.userId = userId;
  player.displayName = displayName;
  player.playing = playing;
  player.alive = alive;
  player.narrator = narrator;
  return player;
}

function createRouter(mode: GameConfig["mode"] = "werewolves_classic") {
  const state = new GameState();
  state.phase = "day_discussion";
  const config = { mode, communicationMode: "built_in_chat" } as GameConfig;
  const clients = {
    wolf: makeClient("wolf"),
    wolfTwo: makeClient("wolf-two"),
    villager: makeClient("villager"),
    dead: makeClient("dead"),
    spectator: makeClient("spectator"),
    narrator: makeClient("narrator"),
  };
  const players = new Map([
    [clients.wolf, makePlayer("wolf", "Вълк")],
    [clients.wolfTwo, makePlayer("wolf-two", "Вълк две")],
    [clients.villager, makePlayer("villager", "Селянин")],
    [clients.dead, makePlayer("dead", "Мъртъв", false)],
    [clients.spectator, makePlayer("spectator", "Наблюдател", false, false)],
    [clients.narrator, makePlayer("narrator", "Разказвач", false, false, true)],
  ]);
  const privatePlayers = new Map<string, PrivatePlayerState>([
    ["wolf", { userId: "wolf", role: "werewolf", alive: true }],
    ["wolf-two", { userId: "wolf-two", role: "werewolf", alive: true }],
    ["villager", { userId: "villager", role: "ordinary_villager", alive: true }],
    ["dead", { userId: "dead", role: "ordinary_villager", alive: false }],
    ["spectator", { userId: "spectator", alive: false }],
    ["narrator", { userId: "narrator", alive: false }],
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
    let now = 0;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => {
      now += 1_000;
      return now;
    });

    try {
      for (let i = 0; i < MAX_PUBLIC_CHAT + 2; i++) {
        router.sendChat(clients.villager as never, "public", `съобщение ${i}`);
      }
    } finally {
      nowSpy.mockRestore();
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

  it("limits mafia sport public messages to the current speaker and defender", () => {
    const { router, state, clients } = createRouter("mafia_sport");
    state.currentSpeakerUserId = "villager";

    router.sendChat(clients.villager as never, "public", "моята реч");
    expect(() => router.sendChat(clients.wolf as never, "public", "прекъсване")).toThrow(
      "Само текущият говорител може да пише в публичния чат.",
    );

    state.phase = "defense";
    state.currentDefenseUserId = "wolf";
    router.sendChat(clients.wolf as never, "public", "моята защита");
    expect(() => router.sendChat(clients.villager as never, "public", "чужда защита")).toThrow(
      "Само текущият говорител може да пише в публичния чат.",
    );

    expect([...state.publicChat].map((message) => [message.senderUserId, message.message])).toEqual([
      ["villager", "моята реч"],
      ["wolf", "моята защита"],
    ]);
  });

  it("limits mafia sport public typing to the current speaker and defender", () => {
    const { router, state, clients, broadcast } = createRouter("mafia_sport");
    state.currentSpeakerUserId = "villager";

    router.sendTyping(clients.wolf as never, "public", true);
    router.sendTyping(clients.villager as never, "public", true);

    state.phase = "defense";
    state.currentDefenseUserId = "wolf";
    router.sendTyping(clients.villager as never, "public", true);
    router.sendTyping(clients.wolf as never, "public", false);

    expect(broadcast).toHaveBeenCalledTimes(2);
    expect(broadcast).toHaveBeenNthCalledWith(
      1,
      "typing",
      expect.objectContaining({ senderUserId: "villager", active: true }),
    );
    expect(broadcast).toHaveBeenNthCalledWith(
      2,
      "typing",
      expect.objectContaining({ senderUserId: "wolf", active: false }),
    );
  });

  it.each(["mafia_free", "werewolves_classic"] as const)(
    "keeps open day discussion chat and typing for %s",
    (mode) => {
      const { router, state, clients, broadcast } = createRouter(mode);
      state.currentSpeakerUserId = "wolf";

      router.sendChat(clients.villager as never, "public", "свободно обсъждане");
      router.sendTyping(clients.villager as never, "public", true);

      expect(state.publicChat.at(-1)?.senderUserId).toBe("villager");
      expect(broadcast).toHaveBeenCalledWith(
        "typing",
        expect.objectContaining({ senderUserId: "villager", active: true }),
      );
    },
  );

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
    expect(clients.spectator.send).not.toHaveBeenCalled();
    expect(clients.narrator.send).not.toHaveBeenCalled();
  });

  it("rejects spectators and human narrators as dead chat senders", () => {
    const { router, clients } = createRouter();

    expect(() => router.sendChat(clients.spectator as never, "dead", "наблюдавам")).toThrow(
      "Няма достъп до този чат канал.",
    );
    expect(() => router.sendChat(clients.narrator as never, "dead", "разказвам")).toThrow(
      "Няма достъп до този чат канал.",
    );
    expect(clients.dead.send).not.toHaveBeenCalled();
  });

  it("routes dead typing only between dead playing participants", () => {
    const { router, clients } = createRouter();

    router.sendTyping(clients.dead as never, "dead", true);

    expect(clients.dead.send).toHaveBeenCalledWith(
      "typing",
      expect.objectContaining({ channel: "dead", senderUserId: "dead", active: true }),
    );
    expect(clients.spectator.send).not.toHaveBeenCalled();
    expect(clients.narrator.send).not.toHaveBeenCalled();

    for (const client of Object.values(clients)) {
      client.send.mockClear();
    }
    router.sendTyping(clients.spectator as never, "dead", true);
    router.sendTyping(clients.narrator as never, "dead", true);

    for (const client of Object.values(clients)) {
      expect(client.send).not.toHaveBeenCalled();
    }
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
