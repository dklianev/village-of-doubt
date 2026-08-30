import type { Client } from "@colyseus/core";
import {
  getRoleTeam,
  type ChatChannel,
  type GameConfig,
  type ServerEvent,
} from "@werewolf/shared";
import type { PersistEventInput } from "../persistence/game-persistence.js";
import {
  MAX_PUBLIC_CHAT,
  normalizeChatMessage,
  parseChatChannel,
  type PrivatePlayerState,
} from "./game-room-runtime.js";
import {
  ChatMessageState,
  GameState,
  PlayerPublicState,
} from "./schemas/GameState.js";

interface RoomChatRouterContext {
  getState: () => GameState;
  getConfig: () => GameConfig;
  getPublicPlayer: (client: Client) => PlayerPublicState;
  getPrivatePlayer: (userId: string) => PrivatePlayerState;
  getPrivatePlayers: () => Map<string, PrivatePlayerState>;
  clientsFor: (predicate: (player: PlayerPublicState) => boolean) => Client[];
  broadcast: (type: string, payload: ServerEvent) => void;
  persistGameEvent: (type: string, event?: Omit<PersistEventInput, "round" | "phase" | "type">) => void;
}

export class RoomChatRouter {
  private readonly messageWindows = new Map<string, number[]>();

  constructor(private readonly context: RoomChatRouterContext) {}

  forgetUser(userId: string) {
    this.messageWindows.delete(userId);
  }

  sendChat(client: Client, channel: string, message: string) {
    const player = this.context.getPublicPlayer(client);
    this.enforceMessageRate(player.userId);
    const chatChannel = parseChatChannel(channel);
    if (!chatChannel) {
      throw new Error("Непознат канал за разговор.");
    }
    const text = normalizeChatMessage(message);
    const config = this.context.getConfig();
    if (config.communicationMode === "no_chat" || config.communicationMode === "system_only") {
      throw new Error("В тази стая разговорът е изключен.");
    }

    if (chatChannel !== "public") {
      this.sendPrivateChat(player, chatChannel, text);
      return;
    }
    const state = this.context.getState();
    if (config.communicationMode !== "built_in_chat") {
      throw new Error("Общият разговор не е активен в тази стая.");
    }
    const denialReason = this.getPublicChatDenialReason(player, state, config);
    if (denialReason) {
      throw new Error(denialReason);
    }

    const chat = new ChatMessageState();
    chat.id = crypto.randomUUID();
    chat.channel = "public";
    chat.senderUserId = player.userId;
    chat.senderName = player.displayName;
    chat.message = text;
    chat.createdAt = Date.now();
    state.publicChat.push(chat);
    while (state.publicChat.length > MAX_PUBLIC_CHAT) {
      state.publicChat.shift();
    }
    this.context.persistGameEvent("chat", {
      actorId: player.userId,
      visibility: "public",
      payload: {
        channel: chat.channel,
        message: chat.message,
      },
    });
  }

  private enforceMessageRate(userId: string) {
    const now = Date.now();
    const recent = (this.messageWindows.get(userId) ?? []).filter((timestamp) => now - timestamp < 5_000);
    if (recent.length >= 8) {
      this.messageWindows.set(userId, recent);
      throw new Error("Пишеш твърде бързо. Изчакай за момент.");
    }
    recent.push(now);
    this.messageWindows.set(userId, recent);
  }

  sendTyping(client: Client, channel: string, active: boolean) {
    const player = this.context.getPublicPlayer(client);
    const chatChannel = parseChatChannel(channel);
    const config = this.context.getConfig();
    if (!chatChannel || config.communicationMode === "no_chat" || config.communicationMode === "system_only") {
      return;
    }

    const payload = {
      type: "typing",
      channel: chatChannel,
      senderUserId: player.userId,
      senderName: player.displayName,
      active: Boolean(active),
      createdAt: Date.now(),
    } satisfies ServerEvent;

    const state = this.context.getState();
    if (chatChannel === "public") {
      if (
        config.communicationMode === "built_in_chat" &&
        !this.getPublicChatDenialReason(player, state, config)
      ) {
        this.context.broadcast("typing", payload);
      }
      return;
    }

    const privatePlayer = this.context.getPrivatePlayer(player.userId);
    const recipients = this.getPrivateChatRecipients(player, privatePlayer, chatChannel);
    for (const recipient of recipients) {
      recipient.send("typing", payload);
    }
  }

  private sendPrivateChat(player: PlayerPublicState, channel: ChatChannel, message: string) {
    const privatePlayer = this.context.getPrivatePlayer(player.userId);
    const text = normalizeChatMessage(message);
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const recipients = this.getPrivateChatRecipients(player, privatePlayer, channel);
    if (recipients.length === 0) {
      throw new Error("Нямаш достъп до този канал.");
    }

    for (const recipient of recipients) {
      recipient.send("private_chat", {
        type: "private_chat",
        id,
        channel,
        senderUserId: player.userId,
        senderName: player.displayName,
        message: text,
        createdAt,
      } satisfies ServerEvent);
    }

    this.context.persistGameEvent("chat", {
      actorId: player.userId,
      visibility: channel === "dead" ? "private" : "faction",
      payload: { channel, message: text },
    });
  }

  private getPrivateChatRecipients(player: PlayerPublicState, privatePlayer: PrivatePlayerState, channel: ChatChannel) {
    if (channel === "dead") {
      if (!player.playing || player.alive) {
        return [];
      }
      return this.context.clientsFor((candidate) => candidate.playing && !candidate.alive);
    }

    if (channel !== "mafia" && channel !== "werewolves" && channel !== "vampires") {
      return [];
    }
    if (!privatePlayer.role || !privatePlayer.alive) {
      return [];
    }

    const team = getRoleTeam(privatePlayer.role);
    if (channel === "mafia" && team !== "mafia") {
      return [];
    }
    if (channel === "werewolves" && team !== "werewolves") {
      return [];
    }
    if (channel === "vampires" && team !== "vampires") {
      return [];
    }

    const privatePlayers = this.context.getPrivatePlayers();
    return this.context.clientsFor((candidate) => {
      const privateCandidate = privatePlayers.get(candidate.userId);
      return Boolean(
        privateCandidate?.alive &&
          privateCandidate.role &&
          ((channel === "mafia" && getRoleTeam(privateCandidate.role) === "mafia") ||
            (channel === "werewolves" && getRoleTeam(privateCandidate.role) === "werewolves") ||
            (channel === "vampires" && getRoleTeam(privateCandidate.role) === "vampires")),
      );
    });
  }

  private getPublicChatDenialReason(player: PlayerPublicState, state: GameState, config: GameConfig) {
    const isSportDefense = config.mode === "mafia_sport" && state.phase === "defense";
    if (state.phase !== "day_discussion" && !isSportDefense) {
      return "Общият разговор е достъпен само през дневното обсъждане.";
    }
    if (!player.playing || !player.alive) {
      return "Само живите играчи могат да пишат в дневния разговор.";
    }
    if (config.mode !== "mafia_sport") {
      return undefined;
    }

    const authorizedUserId = state.phase === "defense" ? state.currentDefenseUserId : state.currentSpeakerUserId;
    return authorizedUserId === player.userId
      ? undefined
      : "Само текущият говорител може да пише в общия разговор.";
  }
}
