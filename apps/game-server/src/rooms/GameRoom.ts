import { Client, Room } from "colyseus";
import {
  assignRoles,
  assertRoleCompatibilityForMode,
  avatarIdForSeed,
  createGameConfigFromOptions,
  evaluateWinCondition,
  getGameFamily,
  getRoleNameBg,
  getRoleRuntimeStatus,
  getRoleTeam,
  normalizeRoomCode,
  normalizeAvatarId,
  parseClientCommand,
  phaseLabelBg,
  ROOM_CODE_REGEX,
  type ClientCommand,
  type GameConfig,
  type GameFamily,
  type GameMode,
  type GamePhase,
  type JoinRoomOptions,
  type NightActionCommand,
  type RoleCode,
  type ServerEvent,
  type CreateRoomOptions,
  type WinResult,
} from "@werewolf/shared";
import { getRoleblockedActorIds, resolveNight, type SubmittedNightAction } from "../game-logic/night-resolver.js";
import {
  GameState,
  NominationState,
  PlayerPublicState,
  PublicEventState,
  RoleCountState,
  VoteTallyState,
} from "./schemas/GameState.js";
import { verifyGameToken } from "@werewolf/shared/server";
import type { PersistEventInput, PersistPlayerInput } from "../persistence/game-persistence.js";
import { PlayerPresenceManager } from "./player-presence-manager.js";
import { PhaseStateMachine } from "./phase-state-machine.js";
import { AchievementBroadcaster, type AchievementUnlock } from "./achievement-broadcaster.js";
import {
  RoomPersistenceCoordinator,
  type PersistenceQueueOptions,
  type RoomPersistenceTaskApi,
} from "./room-persistence-coordinator.js";
import { RoomChatRouter } from "./room-chat-router.js";
import { PrivateEventDispatcher } from "./private-event-dispatcher.js";
import { buildNightActionCapabilities, hasNightActionCapabilities } from "./night-action-capabilities.js";
import {
  chooseDrunkRealRole,
  CommandRateLimiter,
  ensureNightActionAllowed,
  areLivingNightActorsReady,
  generateRoomCode,
  getActionTargetUserId,
  getAuth,
  getPhaseDurationMs,
  haveLivingPlayersVoted,
  hashRoomCode,
  isNightPhase,
  MAX_PUBLIC_EVENTS,
  PHASE_FLOW,
  type ClientAuth,
  type PrivatePlayerState,
} from "./game-room-runtime.js";

interface CreateOptions extends CreateRoomOptions {}

const CRITICAL_PERSISTED_EVENTS = new Set([
  "phase_change",
  "death",
  "vote_tally",
  "night_death_prevented",
  "priest_blessing_protected",
  "priest_blessing_protected_target",
  "guard_dog_protected_mayor",
]);

function persistencePriorityForEvent(type: string): NonNullable<PersistenceQueueOptions["priority"]> {
  if (type === "chat" || type === "night_action_submitted") {
    return "best-effort";
  }
  return CRITICAL_PERSISTED_EVENTS.has(type) ? "critical" : "normal";
}

export interface GameRoomPreview {
  code: string;
  status: "lobby" | "in_game" | "finished";
  playerCount: number;
  capacity: number;
  family: GameFamily;
  hostName: string | null;
  players: Array<{
    displayName: string;
    connected: boolean;
    ready: boolean;
    host: boolean;
  }>;
}

export class GameRoom extends Room<{ state: GameState }> {
  private static liveRooms = new Set<GameRoom>();
  private static recentEndings: Array<{
    code: string;
    winnerTeam: string;
    winnerReasonBg: string;
    endedAt: string;
    family: GameFamily;
  }> = [];
  private static readonly MAX_RECENT_ENDINGS = 12;

  static getRuntimeStats() {
    const byFamily: Partial<Record<GameFamily, number>> = {};

    for (const room of GameRoom.liveRooms) {
      const family = getGameFamily(room.config.mode);
      byFamily[family] = (byFamily[family] ?? 0) + 1;
    }

    return {
      activeRooms: GameRoom.liveRooms.size,
      connectedPlayers: [...GameRoom.liveRooms].reduce((sum, room) => sum + room.clients.length, 0),
      byFamily,
      recentEndings: GameRoom.recentEndings.map((ending) => ({
        ...ending,
        code: hashRoomCode(ending.code),
      })),
      lastWinner: GameRoom.recentEndings[0]
        ? { ...GameRoom.recentEndings[0], code: hashRoomCode(GameRoom.recentEndings[0].code) }
        : null,
    };
  }

  static getRoomPreview(code: string): GameRoomPreview | null {
    const normalizedCode = code.toUpperCase();
    if (!ROOM_CODE_REGEX.test(normalizedCode)) {
      return null;
    }

    const room = [...GameRoom.liveRooms].find((candidate) => candidate.state.code === normalizedCode);
    if (!room) {
      return null;
    }

    const players = [...room.state.players.values()].filter((player) => player.playing);
    const status = room.state.phase === "lobby" ? "lobby" : room.state.phase === "game_over" ? "finished" : "in_game";

    return {
      code: room.state.code,
      status,
      playerCount: players.length,
      capacity: room.config.maxPlayers,
      family: getGameFamily(room.config.mode),
      hostName: players.find((player) => player.host)?.displayName ?? null,
      players: players.slice(0, 6).map((player) => ({
        displayName: player.displayName,
        connected: player.connected,
        ready: player.ready,
        host: player.host,
      })),
    };
  }

  maxClients = 47;
  private config!: GameConfig;
  private playerPresence = new PlayerPresenceManager();
  private privatePlayers = new Map<string, PrivatePlayerState>();
  private pendingNightActions = new Map<string, SubmittedNightAction[]>();
  private phaseStateMachine!: PhaseStateMachine;
  private persistenceCoordinator = new RoomPersistenceCoordinator();
  private chatRouter!: RoomChatRouter;
  private privateEvents!: PrivateEventDispatcher;
  private hostUserId: string | undefined;
  private gameFinishedPersisted = false;
  private pendingHunterRevengeUserId: string | undefined;
  private pendingMayorSuccessor = false;
  private pendingVampireBites = new Map<string, { round: number; causeBg: string }>();
  private personalWinnerUserIds = new Set<string>();
  private achievementBroadcaster = new AchievementBroadcaster();
  private currentWitchVictimByTeam = new Map<"werewolves" | "vampires", string>();
  private commandRateLimiter = new CommandRateLimiter();
  private sportSpeechOrder: string[] = [];
  private sportSpeechIndex = -1;
  private sportDefenseOrder: string[] = [];
  private sportDefenseIndex = -1;
  private lastPersistedEventAtMs = 0;

  onCreate(options: CreateOptions) {
    const roomCode = options.code === undefined ? generateRoomCode() : normalizeRoomCode(options.code);
    if (!ROOM_CODE_REGEX.test(roomCode)) {
      throw new Error("Невалиден код на стая.");
    }

    this.phaseStateMachine = new PhaseStateMachine({
      clock: this.clock,
      onTimerElapsed: () => this.advancePhase(),
    });
    this.chatRouter = new RoomChatRouter({
      getState: () => this.state,
      getConfig: () => this.config,
      getPublicPlayer: (client) => this.getPublicPlayer(client),
      getPrivatePlayer: (userId) => this.getPrivatePlayer(userId),
      getPrivatePlayers: () => this.privatePlayers,
      clientsFor: (predicate) => this.clientsFor(predicate),
      broadcast: (type, payload) => this.broadcast(type, payload),
      persistGameEvent: (type, event) => this.persistGameEvent(type, event),
    });
    this.privateEvents = new PrivateEventDispatcher({
      getConfig: () => this.config,
      getPrivatePlayer: (userId) => this.privatePlayers.get(userId),
      getPrivatePlayers: () => this.privatePlayers.values(),
      getPublicPlayers: () => this.state.players.values(),
      findPlayerByUserId: (userId) => this.findPlayerByUserId(userId),
      playerPresence: this.playerPresence,
    });
    const mode = options.mode ?? "werewolves_classic";
    const playerCount = options.playerCount ?? (mode === "mafia_sport" ? 10 : 8);
    this.config = createGameConfigFromOptions({ ...options, mode, playerCount });
    this.enforceRuntimeRoleAvailability();
    this.assertCurrentRoleCompatibility();

    this.setState(new GameState());
    this.state.code = roomCode;
    this.state.rulesetVersion = this.config.rulesetVersion;
    this.state.phase = "lobby";
    this.syncPublicConfig();

    this.onMessage("*", (client, type, payload) => {
      const command = parseClientCommand(type, payload);
      if (!command) {
        this.sendSafeError(client, "Невалидна команда.");
        return;
      }
      this.handleCommand(client, command);
    });

    this.addPublicEvent("Стаята е създадена.");
    GameRoom.liveRooms.add(this);
  }

  async onAuth(_client: Client, options: JoinRoomOptions): Promise<ClientAuth> {
    const allowDevAuth = process.env.ALLOW_DEV_AUTH === "true" && process.env.NODE_ENV !== "production";
    if (allowDevAuth && options.userId && options.displayName) {
      return {
        userId: options.userId,
        displayName: options.displayName,
        avatarId: options.avatarId ? normalizeAvatarId(options.avatarId) : avatarIdForSeed(options.userId),
      };
    }

    if (options.token) {
      const payload = verifyGameToken(options.token, getGameTokenSecret(), { roomCode: this.state.code });
      if (!PlayerPresenceManager.consumeTokenNonce(payload.nonce, payload.expiresAt * 1000)) {
        throw new Error("Този токен вече е използван.");
      }
      return { userId: payload.userId, displayName: payload.displayName, avatarId: payload.avatarId };
    }

    throw new Error("Невалидна сесия.");
  }

  onJoin(client: Client, options: JoinRoomOptions, auth: ClientAuth) {
    if (!PlayerPresenceManager.checkJoinRateLimit(auth.userId)) {
      client.send("safe_error", {
        type: "safe_error",
        messageBg: "Твърде много опити за вход. Изчакай малко.",
      } satisfies ServerEvent);
      client.leave(4029);
      return;
    }

    const previousClient = this.playerPresence.getClient(auth.userId);
    const existingEntry = this.findPlayerEntryByUserId(auth.userId);
    const existing = existingEntry?.[1];
    if (existing) {
      existing.avatarId = auth.avatarId;
      if (!options.spectator && !this.state.locked && this.state.phase === "lobby" && !existing.playing) {
        if (!this.hasAvailablePlayerSlot(auth.userId)) {
          this.sendSafeError(client, "Стаята е пълна.");
          client.leave();
          return;
        }
        this.activateClient(auth, client, previousClient);
        existing.host = existing.host || !this.hasHostPlayer();
        existing.narrator = existing.host && this.config.narratorMode !== "automatic";
        existing.playing = !existing.narrator;
        existing.alive = existing.playing;
        existing.ready = false;
        this.privatePlayers.set(auth.userId, { userId: auth.userId, alive: existing.playing });
        if (existing.host) {
          this.hostUserId = auth.userId;
        }
        this.addPublicEvent(`${auth.displayName} вече участва в стаята.`);
      } else {
        this.activateClient(auth, client, previousClient);
        this.addPublicEvent(`${auth.displayName} се върна в стаята.`);
      }
      existing.connected = true;
      this.ensureHostAssigned();
      this.privateEvents.sendPrivateRole(client, auth.userId);
      this.privateEvents.sendNarratorRoleSnapshot(client, auth.userId);
      this.sendNightActionCapabilities(auth.userId, client);
      return;
    }

    if (this.isDisplayNameTaken(auth.displayName, auth.userId)) {
      client.send("safe_error", {
        type: "safe_error",
        messageBg: "Това име вече се използва в стаята.",
      } satisfies ServerEvent);
      client.leave();
      return;
    }

    if (this.state.locked && !options.spectator) {
      client.send("safe_error", { type: "safe_error", messageBg: "Играта вече е заключена." } satisfies ServerEvent);
      client.leave();
      return;
    }
    if (!options.spectator && !this.hasAvailablePlayerSlot(auth.userId)) {
      this.sendSafeError(client, "Стаята е пълна.");
      client.leave();
      return;
    }

    this.activateClient(auth, client, previousClient);
    const player = new PlayerPublicState();
    player.userId = auth.userId;
    player.displayName = auth.displayName;
    player.avatarId = auth.avatarId;
    player.host = !options.spectator && !this.hasHostPlayer();
    player.narrator = player.host && this.config.narratorMode !== "automatic";
    player.playing = !player.narrator && !options.spectator;
    player.alive = player.playing;
    player.acceptedFullNarrator = false;
    this.state.players.set(client.sessionId, player);
    this.privatePlayers.set(auth.userId, { userId: auth.userId, alive: player.playing });
    if (player.host) {
      this.hostUserId = auth.userId;
    }
    this.addPublicEvent(options.spectator ? `${auth.displayName} наблюдава играта.` : `${auth.displayName} влезе в стаята.`);
    this.persistGameEvent("player_joined", {
      actorId: auth.userId,
      payload: { displayName: auth.displayName, spectator: Boolean(options.spectator) },
    });
  }

  private activateClient(auth: ClientAuth, client: Client, previousClient?: Client) {
    client.userData = auth;
    this.playerPresence.attachClient(auth.userId, client);
    if (!previousClient || previousClient.sessionId === client.sessionId) {
      return;
    }

    previousClient.send("safe_error", {
      type: "safe_error",
      messageBg: "Влязохте от друго устройство.",
    } satisfies ServerEvent);
    previousClient.leave(1000);
  }

  async onDrop(client: Client) {
    const auth = getAuth(client);
    if (!auth) {
      return;
    }

    const player = this.playerPresence.getClient(auth.userId) === client ? this.findPlayerByUserId(auth.userId) : undefined;
    if (player) {
      player.connected = false;
      this.addPublicEvent(`${player.displayName} загуби връзка.`);
    }

    await this.allowReconnection(client, this.config.liveMode ? 300 : 90);
  }

  onReconnect(client: Client) {
    const auth = getAuth(client);
    if (!auth) {
      return;
    }

    this.playerPresence.attachClient(auth.userId, client);
    const player = this.findPlayerByUserId(auth.userId);
    if (player) {
      player.connected = true;
      this.ensureHostAssigned();
      this.privateEvents.sendPrivateRole(client, auth.userId);
      this.privateEvents.sendNarratorRoleSnapshot(client, auth.userId);
      this.sendNightActionCapabilities(auth.userId, client);
      this.addPublicEvent(`${player.displayName} възстанови връзката.`);
    }
  }

  onLeave(client: Client) {
    const auth = getAuth(client);
    if (!auth) {
      return;
    }

    const isActiveClient = this.playerPresence.getClient(auth.userId) === client;
    this.playerPresence.detachClient(auth.userId, client);
    if (!isActiveClient) {
      return;
    }

    this.commandRateLimiter.delete(auth.userId);
    const playerEntry = this.findPlayerEntryByUserId(auth.userId);
    const player = playerEntry?.[1];
    if (player) {
      player.connected = false;
    }
    if (player && this.state.phase === "lobby") {
      this.addPublicEvent(`${player.displayName} напусна стаята.`);
      this.persistGameEvent("player_left", {
        actorId: auth.userId,
        payload: { displayName: player.displayName },
      });
      this.state.players.delete(playerEntry[0]);
      this.privatePlayers.delete(auth.userId);
    }
    if (player?.host) {
      player.host = false;
      this.assignHostSuccessor(auth.userId);
    }
  }

  async onDispose() {
    this.phaseStateMachine.dispose();
    const persistenceDisposed = await this.persistenceCoordinator.dispose(25_000);
    if (!persistenceDisposed && this.persistenceCoordinator.enabled) {
      console.error(
        "[game-persistence]",
        new Error(`[GameRoom ${this.state.code}] persistence coordinator disposal was incomplete`),
      );
    }
    GameRoom.liveRooms.delete(this);
    this.playerPresence.clear();
    this.privatePlayers.clear();
    this.pendingNightActions.clear();
    this.pendingVampireBites.clear();
    this.personalWinnerUserIds.clear();
    this.achievementBroadcaster.reset();
    this.currentWitchVictimByTeam.clear();
    this.commandRateLimiter.clear();
    this.sportSpeechOrder = [];
    this.sportDefenseOrder = [];
  }

  private handleCommand(client: Client, command: ClientCommand) {
    const auth = getAuth(client);
    if (!auth || this.playerPresence.getClient(auth.userId) !== client) {
      this.sendSafeError(client, "Тази връзка вече не е активна.");
      return;
    }
    if (!this.commandRateLimiter.allow(auth.userId, command.type)) {
      this.sendSafeError(client, "Изпращаш командите твърде бързо. Изчакай малко.");
      return;
    }

    try {
      switch (command.type) {
        case "ready":
          this.setReady(client, command.ready);
          break;
        case "startGame":
          this.startGame(client);
          break;
        case "submitNightAction":
          this.submitNightAction(client, command.action);
          break;
        case "submitNomination":
          this.submitNomination(client, command.targetUserId);
          break;
        case "submitVote":
          this.submitVote(client, command.targetUserId);
          break;
        case "submitHunterRevenge":
          this.submitHunterRevenge(client, command.targetUserId);
          break;
        case "sendChat":
          this.chatRouter.sendChat(client, command.channel, command.message);
          break;
        case "typing":
          this.chatRouter.sendTyping(client, command.channel, command.active);
          break;
        case "setNarrator":
          this.setNarrator(client, command.targetUserId, command.narrator);
          break;
        case "setMayor":
          this.setMayor(client, command.targetUserId);
          break;
        case "acceptFullNarrator":
          this.acceptFullNarrator(client);
          break;
        case "narratorPause":
          this.pauseByNarrator(client);
          break;
        case "narratorAdvance":
          this.advanceByNarrator(client);
          break;
        case "narratorExtendTimer":
          this.extendTimerByNarrator(client, command.seconds);
          break;
        default:
          this.sendSafeError(client, "Непозната команда.");
      }
    } catch (error) {
      this.sendSafeError(client, error instanceof Error ? error.message : "Възникна грешка.");
    }
  }

  private setReady(client: Client, ready: boolean) {
    const player = this.getPublicPlayer(client);
    player.ready = ready;
    this.tryAutoStart();
  }

  private tryAutoStart() {
    if (!this.config.autoStart || this.state.phase !== "lobby" || !this.hostUserId) {
      return;
    }

    const players = [...this.state.players.values()].filter((player) => player.playing);
    const allReady = players.length >= this.config.playerCount && players.every((player) => player.ready);
    const hostClient = this.playerPresence.getClient(this.hostUserId);
    if (!allReady || !hostClient) {
      return;
    }

    try {
      this.startGame(hostClient);
    } catch (error) {
      this.sendSafeError(hostClient, error instanceof Error ? error.message : "Автоматичният старт не успя.");
    }
  }

  private isDisplayNameTaken(displayName: string, userId: string) {
    const normalized = displayName.trim().toLocaleLowerCase("bg-BG");
    return [...this.state.players.values()].some(
      (player) => player.userId !== userId && player.displayName.trim().toLocaleLowerCase("bg-BG") === normalized,
    );
  }

  private setNarrator(client: Client, targetUserId: string, narrator: boolean) {
    const actor = this.getPublicPlayer(client);
    if (!actor.host) {
      throw new Error("Само домакинът може да избере Разказвач.");
    }
    if (this.state.phase !== "lobby") {
      throw new Error("Разказвачът се избира само преди старт.");
    }
    if (this.config.narratorMode === "automatic") {
      throw new Error("Тази стая е с Автоматичен Разказвач.");
    }

    const target = this.findPlayerByUserId(targetUserId);
    if (!target?.playing && !target?.narrator) {
      throw new Error("Разказвач може да бъде само участник в стаята.");
    }

    for (const player of this.state.players.values()) {
      if (!player.narrator || player.userId === targetUserId) {
        continue;
      }
      player.narrator = false;
      player.playing = true;
      player.alive = true;
      const privatePlayer = this.privatePlayers.get(player.userId);
      if (privatePlayer && !privatePlayer.role) {
        privatePlayer.alive = true;
      }
    }
    target.narrator = narrator;
    target.playing = !narrator;
    target.alive = !narrator;
    const privateTarget = this.privatePlayers.get(target.userId);
    if (privateTarget && !privateTarget.role) {
      privateTarget.alive = !narrator;
    }
    this.addPublicEvent(narrator ? `${target.displayName} е избран за Разказвач.` : "Разказвачът е премахнат.");
    this.persistGameEvent("narrator_assigned", {
      actorId: actor.userId,
      targetId: target.userId,
      visibility: "moderator",
      payload: { narrator, narratorMode: this.config.narratorMode },
    });
  }

  private acceptFullNarrator(client: Client) {
    const player = this.getPublicPlayer(client);
    if (this.config.narratorMode !== "full_human") {
      throw new Error("Тази стая не използва Пълен Разказвач.");
    }

    player.acceptedFullNarrator = true;
    this.addPublicEvent(`${player.displayName} прие предупреждението за Пълен Разказвач.`);
    this.persistGameEvent("full_narrator_accepted", {
      actorId: player.userId,
      visibility: "moderator",
    });
  }

  private setMayor(client: Client, targetUserId: string) {
    const actor = this.getPublicPlayer(client);
    if (!actor.host && !actor.narrator) {
      throw new Error("Само домакинът или Разказвачът може да избере Кмет.");
    }
    if (!this.config.mayorEnabled) {
      throw new Error("Кметът не е активен за този режим.");
    }
    if (this.state.phase !== "lobby" && this.state.phase !== "mayor_successor") {
      throw new Error("Кмет се избира само в лоби или при наследяване.");
    }

    const target = this.findPlayerByUserId(targetUserId);
    if (!target?.playing || !target.alive) {
      throw new Error("Кмет може да бъде само жив активен играч.");
    }

    for (const player of this.state.players.values()) {
      player.mayor = false;
    }
    for (const privatePlayer of this.privatePlayers.values()) {
      privatePlayer.isMayor = false;
    }
    target.mayor = true;
    this.getPrivatePlayer(target.userId).isMayor = true;
    this.addPublicEvent(`${target.displayName} е Кмет. Гласът му решава при равенство.`);
    this.persistGameEvent("mayor_assigned", {
      actorId: actor.userId,
      targetId: target.userId,
      visibility: "public",
    });

    if (this.state.phase === "mayor_successor") {
      this.pendingMayorSuccessor = false;
      this.transitionTo("resolution");
    }
  }

  private startGame(client: Client) {
    const player = this.getPublicPlayer(client);
    if (!player.host) {
      throw new Error("Само домакинът може да започне играта.");
    }
    if (this.state.phase !== "lobby") {
      throw new Error("Играта вече е започнала.");
    }

    const allPlayers = [...this.state.players.values()];
    if (this.config.narratorMode !== "automatic" && !allPlayers.some((item) => item.narrator)) {
      throw new Error("Изберете Разказвач преди старт.");
    }
    if (this.config.narratorMode === "full_human") {
      const pendingAcceptance = allPlayers.filter((item) => !item.acceptedFullNarrator);
      if (pendingAcceptance.length > 0) {
        throw new Error("Всички играчи трябва да приемат предупреждението за Пълен Разказвач.");
      }
    }

    const players = allPlayers.filter((item) => item.playing);
    const mode = this.config.mode;
    this.config = createGameConfigFromOptions({
      mode,
      playerCount: players.length,
      maxPlayers: this.config.maxPlayers,
      narratorMode: this.config.narratorMode,
      communicationMode: this.config.communicationMode,
      tempoProfile: this.config.tempoProfile,
      ...(this.config.tempoProfile === "manual" ? { customTimers: this.config.timers } : {}),
      loversEnabled: this.config.loversEnabled,
      rolePreset: this.config.rolePreset,
      revealRolesOnDeath: this.config.revealRolesOnDeath,
      tieBreaker: this.config.tieBreaker,
      firstNightKill: this.config.firstNightKill,
      allowSkipVote: this.config.allowSkipVote,
      majorityMode: this.config.majorityMode,
      autoStart: this.config.autoStart,
      beginnerMode: this.config.beginnerMode,
      advancedMode: this.config.advancedMode,
      werewolfVariant: this.config.werewolfVariant,
      mayorMode: this.config.mayorMode,
      promoRolesEnabled: this.config.promoRolesEnabled,
      mafiaNightKill: this.config.mafiaNightKill,
      doctorCanSelfProtect: this.config.doctorCanSelfProtect,
      commissionerResultMode: this.config.commissionerResultMode,
      maniacEnabled: this.config.maniacEnabled,
      jesterEnabled: this.config.jesterEnabled,
      narratorVoice: this.config.narratorVoice,
      ...(this.config.rolePreset === "manual" ? { roles: this.config.roles } : {}),
    });
    this.enforceRuntimeRoleAvailability();
    this.assertCurrentRoleCompatibility();
    this.syncPublicConfig();
    this.personalWinnerUserIds.clear();
    const lobbySelectedMayorUserId = this.config.mayorMode === "public_vote"
      ? players.find((item) => item.mayor)?.userId
      : undefined;
    const assignments = assignRoles(
      players.map((item) => item.userId),
      this.config.roles,
    );

    if (lobbySelectedMayorUserId) {
      const selectedAssignment = assignments.find((assignment) => assignment.playerId === lobbySelectedMayorUserId);
      const mayorAssignment = assignments.find(
        (assignment) => assignment.role === "mayor" || assignment.role === "mafia_mayor",
      );
      if (selectedAssignment && mayorAssignment && selectedAssignment !== mayorAssignment) {
        const selectedRole = selectedAssignment.role;
        selectedAssignment.role = mayorAssignment.role;
        mayorAssignment.role = selectedRole;
      }
    }
    for (const item of players) {
      item.mayor = false;
    }

    for (const assignment of assignments) {
      const privatePlayer = this.privatePlayers.get(assignment.playerId);
      if (privatePlayer) {
        privatePlayer.role = assignment.role;
        privatePlayer.alive = true;
        privatePlayer.loverId = null;
        privatePlayer.witchHealUsed = false;
        privatePlayer.witchPoisonUsed = false;
        privatePlayer.priestBlessUsed = false;
        privatePlayer.priestBlessed = false;
        delete privatePlayer.priestBlessedTargetUserId;
        privatePlayer.blacksmithUsed = false;
        privatePlayer.investigatorUsed = false;
        privatePlayer.vampireHunterDisarmed = false;
        privatePlayer.isMayor = false;
        delete privatePlayer.deathRound;
        delete privatePlayer.deathCause;
        if (assignment.role === "drunk") {
          privatePlayer.drunkRealRole = chooseDrunkRealRole(this.config.roles);
        } else {
          delete privatePlayer.drunkRealRole;
        }
        delete privatePlayer.lastResolvedHealerTargetUserId;
        delete privatePlayer.lastVoteTarget;
      }
    }

    const assignedMayorUserId = assignments.find(
      (assignment) => assignment.role === "mayor" || assignment.role === "mafia_mayor",
    )?.playerId;
    const mechanicalMayorUserId = this.config.mayorMode === "public_vote"
      ? lobbySelectedMayorUserId ?? assignedMayorUserId
      : assignedMayorUserId;
    if (mechanicalMayorUserId) {
      const privateMayor = this.privatePlayers.get(mechanicalMayorUserId);
      const publicMayor = players.find((item) => item.userId === mechanicalMayorUserId);
      if (privateMayor) {
        privateMayor.isMayor = true;
      }
      if (publicMayor && this.config.mayorMode === "public_vote") {
        publicMayor.mayor = true;
        if (!lobbySelectedMayorUserId) {
          this.addPublicEvent(`${publicMayor.displayName} е Кмет.`);
        }
      }
    }

    this.state.locked = true;
    this.state.round = 1;
    this.transitionTo("role_reveal");

    const persistedConfig = structuredClone(this.config);
    const persistedAssignments = structuredClone(assignments);
    const persistedPlayers = assignments.map((assignment) => {
      const publicPlayer = players.find((item) => item.userId === assignment.playerId);
      return {
        userId: assignment.playerId,
        displayName: publicPlayer?.displayName ?? assignment.playerId,
        role: assignment.role,
        isAlive: true,
      };
    });
    const gameStartedEvent: PersistEventInput = {
      round: this.state.round,
      phase: this.currentPhase(),
      type: "game_started",
      actorId: player.userId,
      participantUserIds: allPlayers.map((item) => item.userId),
      visibility: "moderator",
      payload: { assignments: persistedAssignments },
      occurredAt: this.nextPersistedEventTime(),
    };

    this.queuePersistence(async ({ persistence, ensureGame, idempotencyKeys }) => {
      const gameId = await ensureGame();
      if (!gameId) {
        return;
      }

      await persistence.markGameActive(gameId, persistedConfig);
      await persistence.upsertPlayers(gameId, persistedPlayers);
      await persistence.recordEvent(gameId, {
        ...gameStartedEvent,
        ...(idempotencyKeys ? { idempotencyKey: idempotencyKeys.event("game-started") } : {}),
      });
    }, { priority: "critical", maxAttempts: 3 });

    for (const item of players) {
      const targetClient = this.playerPresence.getClient(item.userId);
      if (targetClient) {
        this.privateEvents.sendPrivateRole(targetClient, item.userId);
      }
    }
    for (const item of allPlayers) {
      const targetClient = this.playerPresence.getClient(item.userId);
      if (targetClient) {
        this.privateEvents.sendNarratorRoleSnapshot(targetClient, item.userId);
      }
    }
  }

  private submitNightAction(client: Client, action: NightActionCommand) {
    const publicPlayer = this.getPublicPlayer(client);
    const privatePlayer = this.getPrivatePlayer(publicPlayer.userId);
    if (!isNightPhase(this.state.phase)) {
      throw new Error("В момента не се приемат нощни действия.");
    }
    if (!privatePlayer.alive) {
      throw new Error("Елиминиран играч не може да действа.");
    }
    if (!privatePlayer.role) {
      throw new Error("Ролите още не са раздадени.");
    }
    ensureNightActionAllowed(privatePlayer.role, action, this.state.phase);
    if (action.kind === "faction_kill" && !this.isFactionKillAllowed(privatePlayer)) {
      throw new Error(
        this.state.phase === "first_night" && !this.config.firstNightKill
          ? "Убийствата са изключени през първата нощ."
          : "Нощното убийство на Мафията е изключено за тази стая.",
      );
    }
    this.validateNightActionSubmission(publicPlayer, privatePlayer, action);

    if (action.kind === "thief_steal") {
      // The Thief wakes before the remaining roles. Applying the exchange now
      // gives the new role a real chance to act during the same first night.
      this.applyThiefSteal(publicPlayer, privatePlayer, action.targetUserId);
    } else {
      this.queueNightAction(publicPlayer.userId, privatePlayer.role, action);
    }
    if (action.kind === "faction_kill") {
      this.notifyWitchesOfFactionVictim();
    }
    this.persistGameEvent("night_action_submitted", {
      actorId: publicPlayer.userId,
      targetId: getActionTargetUserId(action),
      visibility: "moderator",
      payload: { action },
    });
    client.send("night_action_ack", {
      type: "night_action_ack",
      phase: this.state.phase,
      round: this.state.round,
    } satisfies ServerEvent);
    this.sendNightActionCapabilities(publicPlayer.userId, client);

    if (
      this.config.timers.autoAdvanceWhenReady &&
      areLivingNightActorsReady(
        this.privatePlayers.values(),
        this.state.phase,
        (actorUserId, kind) => this.hasReadyNightAction(actorUserId, kind),
        (actor) => this.isFactionKillAllowed(actor),
      )
    ) {
      this.advancePhase();
    }
  }

  private queueNightAction(actorUserId: string, role: RoleCode, action: NightActionCommand) {
    const submission = { actorUserId, action };
    if (action.kind === "skip") {
      if (this.supportsCombinedNightActions(role)) {
        const existing = this.pendingNightActions.get(actorUserId) ?? [];
        this.pendingNightActions.set(actorUserId, [
          ...existing.filter((item) => item.action.kind !== "skip"),
          submission,
        ]);
        return;
      }
      this.pendingNightActions.set(actorUserId, [submission]);
      return;
    }
    if (this.supportsCombinedNightActions(role)) {
      const existing = this.pendingNightActions.get(actorUserId) ?? [];
      this.pendingNightActions.set(actorUserId, [
        ...existing.filter((item) => item.action.kind !== action.kind && item.action.kind !== "skip"),
        submission,
      ]);
      return;
    }

    this.pendingNightActions.set(actorUserId, [submission]);
  }

  private supportsCombinedNightActions(role: RoleCode) {
    return role === "witch" || role === "don" || role === "lawyer" || role === "informant";
  }

  private getSubmittedNightActions() {
    return [...this.pendingNightActions.values()].flat();
  }

  private hasPendingNightAction(actorUserId: string, kind?: NightActionCommand["kind"]) {
    const submissions = this.pendingNightActions.get(actorUserId) ?? [];
    if (!kind) {
      return submissions.length > 0;
    }
    return submissions.some((submission) => submission.action.kind === kind);
  }

  private hasReadyNightAction(actorUserId: string, kind?: NightActionCommand["kind"]) {
    if (kind) {
      return this.hasPendingNightAction(actorUserId, kind);
    }
    const actor = this.privatePlayers.get(actorUserId);
    if (actor?.role !== "lawyer" && actor?.role !== "informant") {
      return this.hasPendingNightAction(actorUserId);
    }
    if (this.hasPendingNightAction(actorUserId, "skip")) {
      return true;
    }
    const specialKind = actor.role === "lawyer" ? "lawyer_cover" : "check_role";
    return this.hasPendingNightAction(actorUserId, specialKind) &&
      (!this.isFactionKillAllowed(actor) || this.hasPendingNightAction(actorUserId, "faction_kill"));
  }

  private sendNightActionCapabilities(userId: string, client = this.playerPresence.getClient(userId)) {
    if (!client || !isNightPhase(this.state.phase)) {
      return;
    }

    const privatePlayer = this.privatePlayers.get(userId);
    if (!privatePlayer) {
      return;
    }

    const includePrivateBlessingTargets = privatePlayer.role === "priest";
    const players = [...this.state.players.values()].map((player) => ({
      userId: player.userId,
      playing: player.playing,
      alive: player.alive,
      ...(includePrivateBlessingTargets
        ? { priestBlessed: Boolean(this.privatePlayers.get(player.userId)?.priestBlessed) }
        : {}),
    }));
    const actorTeam = privatePlayer.role ? getRoleTeam(privatePlayer.role) : undefined;
    const alliedTargetUserIds = actorTeam === "mafia" || actorTeam === "werewolves" || actorTeam === "vampires"
      ? [...this.privatePlayers.values()]
          .filter((player) => player.userId !== userId && player.role && getRoleTeam(player.role) === actorTeam)
          .map((player) => player.userId)
      : [];
    const capabilities = buildNightActionCapabilities({
      actor: privatePlayer,
      phase: this.state.phase,
      players,
      allowFactionKill: this.isFactionKillAllowed(privatePlayer),
      alliedTargetUserIds,
    });
    if (!hasNightActionCapabilities(capabilities)) {
      return;
    }

    client.send("night_action_capabilities", {
      type: "night_action_capabilities",
      capabilities,
    } satisfies ServerEvent);
  }

  private sendNightActionCapabilitiesToActors() {
    for (const player of this.privatePlayers.values()) {
      this.sendNightActionCapabilities(player.userId);
    }
  }

  private notifyWitchesOfFactionVictim() {
    const actions = this.getSubmittedNightActions().filter((submission) => submission.action.kind === "faction_kill");
    const currentVictimIds = new Set<string>();
    const changedVictimIds = new Set<string>();

    for (const team of ["werewolves", "vampires"] as const) {
      const livingFaction = [...this.privatePlayers.values()].filter(
        (player) => player.alive && player.role && getRoleTeam(player.role) === team,
      );
      if (livingFaction.length === 0) {
        this.currentWitchVictimByTeam.delete(team);
        continue;
      }

      const votes = new Map<string, number>();
      for (const submission of actions) {
        const actor = this.privatePlayers.get(submission.actorUserId);
        const targetUserId = submission.action.kind === "faction_kill" ? submission.action.targetUserId : "";
        const target = this.privatePlayers.get(targetUserId);
        if (!actor?.role || getRoleTeam(actor.role) !== team || !target?.role || getRoleTeam(target.role) === team) {
          continue;
        }
        votes.set(targetUserId, (votes.get(targetUserId) ?? 0) + 1);
      }

      const [targetUserId, count] = [...votes.entries()].find(([, value]) => value === livingFaction.length) ?? [];
      if (!targetUserId || count !== livingFaction.length) {
        this.currentWitchVictimByTeam.delete(team);
        continue;
      }

      currentVictimIds.add(targetUserId);
      if (this.currentWitchVictimByTeam.get(team) !== targetUserId) {
        changedVictimIds.add(targetUserId);
      }
      this.currentWitchVictimByTeam.set(team, targetUserId);
    }

    for (const witch of this.privatePlayers.values()) {
      if (!witch.alive || witch.role !== "witch") {
        continue;
      }
      const client = this.playerPresence.getClient(witch.userId);
      let removedStaleHeal = false;

      if (!witch.witchHealUsed) {
        const pending = this.pendingNightActions.get(witch.userId) ?? [];
        const remaining = pending.filter(
          (submission) =>
            submission.action.kind !== "witch_heal" || currentVictimIds.has(submission.action.targetUserId),
        );
        removedStaleHeal = remaining.length !== pending.length;
        if (removedStaleHeal) {
          if (remaining.length > 0) {
            this.pendingNightActions.set(witch.userId, remaining);
          } else {
            this.pendingNightActions.delete(witch.userId);
          }
          if (client) {
            client.send("system", {
              type: "system",
              messageBg: "Жертвата на фракцията се промени. Избери отново дали да използваш лечебната отвара.",
            } satisfies ServerEvent);
          }
        }
      }

      if (client && !witch.witchHealUsed) {
        for (const targetUserId of changedVictimIds) {
          const target = this.findPlayerByUserId(targetUserId);
          if (!target) {
            continue;
          }
          client.send("system", {
            type: "system",
            messageBg: `${target.displayName} е нарочен за смърт тази нощ.`,
          } satisfies ServerEvent);
        }
      }
      if (client) {
        this.sendNightActionCapabilities(witch.userId, client);
      }
    }
  }

  private submitNomination(client: Client, targetUserId: string) {
    if (this.config.mode !== "mafia_sport") {
      throw new Error("Номинациите с ред на изказване са само за Спортна Мафия.");
    }
    if (this.state.phase !== "day_discussion") {
      throw new Error("Номинации се приемат само по време на дневните речи.");
    }

    const actor = this.getPublicPlayer(client);
    const privateActor = this.getPrivatePlayer(actor.userId);
    if (!actor.playing || !actor.alive || !privateActor.alive) {
      throw new Error("Само жив активен играч може да номинира.");
    }
    if (this.state.currentSpeakerUserId !== actor.userId) {
      throw new Error("Само текущият говорител може да направи номинация.");
    }
    if (targetUserId === actor.userId) {
      throw new Error("Не можеш да номинираш себе си.");
    }

    const target = this.findPlayerByUserId(targetUserId);
    const privateTarget = this.privatePlayers.get(targetUserId);
    if (!target?.playing || !target.alive || !privateTarget?.alive) {
      throw new Error("Номинацията трябва да е за жив активен играч.");
    }

    const existingIndex = this.state.nominations.findIndex(
      (nomination) => nomination.nominatorUserId === actor.userId,
    );
    const replaced = existingIndex >= 0;
    const nomination = new NominationState();
    nomination.nominatorUserId = actor.userId;
    nomination.targetUserId = targetUserId;
    if (replaced) {
      this.state.nominations.splice(existingIndex, 1, nomination);
    } else {
      this.state.nominations.push(nomination);
    }

    this.addPublicEvent(
      replaced
        ? `${actor.displayName} смени номинацията си: ${target.displayName}.`
        : `${actor.displayName} номинира ${target.displayName}.`,
    );
    this.persistGameEvent("nomination_submitted", {
      actorId: actor.userId,
      targetId: targetUserId,
      visibility: "public",
      payload: { replaced },
    });
    client.send("nomination_ack", {
      type: "nomination_ack",
      phase: this.state.phase,
      round: this.state.round,
      targetUserId,
      replaced,
    } satisfies ServerEvent);
  }

  private submitVote(client: Client, targetUserId: string) {
    const publicPlayer = this.getPublicPlayer(client);
    const privatePlayer = this.getPrivatePlayer(publicPlayer.userId);
    if (this.state.phase !== "voting") {
      throw new Error("В момента не се приема гласуване.");
    }
    if (!privatePlayer.alive) {
      throw new Error("Елиминиран играч не може да гласува.");
    }
    if (
      this.state.revoteEligibleUserIds.length > 0
      && !this.state.revoteEligibleUserIds.includes(targetUserId)
    ) {
      throw new Error("При прегласуване може да избереш само играч от равенството.");
    }
    if (this.config.mode === "mafia_sport" && !this.sportNomineeIds().has(targetUserId)) {
      throw new Error("В Спортна Мафия се гласува само за номиниран играч.");
    }
    if (targetUserId === "skip") {
      if (!this.config.allowSkipVote) {
        throw new Error("Пропускането на глас е изключено за тази стая.");
      }
      delete privatePlayer.lastVoteTarget;
      publicPlayer.hasVoted = true;
      this.syncVoteTally();
      this.persistGameEvent("vote_submitted", {
        actorId: publicPlayer.userId,
        visibility: "public",
        payload: { skipped: true },
      });
      client.send("vote_ack", {
        type: "vote_ack",
        phase: this.state.phase,
        round: this.state.round,
        targetUserId: "skip",
      } satisfies ServerEvent);
      if (
        this.config.timers.autoAdvanceWhenReady &&
        haveLivingPlayersVoted(this.privatePlayers.values(), (userId) => this.findPlayerByUserId(userId))
      ) {
        this.advancePhase();
      }
      return;
    }
    const target = this.findPlayerByUserId(targetUserId);
    const privateTarget = this.privatePlayers.get(targetUserId);
    if (!target?.playing || !target.alive || !privateTarget?.alive) {
      throw new Error("Целта не е жив играч.");
    }
    if (privatePlayer.loverId === targetUserId) {
      throw new Error("Влюбените не могат да гласуват един срещу друг.");
    }

    privatePlayer.lastVoteTarget = targetUserId;
    publicPlayer.hasVoted = true;
    this.syncVoteTally();
    this.persistGameEvent("vote_submitted", {
      actorId: publicPlayer.userId,
      targetId: targetUserId,
      visibility: "public",
    });
    client.send("vote_ack", {
      type: "vote_ack",
      phase: this.state.phase,
      round: this.state.round,
      targetUserId,
    } satisfies ServerEvent);

    if (
      this.config.timers.autoAdvanceWhenReady &&
      haveLivingPlayersVoted(this.privatePlayers.values(), (userId) => this.findPlayerByUserId(userId))
    ) {
      this.advancePhase();
    }
  }

  private submitHunterRevenge(client: Client, targetUserId: string) {
    const publicPlayer = this.getPublicPlayer(client);
    if (this.state.phase !== "hunter_revenge") {
      throw new Error("В момента няма отмъщение на Ловеца.");
    }
    if (publicPlayer.userId !== this.pendingHunterRevengeUserId) {
      throw new Error("Само падналият Ловец може да стреля.");
    }
    const target = this.findPlayerByUserId(targetUserId);
    if (!target?.playing || !target.alive) {
      throw new Error("Ловецът трябва да избере жив играч.");
    }

    client.send("hunter_revenge_ack", {
      type: "hunter_revenge_ack",
      phase: this.state.phase,
      round: this.state.round,
      targetUserId,
    } satisfies ServerEvent);
    this.pendingHunterRevengeUserId = undefined;
    const deaths = this.applyDeaths([{ userId: targetUserId, causeBg: "Застрелян от Ловеца." }]);
    // queueMayorSuccessor consults this.pendingMayorSuccessor too, so a mayor
    // who died alongside a hunter still triggers a successor selection here.
    if (this.queueMayorSuccessor(deaths)) {
      return;
    }
    this.transitionTo("resolution");
  }

  private validateNightActionSubmission(
    publicPlayer: PlayerPublicState,
    privatePlayer: PrivatePlayerState,
    action: NightActionCommand,
  ) {
    this.validateNightActionTargetMembership(action);
    if (action.kind === "faction_kill") {
      if (action.targetUserId === publicPlayer.userId) {
        throw new Error("Не можеш да избереш себе си за нощна атака.");
      }
      const actorTeam = privatePlayer.role ? getRoleTeam(privatePlayer.role) : undefined;
      const targetRole = this.getPrivatePlayer(action.targetUserId).role;
      if (
        targetRole &&
        (actorTeam === "mafia" || actorTeam === "werewolves" || actorTeam === "vampires") &&
        getRoleTeam(targetRole) === actorTeam
      ) {
        throw new Error("Не можеш да избереш свой съотборник.");
      }
    }
    if (action.kind === "witch_heal" && privatePlayer.witchHealUsed) {
      throw new Error("Вещицата вече е използвала лечението си.");
    }
    if (
      action.kind === "witch_heal" &&
      ![...this.currentWitchVictimByTeam.values()].includes(action.targetUserId)
    ) {
      throw new Error("Вещицата може да лекува само текущата жертва на вражеска фракция.");
    }
    if (action.kind === "witch_poison" && privatePlayer.witchPoisonUsed) {
      throw new Error("Вещицата вече е използвала отровата си.");
    }
    if (action.kind === "healer_protect" && privatePlayer.role === "healer") {
      if (action.targetUserId === publicPlayer.userId) {
        throw new Error("Лечителят не може да лекува себе си.");
      }
      if (
        privatePlayer.lastResolvedHealerTargetUserId === action.targetUserId
      ) {
        throw new Error("Лечителят не може да лекува същия играч две нощи поред.");
      }
    }
    if (action.kind === "healer_protect" && privatePlayer.role === "doctor" && action.targetUserId === publicPlayer.userId) {
      if (!this.config.doctorCanSelfProtect) {
        throw new Error("Докторът не може да пази себе си при текущите настройки.");
      }
    }
    if (action.kind === "healer_protect" && privatePlayer.role === "bodyguard" && action.targetUserId === publicPlayer.userId) {
      throw new Error("Бодигардът трябва да пази друг играч.");
    }
    if (action.kind === "faction_kill" && privatePlayer.role === "vampire_hunter" && privatePlayer.vampireHunterDisarmed) {
      throw new Error("Убиецът на вампири изгуби умението си до края на играта.");
    }
    if (action.kind === "investigator_check" && privatePlayer.investigatorUsed) {
      throw new Error("Следователката вече използва своята проверка.");
    }
    if (action.kind === "blacksmith_sword") {
      if (privatePlayer.blacksmithUsed) {
        throw new Error("Ковачът вече изкова своя меч.");
      }
      if (action.receiverUserId === publicPlayer.userId) {
        throw new Error("Ковачът трябва да даде меча на друг играч.");
      }
      if (action.receiverUserId === action.targetUserId) {
        throw new Error("Получилият меч не може да го използва срещу себе си.");
      }
    }
    if (action.kind === "stray_cat_choose" && action.targetUserId === publicPlayer.userId) {
      throw new Error("Уличната котка трябва да избере друг играч.");
    }
    if (action.kind === "roleblock" && action.targetUserId === publicPlayer.userId) {
      throw new Error("Блокиращият трябва да избере друг играч.");
    }
    if (action.kind === "medium_contact") {
      this.validateMediumContact(action.targetUserId);
    }
    if (action.kind === "priest_bless") {
      this.validatePriestBlessing(publicPlayer, privatePlayer, action.targetUserId);
    }
    if (action.kind === "thief_steal") {
      this.validateThiefSteal(publicPlayer, privatePlayer, action.targetUserId);
    }
    if (action.kind === "cupid_link") {
      this.validateLoversLink(action.firstUserId, action.secondUserId);
    }
  }

  private validateNightActionTargetMembership(action: NightActionCommand) {
    if (action.kind === "skip") {
      return;
    }
    if (action.kind === "medium_contact") {
      this.validateMediumContact(action.targetUserId);
      return;
    }
    if (action.kind === "cupid_link") {
      this.validateLoversLink(action.firstUserId, action.secondUserId);
      return;
    }
    if (action.kind === "blacksmith_sword") {
      this.requireLivingActiveTarget(action.receiverUserId, "Получателят на меча");
      this.requireLivingActiveTarget(action.targetUserId, "Целта на меча");
      return;
    }

    this.requireLivingActiveTarget(action.targetUserId);
  }

  private requireLivingActiveTarget(targetUserId: string, label = "Целта") {
    const publicTarget = this.findPlayerByUserId(targetUserId);
    const privateTarget = this.privatePlayers.get(targetUserId);
    if (!publicTarget?.playing || !publicTarget.alive || !privateTarget?.alive) {
      throw new Error(`${label} не е жив активен играч.`);
    }
    if (!privateTarget.role) {
      throw new Error("Целта още няма раздадена роля.");
    }
    return { publicTarget, privateTarget: privateTarget as PrivatePlayerState & { role: RoleCode } };
  }

  private validateMediumContact(targetUserId: string) {
    const target = this.privatePlayers.get(targetUserId);
    const publicTarget = this.findPlayerByUserId(targetUserId);
    if (!target || !publicTarget?.playing || target.alive || publicTarget.alive) {
      throw new Error("Медиумът може да се свърже само с елиминиран играч.");
    }
    if (!target.role) {
      throw new Error("Няма записана роля за този играч.");
    }

    return { target: target as PrivatePlayerState & { role: RoleCode }, publicTarget };
  }

  private applyMediumContact(actor: PlayerPublicState, targetUserId: string) {
    const { target, publicTarget } = this.validateMediumContact(targetUserId);

    this.privateEvents.sendPrivateCheckResult(actor.userId, {
      targetUserId,
      role: target.role,
      messageBg: `${publicTarget.displayName} беше ${getRoleNameBg(target.role)}.`,
    });
    this.persistGameEvent("medium_contacted_dead", {
      actorId: actor.userId,
      targetId: targetUserId,
      visibility: "moderator",
    });
  }

  private validateThiefSteal(actor: PlayerPublicState, thief: PrivatePlayerState, targetUserId: string) {
    if (this.state.phase !== "first_night") {
      throw new Error("Крадецът може да краде само през първата нощ.");
    }
    if (actor.userId === targetUserId) {
      throw new Error("Крадецът не може да краде собствената си карта.");
    }
    if (thief.role !== "thief") {
      throw new Error("Само Крадецът може да краде карта.");
    }

    const target = this.getPrivatePlayer(targetUserId);
    const publicTarget = this.findPlayerByUserId(targetUserId);
    if (!publicTarget?.playing || !publicTarget.alive || !target.alive) {
      throw new Error("Крадецът може да краде само от жив активен играч.");
    }
    if (!target.role) {
      throw new Error("Целта още няма раздадена роля.");
    }

    return { target: target as PrivatePlayerState & { role: RoleCode }, publicTarget };
  }

  private applyThiefSteal(actor: PlayerPublicState, thief: PrivatePlayerState, targetUserId: string) {
    const { target, publicTarget } = this.validateThiefSteal(actor, thief, targetUserId);

    const stolenRole = target.role;
    thief.role = stolenRole;
    target.role = "ordinary_villager";
    if (stolenRole === "drunk") {
      if (target.drunkRealRole) {
        thief.drunkRealRole = target.drunkRealRole;
      } else {
        delete thief.drunkRealRole;
      }
    } else {
      delete thief.drunkRealRole;
    }
    delete target.drunkRealRole;
    if (
      this.config.mayorMode === "secret_role"
      && (stolenRole === "mayor" || stolenRole === "mafia_mayor")
    ) {
      thief.isMayor = target.isMayor === true;
      target.isMayor = false;
    }
    delete target.lastResolvedHealerTargetUserId;
    this.pendingNightActions.delete(targetUserId);

    const actorClient = this.playerPresence.getClient(actor.userId);
    const targetClient = this.playerPresence.getClient(targetUserId);
    if (actorClient) {
      this.privateEvents.sendPrivateRole(actorClient, actor.userId);
      this.sendNightActionCapabilities(actor.userId, actorClient);
    }
    if (targetClient) {
      this.privateEvents.sendPrivateRole(targetClient, targetUserId);
      this.sendNightActionCapabilities(targetUserId, targetClient);
      targetClient.send("system", {
        type: "system",
        messageBg: "Крадецът взе картата ти. Вече си Обикновен селянин.",
      } satisfies ServerEvent);
    }
    this.privateEvents.sendPrivateFactionRosters();
    this.privateEvents.sendNarratorSnapshotsToNarrators();
    this.persistGameEvent("thief_stole_role", {
      actorId: actor.userId,
      targetId: targetUserId,
      visibility: "moderator",
      payload: {
        stolenRole,
        targetBecame: "ordinary_villager",
      },
    });
  }

  private validatePriestBlessing(actor: PlayerPublicState, privatePlayer: PrivatePlayerState, targetUserId: string) {
    if (privatePlayer.priestBlessUsed) {
      throw new Error("Свещеникът вече е дал своята благословия.");
    }
    if (actor.userId === targetUserId) {
      throw new Error("Свещеникът не може да благослови себе си.");
    }

    const target = this.getPrivatePlayer(targetUserId);
    const publicTarget = this.findPlayerByUserId(targetUserId);
    if (!publicTarget?.playing || !publicTarget.alive || !target.alive) {
      throw new Error("Свещеникът може да благослови само жив активен играч.");
    }
    if (target.priestBlessed) {
      throw new Error("Този играч вече е благословен.");
    }

    return target;
  }

  private applyPriestBlessing(actor: PlayerPublicState, privatePlayer: PrivatePlayerState, targetUserId: string) {
    const target = this.validatePriestBlessing(actor, privatePlayer, targetUserId);

    privatePlayer.priestBlessUsed = true;
    target.priestBlessed = true;
    privatePlayer.priestBlessedTargetUserId = targetUserId;
    const client = this.playerPresence.getClient(targetUserId);
    if (client) {
      this.privateEvents.sendPrivateBlessing(client, targetUserId);
    }
    this.persistGameEvent("priest_blessed", {
      actorId: actor.userId,
      targetId: targetUserId,
      visibility: "moderator",
    });
  }

  private validateLoversLink(firstUserId: string, secondUserId: string) {
    if (firstUserId === secondUserId) {
      throw new Error("Купидон трябва да избере двама различни играчи.");
    }
    const first = this.getPrivatePlayer(firstUserId);
    const second = this.getPrivatePlayer(secondUserId);
    const firstPublic = this.findPlayerByUserId(firstUserId);
    const secondPublic = this.findPlayerByUserId(secondUserId);
    if (!firstPublic?.playing || !secondPublic?.playing) {
      throw new Error("Купидон може да избира само активни играчи.");
    }
    if (first.loverId || second.loverId) {
      throw new Error("Влюбените вече са избрани.");
    }


    return { first, second };
  }

  private linkLovers(actor: PlayerPublicState, firstUserId: string, secondUserId: string) {
    const { first, second } = this.validateLoversLink(firstUserId, secondUserId);

    first.loverId = secondUserId;
    second.loverId = firstUserId;
    this.privateEvents.sendPrivateLover(firstUserId, secondUserId);
    this.privateEvents.sendPrivateLover(secondUserId, firstUserId);
    this.persistGameEvent("lovers_linked", {
      actorId: actor.userId,
      visibility: "moderator",
      payload: { firstUserId, secondUserId },
    });
  }

  private pauseByNarrator(client: Client) {
    const player = this.getPublicPlayer(client);
    if (!player.host && !player.narrator) {
      throw new Error("Само Разказвачът или домакинът може да паузира.");
    }
    if (this.state.phase === "paused" || this.state.phase === "game_over") {
      throw new Error("Тази фаза не може да бъде паузирана.");
    }
    this.phaseStateMachine.pause({
      phase: this.currentPhase(),
      remainingMs: Math.max(0, this.state.phaseEndsAt - Date.now()),
    });
    this.addPublicEvent(`${player.displayName} паузира играта.`);
    this.auditNarratorAction(player, "narrator_pause", { fromPhase: this.state.phase });
    this.transitionTo("paused");
  }

  private advanceByNarrator(client: Client) {
    const player = this.getPublicPlayer(client);
    if (!player.host && !player.narrator) {
      throw new Error("Само Разказвачът или домакинът може да смени фазата.");
    }
    if (this.state.phase === "paused" && this.phaseStateMachine.getPausedSnapshot()) {
      this.resumePausedPhase(player);
      return;
    }

    this.auditNarratorAction(player, "narrator_advance", { fromPhase: this.state.phase });
    this.advancePhase();
  }

  private extendTimerByNarrator(client: Client, seconds: number) {
    const player = this.getPublicPlayer(client);
    if (!player.host && !player.narrator) {
      throw new Error("Само Разказвачът или домакинът може да удължи таймера.");
    }
    if (!this.state.phaseEndsAt || this.state.phase === "paused" || this.state.phase === "game_over") {
      throw new Error("В тази фаза няма активен таймер.");
    }

    const safeSeconds = Math.min(600, Math.max(10, Math.floor(seconds)));
    this.phaseStateMachine.clearTimer();
    this.state.phaseEndsAt += safeSeconds * 1000;
    this.scheduleCurrentPhaseTimer(Math.max(0, this.state.phaseEndsAt - Date.now()));
    this.addPublicEvent(`${player.displayName} удължи таймера с ${safeSeconds} секунди.`);
    this.auditNarratorAction(player, "narrator_extend_timer", {
      seconds: safeSeconds,
      phaseEndsAt: this.state.phaseEndsAt,
    });
  }

  private advancePhase() {
    if (isNightPhase(this.state.phase)) {
      this.resolveNightPhase();
      return;
    }

    if (this.config.mode === "mafia_sport") {
      if (this.state.phase === "day_announcement") {
        this.beginSportDaySpeeches();
        return;
      }
      if (this.state.phase === "day_discussion") {
        this.advanceSportDaySpeech();
        return;
      }
      if (this.state.phase === "nomination") {
        this.beginSportDefensesOrResolve();
        return;
      }
      if (this.state.phase === "defense") {
        this.advanceSportDefense();
        return;
      }
    }

    if (this.state.phase === "voting") {
      this.resolveVoting();
      return;
    }

    if (this.state.phase === "hunter_revenge") {
      this.pendingHunterRevengeUserId = undefined;
      if (this.queueMayorSuccessor([])) {
        return;
      }
      this.transitionTo("resolution");
      return;
    }

    if (this.state.phase === "mayor_successor") {
      this.pendingMayorSuccessor = false;
      this.transitionTo("resolution");
      return;
    }

    if (this.state.phase === "resolution") {
      const delayedDeaths = this.applyPendingVampireBites();
      if (delayedDeaths.length > 0) {
        if (this.queueHunterRevenge(delayedDeaths)) {
          return;
        }
        if (this.queueMayorSuccessor(delayedDeaths)) {
          return;
        }
      }

      const win = this.evaluateWin();
      if (win.winner) {
        this.state.winnerTeam = win.winner;
        this.state.winnerReasonBg = win.reasonBg ?? "";
        this.transitionTo("game_over");
        return;
      }
      this.state.round += 1;
    }

    const next = PHASE_FLOW[this.state.phase as GamePhase];
    if (next) {
      this.transitionTo(next);
    }
  }

  private transitionTo(phase: GamePhase) {
    const previousPhase = this.currentPhase();
    this.state.phase = phase;

    if (this.config.mode === "mafia_sport" && phase !== "paused") {
      if (phase !== "day_discussion") {
        this.state.currentSpeakerUserId = "";
      }
      if (phase !== "defense") {
        this.state.currentDefenseUserId = "";
      }
      if (phase !== "day_discussion" && phase !== "nomination" && phase !== "defense" && phase !== "voting") {
        this.clearSportDayFlow();
      }
    }

    if (phase !== "paused") {
      for (const player of this.state.players.values()) {
        player.actedThisPhase = false;
        if (phase !== "voting") {
          player.hasVoted = false;
        }
      }
    }
    if (phase !== "voting" && phase !== "paused") {
      this.state.voteTally.clear();
    }
    if (phase !== "paused") {
      if (phase !== "voting" || previousPhase !== "voting") {
        this.state.revoteEligibleUserIds.clear();
      }
    }
    if (isNightPhase(phase)) {
      this.currentWitchVictimByTeam.clear();
    }

    const duration = getPhaseDurationMs(this.config, phase);
    this.state.phaseEndsAt = duration > 0 ? Date.now() + duration : 0;
    this.addPublicEvent(`Фаза: ${phaseLabelBg(phase, this.config.mode)}.`);
    this.persistGameEvent("phase_change", {
      payload: {
        phase,
        phaseEndsAt: this.state.phaseEndsAt,
      },
    });

    if (phase === "night" && this.state.round === 2) {
      this.revealDrunkRoles();
    }
    if (isNightPhase(phase)) {
      this.sendNightActionCapabilitiesToActors();
    }

    if (phase === "game_over" && this.state.winnerTeam && !this.gameFinishedPersisted) {
      this.gameFinishedPersisted = true;
      GameRoom.recentEndings.unshift({
        code: this.state.code,
        winnerTeam: this.state.winnerTeam,
        winnerReasonBg: this.state.winnerReasonBg,
        endedAt: new Date().toISOString(),
        family: getGameFamily(this.config.mode),
      });
      if (GameRoom.recentEndings.length > GameRoom.MAX_RECENT_ENDINGS) {
        GameRoom.recentEndings.length = GameRoom.MAX_RECENT_ENDINGS;
      }
      const achievementUnlocks = this.evaluateAchievementUnlocks();
      this.sendAchievementUnlocks(achievementUnlocks);
      const finalWin = this.evaluateWin();
      const finalPlayers = this.buildFinalPlayerPersistenceRows(finalWin);
      const terminalAccepted = this.queuePersistence(async ({ persistence, ensureGame }) => {
        const gameId = await ensureGame();
        if (gameId) {
          await persistence.upsertPlayers(gameId, finalPlayers);
          await persistence.finishGame(gameId, {
            winnerTeam: this.state.winnerTeam as never,
          });
          for (const unlock of achievementUnlocks) {
            await persistence.recordAchievement(unlock.userId, unlock.achievementId, gameId);
          }
        }
      }, { priority: "critical", terminal: true, maxAttempts: 3 });
      if (!terminalAccepted && this.persistenceCoordinator.enabled) {
        console.error(
          "[game-persistence]",
          new Error(`[GameRoom ${this.state.code}] terminal game-over persistence task was rejected`),
        );
      }
    }

    this.scheduleCurrentPhaseTimer(duration);
  }

  private beginSportDaySpeeches() {
    this.clearSportDayFlow();
    this.sportSpeechOrder = [...this.state.players.values()]
      .filter((player) => this.isLivingActivePlayer(player.userId))
      .map((player) => player.userId);
    this.sportSpeechIndex = 0;
    const firstSpeakerUserId = this.sportSpeechOrder[0];
    if (!firstSpeakerUserId) {
      this.transitionTo("resolution");
      return;
    }

    this.state.currentSpeakerUserId = firstSpeakerUserId;
    this.transitionTo("day_discussion");
    this.announceSportTurn(
      "sport_speech_started",
      firstSpeakerUserId,
      `има думата за ${this.config.timers.playerSpeechSeconds} секунди`,
    );
  }

  private advanceSportDaySpeech() {
    for (let index = this.sportSpeechIndex + 1; index < this.sportSpeechOrder.length; index += 1) {
      const nextSpeakerUserId = this.sportSpeechOrder[index];
      if (!nextSpeakerUserId || !this.isLivingActivePlayer(nextSpeakerUserId)) {
        continue;
      }

      this.sportSpeechIndex = index;
      this.state.currentSpeakerUserId = nextSpeakerUserId;
      this.restartSportTurnTimer("day_discussion");
      this.announceSportTurn(
        "sport_speech_started",
        nextSpeakerUserId,
        `има думата за ${this.config.timers.playerSpeechSeconds} секунди`,
      );
      return;
    }

    this.state.currentSpeakerUserId = "";
    this.transitionTo("nomination");
  }

  private beginSportDefensesOrResolve() {
    this.sportDefenseOrder = [...this.sportNomineeIds()];
    this.sportDefenseIndex = 0;
    const firstDefenseUserId = this.sportDefenseOrder[0];
    if (!firstDefenseUserId) {
      this.addPublicEvent("Няма номинирани играчи. Денят приключва без гласуване.");
      this.transitionTo("resolution");
      return;
    }

    this.state.currentDefenseUserId = firstDefenseUserId;
    this.transitionTo("defense");
    this.announceSportTurn(
      "sport_defense_started",
      firstDefenseUserId,
      `има ${this.config.timers.playerSpeechSeconds} секунди за защита`,
    );
  }

  private advanceSportDefense() {
    for (let index = this.sportDefenseIndex + 1; index < this.sportDefenseOrder.length; index += 1) {
      const nextDefenseUserId = this.sportDefenseOrder[index];
      if (!nextDefenseUserId || !this.isLivingActivePlayer(nextDefenseUserId)) {
        continue;
      }

      this.sportDefenseIndex = index;
      this.state.currentDefenseUserId = nextDefenseUserId;
      this.restartSportTurnTimer("defense");
      this.announceSportTurn(
        "sport_defense_started",
        nextDefenseUserId,
        `има ${this.config.timers.playerSpeechSeconds} секунди за защита`,
      );
      return;
    }

    this.state.currentDefenseUserId = "";
    this.transitionTo("voting");
  }

  private restartSportTurnTimer(phase: "day_discussion" | "defense") {
    const duration = getPhaseDurationMs(this.config, phase);
    this.state.phaseEndsAt = Date.now() + duration;
    this.scheduleCurrentPhaseTimer(duration);
  }

  private announceSportTurn(type: "sport_speech_started" | "sport_defense_started", userId: string, copy: string) {
    const player = this.findPlayerByUserId(userId);
    if (!player) {
      return;
    }
    this.addPublicEvent(`${player.displayName} ${copy}.`);
    this.persistGameEvent(type, {
      actorId: userId,
      visibility: "public",
      payload: { phaseEndsAt: this.state.phaseEndsAt },
    });
  }

  private sportNomineeIds() {
    const nomineeIds = new Set<string>();
    for (const nomination of this.state.nominations) {
      if (this.isLivingActivePlayer(nomination.targetUserId)) {
        nomineeIds.add(nomination.targetUserId);
      }
    }
    return nomineeIds;
  }

  private isLivingActivePlayer(userId: string) {
    const publicPlayer = this.findPlayerByUserId(userId);
    const privatePlayer = this.privatePlayers.get(userId);
    return Boolean(publicPlayer?.playing && publicPlayer.alive && privatePlayer?.alive);
  }

  private clearSportDayFlow() {
    this.sportSpeechOrder = [];
    this.sportSpeechIndex = -1;
    this.sportDefenseOrder = [];
    this.sportDefenseIndex = -1;
    this.state.currentSpeakerUserId = "";
    this.state.currentDefenseUserId = "";
    this.state.nominations.clear();
  }

  private resumePausedPhase(player: PlayerPublicState) {
    const snapshot = this.phaseStateMachine.resume();
    if (!snapshot) {
      return;
    }
    this.state.phase = snapshot.phase;
    this.state.phaseEndsAt = snapshot.remainingMs > 0 ? Date.now() + snapshot.remainingMs : 0;
    this.addPublicEvent(`${player.displayName} продължи играта от фаза: ${phaseLabelBg(snapshot.phase, this.config.mode)}.`);
    this.persistGameEvent("phase_change", {
      payload: {
        phase: snapshot.phase,
        phaseEndsAt: this.state.phaseEndsAt,
        resumedFromPause: true,
      },
    });
    this.auditNarratorAction(player, "narrator_resume", { resumedPhase: snapshot.phase });
    this.scheduleCurrentPhaseTimer(snapshot.remainingMs);
    if (isNightPhase(snapshot.phase)) {
      this.sendNightActionCapabilitiesToActors();
    }
  }

  private scheduleCurrentPhaseTimer(durationMs: number) {
    this.phaseStateMachine.setPhase(this.currentPhase(), durationMs);
  }

  private getPrivatePlayersForNight() {
    return [...this.privatePlayers.values()]
      .filter((player): player is PrivatePlayerState & { role: RoleCode } => Boolean(player.role))
      .map((player) => ({
        userId: player.userId,
        role: player.role,
        alive: player.alive,
        ...(player.priestBlessed ? { priestBlessed: true } : {}),
      }));
  }

  private applyQueuedImmediateNightActions(
    actions: SubmittedNightAction[],
    blockedActorIds: Set<string>,
    thievesOnly: boolean,
  ) {
    for (const submission of actions) {
      const isThiefAction = submission.action.kind === "thief_steal";
      if (isThiefAction !== thievesOnly || blockedActorIds.has(submission.actorUserId)) {
        continue;
      }

      const actor = this.findPlayerByUserId(submission.actorUserId);
      const privatePlayer = this.privatePlayers.get(submission.actorUserId);
      if (!actor || !privatePlayer) {
        continue;
      }

      const action = submission.action;
      if (action.kind === "thief_steal") {
        this.applyThiefSteal(actor, privatePlayer, action.targetUserId);
      } else if (action.kind === "medium_contact") {
        this.applyMediumContact(actor, action.targetUserId);
      } else if (action.kind === "priest_bless") {
        this.applyPriestBlessing(actor, privatePlayer, action.targetUserId);
      } else if (action.kind === "cupid_link") {
        this.linkLovers(actor, action.firstUserId, action.secondUserId);
      }
    }
  }

  private resolveNightPhase() {
    const initialActions = this.getSubmittedNightActions();
    const initialPlayers = this.getPrivatePlayersForNight();
    const initiallyBlockedActorIds = getRoleblockedActorIds(initialPlayers, initialActions);
    this.applyQueuedImmediateNightActions(initialActions, initiallyBlockedActorIds, true);

    const submittedActions = this.getSubmittedNightActions();
    const players = this.getPrivatePlayersForNight();
    const blockedActorIds = getRoleblockedActorIds(players, submittedActions);
    this.applyQueuedImmediateNightActions(submittedActions, blockedActorIds, false);

    const resolutionPlayers = this.getPrivatePlayersForNight();
    const resolution = resolveNight(resolutionPlayers, submittedActions);
    this.reportPersistentPriestProtection(resolution.protectedByPriest);
    this.reportPreventedDeaths(resolution.preventedDeaths);
    this.rememberDelayedVampireBites(resolution.delayedDeaths);
    this.sendPrivateNightMessages(resolution.privateMessages);
    const effectiveActions = submittedActions.filter(
      (submission) => !blockedActorIds.has(submission.actorUserId) || submission.action.kind === "roleblock",
    );
    this.sendInsomniacResults(effectiveActions);
    this.markNightActionConsumables(effectiveActions, resolution.deaths);
    this.pendingNightActions.clear();

    for (const check of resolution.checks) {
      const exactRole =
        !check.coveredByLawyer &&
        this.config.commissionerResultMode === "exact_role" &&
        this.isCommissionerLike(check.actorUserId)
          ? this.privatePlayers.get(check.targetUserId)?.role
          : undefined;
      this.privateEvents.sendPrivateCheckResult(check.actorUserId, {
        targetUserId: check.targetUserId,
        ...(check.targetUserIds ? { targetUserIds: check.targetUserIds } : {}),
        ...(exactRole ? { role: exactRole } : check.role ? { role: check.role } : {}),
        ...(typeof check.isEvil === "boolean" ? { isEvil: check.isEvil } : {}),
        ...(typeof check.isCommissioner === "boolean" ? { isCommissioner: check.isCommissioner } : {}),
        ...(check.messageBg ? { messageBg: check.messageBg } : {}),
      });
    }

    const deaths = this.applyDeaths(resolution.deaths);
    if (deaths.length === 0) {
      const peaceMessage = this.state.phase === "first_night"
        ? "Първата нощ премина мирно. Никой не пострада."
        : "Нощта премина без жертви. Площадът се събужда невредим.";
      this.addPublicEvent(peaceMessage);
    }
    if (this.queueHunterRevenge(deaths)) {
      return;
    }
    if (this.queueMayorSuccessor(deaths)) {
      return;
    }

    const win = this.evaluateWin();
    if (win.winner) {
      this.state.winnerTeam = win.winner;
      this.state.winnerReasonBg = win.reasonBg ?? "";
      this.transitionTo("game_over");
      return;
    }

    this.transitionTo("day_announcement");
  }

  private rememberDelayedVampireBites(deaths: Array<{ userId: string; causeBg: string }>) {
    for (const death of deaths) {
      this.pendingVampireBites.set(death.userId, {
        round: this.state.round,
        causeBg: death.causeBg,
      });
      this.persistGameEvent("vampire_bite_delayed", {
        targetId: death.userId,
        visibility: "moderator",
        payload: { resolvesAtRound: this.state.round },
      });
    }
  }

  private applyPendingVampireBites() {
    const deaths: Array<{ userId: string; causeBg: string }> = [];
    for (const [userId, bite] of [...this.pendingVampireBites.entries()]) {
      if (bite.round > this.state.round) {
        continue;
      }
      this.pendingVampireBites.delete(userId);
      const privatePlayer = this.privatePlayers.get(userId);
      const publicPlayer = this.findPlayerByUserId(userId);
      if (!privatePlayer?.alive || !publicPlayer?.alive) {
        continue;
      }
      deaths.push({ userId, causeBg: bite.causeBg });
    }

    if (deaths.length === 0) {
      return [];
    }

    this.addPublicEvent("Вампирско ухапване застигна жертвата в края на деня.");
    return this.applyDeaths(deaths);
  }

  private reportPreventedDeaths(events: Array<{ userId: string; reasonBg: string; public?: boolean }>) {
    const uniqueMessages = new Set<string>();
    for (const event of events) {
      if (event.public !== false) {
        uniqueMessages.add(event.reasonBg);
      }
      this.persistGameEvent("night_death_prevented", {
        targetId: event.userId,
        visibility: "moderator",
        payload: { reasonBg: event.reasonBg },
      });
    }
    for (const message of uniqueMessages) {
      this.addPublicEvent(message);
    }
  }

  private reportPersistentPriestProtection(userIds: string[]) {
    for (const userId of userIds) {
      this.addPublicEvent("Благословия спря нощна смърт.");
      this.persistGameEvent("priest_blessing_protected", {
        visibility: "public",
      });
      this.persistGameEvent("priest_blessing_protected_target", {
        targetId: userId,
        visibility: "moderator",
      });
    }
  }

  private sendPrivateNightMessages(messages: Array<{ targetUserId: string; messageBg: string }>) {
    for (const message of messages) {
      const client = this.playerPresence.getClient(message.targetUserId);
      if (client) {
        client.send("system", {
          type: "system",
          messageBg: message.messageBg,
        } satisfies ServerEvent);
      }
    }
  }

  private sendInsomniacResults(actions: SubmittedNightAction[]) {
    const activeNeighborIds = new Set(
      actions
        .filter((submission) => submission.action.kind !== "skip")
        .map((submission) => submission.actorUserId),
    );
    const living = [...this.privatePlayers.values()]
      .filter((player): player is PrivatePlayerState & { role: RoleCode } => Boolean(player.role && player.alive));

    for (const player of living) {
      if (player.role !== "insomniac") {
        continue;
      }
      const neighbors = this.getAdjacentLivingPlayers(player.userId, living);
      const someoneMoved = neighbors.some((neighbor) => activeNeighborIds.has(neighbor.userId));
      this.privateEvents.sendPrivateCheckResult(player.userId, {
        targetUserId: player.userId,
        targetUserIds: neighbors.map((neighbor) => neighbor.userId),
        messageBg: someoneMoved
          ? "Неспящата усети движение до себе си: поне един от двамата съседни играчи действа тази нощ."
          : "Неспящата не усети движение до себе си тази нощ.",
      });
    }
  }

  private resolveVoting() {
    const voteCounts = new Map<string, number>();
    let mayorVoteTarget: string | undefined;

    for (const privatePlayer of this.privatePlayers.values()) {
      if (!privatePlayer.alive || !privatePlayer.lastVoteTarget) {
        continue;
      }
      const publicPlayer = this.findPlayerByUserId(privatePlayer.userId);
      voteCounts.set(privatePlayer.lastVoteTarget, (voteCounts.get(privatePlayer.lastVoteTarget) ?? 0) + 1);
      if (privatePlayer.isMayor || publicPlayer?.mayor) {
        mayorVoteTarget = privatePlayer.lastVoteTarget;
      }
      delete privatePlayer.lastVoteTarget;
    }

    let ranked = [...voteCounts.entries()].sort((a, b) => b[1] - a[1]);
    let [targetUserId, topVotes] = ranked[0] ?? [];
    let tied = ranked.filter(([, count]) => count === topVotes);
    let mayorTieBreakerApplied = false;

    if (tied.length > 1 && mayorVoteTarget && tied.some(([userId]) => userId === mayorVoteTarget)) {
      voteCounts.set(mayorVoteTarget, (voteCounts.get(mayorVoteTarget) ?? 0) + 1);
      mayorTieBreakerApplied = true;
      ranked = [...voteCounts.entries()].sort((a, b) => b[1] - a[1]);
      [targetUserId, topVotes] = ranked[0] ?? [];
      tied = ranked.filter(([, count]) => count === topVotes);
    }

    const totalVotes = ranked.reduce((sum, [, count]) => sum + count, 0);
    this.persistGameEvent("vote_tally", {
      visibility: "moderator",
      payload: {
        tally: ranked.map(([userId, count]) => ({ userId, count })),
        totalVotes,
        livingCount: [...this.privatePlayers.values()].filter((p) => p.alive).length,
        mayorTieBreakerApplied,
      },
    });

    const livingCount = [...this.privatePlayers.values()].filter((p) => p.alive).length;
    if (targetUserId && tied.length === 1 && this.config.majorityMode === "absolute" && (topVotes ?? 0) <= livingCount / 2) {
      this.addPublicEvent("Няма абсолютно мнозинство — никой не е елиминиран.");
      this.transitionTo("resolution");
      return;
    }

    if (targetUserId && tied.length === 1) {
      const privatePlayer = this.privatePlayers.get(targetUserId);
      const publicPlayer = this.findPlayerByUserId(targetUserId);
      if (privatePlayer && publicPlayer) {
        if (this.guardDogBlocksMayorElimination(targetUserId)) {
          this.addPublicEvent("Кучето пазач спря елиминирането на Кмета.");
          this.persistGameEvent("guard_dog_protected_mayor", {
            targetId: targetUserId,
            visibility: "public",
          });
          this.transitionTo("resolution");
          return;
        }
        const role = privatePlayer.role ? ` (${getRoleNameBg(privatePlayer.role)})` : "";
        const deaths = this.applyDeaths([
          {
            userId: targetUserId,
            causeBg: `Елиминиран чрез дневно гласуване${this.config.revealRolesOnDeath ? role : ""}.`,
          },
        ]);
        if (privatePlayer.role === "jester") {
          this.personalWinnerUserIds.add(targetUserId);
          this.addPublicEvent(`${publicPlayer.displayName} беше Шут и постигна лична победа.`);
          this.persistGameEvent("jester_personal_win", {
            targetId: targetUserId,
            visibility: "public",
          });
          this.sendAchievementUnlocks([{ userId: targetUserId, achievementId: "jester_win" }]);
        }
        if (this.queueHunterRevenge(deaths)) {
          return;
        }
        if (this.queueMayorSuccessor(deaths)) {
          return;
        }
      }
    } else if (totalVotes === 0) {
      this.addPublicEvent("Никой не гласува — площадът замълча.");
    } else if (tied.length > 1) {
      const tiedNames = tied
        .map(([userId]) => this.findPlayerByUserId(userId)?.displayName)
        .filter((name): name is string => Boolean(name))
        .join(", ");
      if (this.config.tieBreaker === "revote") {
        this.addPublicEvent(`Равенство в гласовете (${tiedNames}). Следва прегласуване.`);
        for (const player of this.state.players.values()) {
          player.hasVoted = false;
        }
        this.state.voteTally.clear();
        this.state.revoteEligibleUserIds.clear();
        for (const [userId] of tied) {
          this.state.revoteEligibleUserIds.push(userId);
        }
        this.transitionTo("voting");
        return;
      }
      this.addPublicEvent(`Равенство в гласовете (${tiedNames}). Никой не е елиминиран.`);
    } else {
      this.addPublicEvent("Гласуването завърши без елиминация.");
    }

    this.transitionTo("resolution");
  }

  private applyDeaths(deaths: Array<{ userId: string; causeBg: string }>) {
    const applied: Array<{ userId: string; role?: RoleCode; causeBg: string; wasMayor?: boolean }> = [];
    const queue = [...deaths];
    const seen = new Set<string>();

    while (queue.length > 0) {
      const death = queue.shift();
      if (!death || seen.has(death.userId)) {
        continue;
      }
      seen.add(death.userId);

      const privatePlayer = this.privatePlayers.get(death.userId);
      const publicPlayer = this.findPlayerByUserId(death.userId);
      if (!privatePlayer?.alive || !publicPlayer?.alive) {
        continue;
      }

      privatePlayer.alive = false;
      privatePlayer.deathRound = this.state.round;
      privatePlayer.deathCause = death.causeBg;
      publicPlayer.alive = false;
      const wasPublicMayor = publicPlayer.mayor;
      publicPlayer.mayor = false;
      privatePlayer.isMayor = false;
      if (this.config.revealRolesOnDeath && privatePlayer.role) {
        publicPlayer.revealedRole = privatePlayer.role;
      }
      applied.push({
        userId: death.userId,
        causeBg: death.causeBg,
        ...(wasPublicMayor ? { wasMayor: true } : {}),
        ...(privatePlayer.role ? { role: privatePlayer.role } : {}),
      });
      this.addPublicEvent(`${publicPlayer.displayName}: ${death.causeBg}`);
      this.persistGameEvent("death", {
        targetId: death.userId,
        payload: {
          causeBg: death.causeBg,
          revealRole: this.config.revealRolesOnDeath ? privatePlayer.role : null,
        },
      });

      if (privatePlayer.loverId) {
        const lover = this.privatePlayers.get(privatePlayer.loverId);
        if (lover?.alive) {
          queue.push({ userId: privatePlayer.loverId, causeBg: "Умря от разбито сърце." });
        }
      }
    }

    return applied;
  }

  private queueHunterRevenge(deaths: Array<{ userId: string; role?: RoleCode; wasMayor?: boolean }>) {
    // If a mayor died in this resolution cycle, remember it so we still queue
    // mayor_successor after hunter_revenge resolves.
    if (this.config.mayorEnabled && deaths.some((death) => death.wasMayor)) {
      this.pendingMayorSuccessor = true;
    }

    const hunterDeath = deaths.find((death) => death.role === "hunter");
    if (!hunterDeath) {
      return false;
    }

    this.pendingHunterRevengeUserId = hunterDeath.userId;
    this.transitionTo("hunter_revenge");
    return true;
  }

  private queueMayorSuccessor(deaths: Array<{ wasMayor?: boolean }>) {
    if (!this.config.mayorEnabled) {
      return false;
    }
    if (deaths.some((death) => death.wasMayor)) {
      this.pendingMayorSuccessor = true;
    }
    if (!this.pendingMayorSuccessor) {
      return false;
    }
    const hasLivingPlayers = [...this.state.players.values()].some((player) => player.playing && player.alive);
    if (!hasLivingPlayers) {
      this.pendingMayorSuccessor = false;
      return false;
    }

    this.transitionTo("mayor_successor");
    return true;
  }

  private markNightActionConsumables(
    actions: SubmittedNightAction[],
    resolvedDeaths: Array<{ userId: string; causeBg: string }>,
  ) {
    for (const submission of actions) {
      const privatePlayer = this.privatePlayers.get(submission.actorUserId);
      if (!privatePlayer) {
        continue;
      }
      if (submission.action.kind === "witch_heal") {
        privatePlayer.witchHealUsed = true;
      }
      if (submission.action.kind === "witch_poison") {
        privatePlayer.witchPoisonUsed = true;
      }
      if (submission.action.kind === "blacksmith_sword") {
        privatePlayer.blacksmithUsed = true;
      }
      if (submission.action.kind === "investigator_check") {
        privatePlayer.investigatorUsed = true;
      }
      if (submission.action.kind === "healer_protect" && privatePlayer.role === "healer") {
        privatePlayer.lastResolvedHealerTargetUserId = submission.action.targetUserId;
      }
      if (submission.action.kind === "faction_kill" && privatePlayer.role === "vampire_hunter") {
        const targetUserId = submission.action.targetUserId;
        const target = this.privatePlayers.get(targetUserId);
        const hunterKilledTarget = resolvedDeaths.some(
          (death) =>
            death.userId === targetUserId &&
            death.causeBg === "Повален от Убиеца на вампири.",
        );
        if (
          hunterKilledTarget &&
          target?.role &&
          getRoleTeam(target.role) !== "werewolves" &&
          getRoleTeam(target.role) !== "vampires"
        ) {
          privatePlayer.vampireHunterDisarmed = true;
          const client = this.playerPresence.getClient(submission.actorUserId);
          if (client) {
            client.send("system", {
              type: "system",
              messageBg: "Уби невинен. Умението на Убиеца на вампири е изгубено до края на играта.",
            } satisfies ServerEvent);
          }
        }
      }
    }
  }

  private evaluateWin() {
    return evaluateWinCondition(
      [...this.privatePlayers.values()]
        .filter((player): player is PrivatePlayerState & { role: RoleCode } => Boolean(player.role))
        .map((player) => ({
          playerId: player.userId,
          role: player.role,
          alive: player.alive,
          ...(player.loverId ? { loverId: player.loverId } : {}),
          ...(this.personalWinnerUserIds.has(player.userId) ? { personalWin: true } : {}),
        })),
    );
  }

  private buildFinalPlayerPersistenceRows(win: Pick<WinResult, "winnerPlayerIds" | "personalWinnerPlayerIds">) {
    const winnerUserIds = new Set([...win.winnerPlayerIds, ...win.personalWinnerPlayerIds]);
    return [...this.privatePlayers.values()]
      .filter((player): player is PrivatePlayerState & { role: RoleCode } => Boolean(player.role))
      .map((player): PersistPlayerInput => ({
        userId: player.userId,
        displayName: this.findPlayerByUserId(player.userId)?.displayName ?? player.userId,
        role: player.role,
        isAlive: player.alive,
        isLover: Boolean(player.loverId),
        loverUserId: player.loverId ?? null,
        won: winnerUserIds.has(player.userId),
        deathRound: player.deathRound ?? null,
        deathCause: player.deathCause ?? null,
      }));
  }

  private revealDrunkRoles() {
    for (const privatePlayer of this.privatePlayers.values()) {
      if (!privatePlayer.alive || privatePlayer.role !== "drunk" || !privatePlayer.drunkRealRole) {
        continue;
      }
      const newRole = privatePlayer.drunkRealRole;
      privatePlayer.role = newRole;
      delete privatePlayer.drunkRealRole;
      const client = this.playerPresence.getClient(privatePlayer.userId);
      if (client) {
        this.privateEvents.sendPrivateRole(client, privatePlayer.userId);
        client.send("system", {
          type: "system",
          messageBg: `Пияницата изтрезня. Истинската ти роля вече е ${getRoleNameBg(newRole)}.`,
        } satisfies ServerEvent);
      }
      this.persistGameEvent("drunk_role_revealed", {
        actorId: privatePlayer.userId,
        visibility: "moderator",
        payload: { role: newRole },
      });
    }
    this.privateEvents.sendPrivateFactionRosters();
    this.privateEvents.sendNarratorSnapshotsToNarrators();
  }

  private addPublicEvent(messageBg: string) {
    const event = new PublicEventState();
    event.id = crypto.randomUUID();
    event.round = this.state.round;
    event.phase = this.state.phase;
    event.type = "system";
    event.messageBg = messageBg;
    event.createdAt = Date.now();
    this.state.publicEvents.push(event);
    while (this.state.publicEvents.length > MAX_PUBLIC_EVENTS) {
      this.state.publicEvents.shift();
    }
  }

  private persistGameEvent(type: string, event: Omit<PersistEventInput, "round" | "phase" | "type"> = {}) {
    const participantUserIds = [...new Set([
      ...[...this.state.players.values()].map((player) => player.userId),
      ...(event.participantUserIds ?? []),
    ])];
    const eventSnapshot: PersistEventInput = structuredClone({
      round: this.state.round,
      phase: this.currentPhase(),
      type,
      ...event,
      occurredAt: event.occurredAt ?? this.nextPersistedEventTime(),
      payload: event.payload ?? {},
      participantUserIds,
    });
    this.achievementBroadcaster.recordEvent({
      round: eventSnapshot.round,
      phase: eventSnapshot.phase,
      type,
      actorId: eventSnapshot.actorId ?? null,
      targetId: eventSnapshot.targetId ?? null,
      payload: eventSnapshot.payload ?? {},
    });

    this.queuePersistence(async ({ persistence, ensureGame, idempotencyKeys }) => {
      const gameId = await ensureGame();
      if (!gameId) {
        return;
      }

      await persistence.recordEvent(gameId, {
        ...eventSnapshot,
        ...(idempotencyKeys ? { idempotencyKey: idempotencyKeys.event(type) } : {}),
      });
    }, { priority: persistencePriorityForEvent(type) });
  }

  private nextPersistedEventTime() {
    const next = Math.max(Date.now(), this.lastPersistedEventAtMs + 1);
    this.lastPersistedEventAtMs = next;
    return new Date(next);
  }

  private evaluateAchievementUnlocks() {
    return this.achievementBroadcaster.evaluateUnlocks({
      winnerTeam: this.state.winnerTeam,
      players: [...this.privatePlayers.values()].map((player) => ({
        userId: player.userId,
        ...(player.role ? { role: player.role } : {}),
        alive: player.alive,
      })),
    });

  }

  private sendAchievementUnlocks(unlocks: AchievementUnlock[]) {
    this.achievementBroadcaster.announce(unlocks, (userId, achievementIds) => {
      const client = this.playerPresence.getClient(userId);
      client?.send("achievements_unlocked", {
        type: "achievements_unlocked",
        achievementIds,
      } satisfies ServerEvent);
    });
  }

  private auditNarratorAction(player: PlayerPublicState, type: string, payload: Record<string, unknown> = {}) {
    this.persistGameEvent(type, {
      actorId: player.userId,
      visibility: "moderator",
      payload: {
        narratorMode: this.config.narratorMode,
        ...payload,
      },
    });
  }

  private currentPhase(): GamePhase {
    return this.state.phase as GamePhase;
  }

  private queuePersistence(
    task: (api: RoomPersistenceTaskApi) => Promise<void>,
    options: PersistenceQueueOptions = {},
  ): boolean {
    const context = this.hostUserId
      ? { code: this.state.code, hostUserId: this.hostUserId, config: this.config, roomIdempotencyKey: this.roomId }
      : { code: this.state.code, config: this.config, roomIdempotencyKey: this.roomId };
    return this.persistenceCoordinator.queue(
      context,
      task,
      options,
    );
  }

  private sendSafeError(client: Client, messageBg: string) {
    client.send("safe_error", { type: "safe_error", messageBg } satisfies ServerEvent);
  }

  private syncPublicConfig() {
    this.state.mode = this.config.mode;
    this.state.playerCount = this.config.playerCount;
    this.state.narratorMode = this.config.narratorMode;
    this.state.communicationMode = this.config.communicationMode;
    this.state.tempoProfile = this.config.tempoProfile;
    this.state.dayDiscussionSeconds = this.config.timers.dayDiscussionSeconds;
    this.state.playerSpeechSeconds = this.config.timers.playerSpeechSeconds;
    this.state.voteSeconds = this.config.timers.voteSeconds;
    this.state.revealRolesOnDeath = this.config.revealRolesOnDeath;
    this.state.loversEnabled = this.config.loversEnabled;
    this.state.allowSkipVote = this.config.allowSkipVote;
    this.state.majorityMode = this.config.majorityMode;
    this.state.narratorVoice = this.config.narratorVoice;
    this.state.rulesetVersion = this.config.rulesetVersion;

    this.state.roleCounts.splice(0, this.state.roleCounts.length);
    for (const [role, count] of Object.entries(this.config.roles)) {
      const roleCount = new RoleCountState();
      roleCount.role = role;
      roleCount.count = count ?? 0;
      this.state.roleCounts.push(roleCount);
    }
  }

  private enforceRuntimeRoleAvailability() {
    if (this.config.narratorMode === "full_human") {
      return;
    }

    const fallbackRole: RoleCode = getGameFamily(this.config.mode) === "mafia" ? "civilian" : "ordinary_villager";
    let fallbackCount = this.config.roles[fallbackRole] ?? 0;

    for (const [role, count] of Object.entries(this.config.roles) as [RoleCode, number | undefined][]) {
      if ((count ?? 0) > 0 && getRoleRuntimeStatus(role) === "manual_only") {
        fallbackCount += count ?? 0;
        delete this.config.roles[role];
      }
    }

    if (fallbackCount > 0) {
      this.config.roles[fallbackRole] = fallbackCount;
    }
  }

  private assertCurrentRoleCompatibility() {
    assertRoleCompatibilityForMode(this.config.mode, this.config.playerCount, this.config.roles, {
      mayorMode: this.config.mayorMode,
      werewolfVariant: this.config.werewolfVariant,
      promoRolesEnabled: this.config.promoRolesEnabled,
    });
  }

  private syncVoteTally() {
    this.state.voteTally.clear();
    const counts = new Map<string, { count: number; hasMayorVote: boolean }>();

    for (const privatePlayer of this.privatePlayers.values()) {
      if (!privatePlayer.alive || !privatePlayer.lastVoteTarget) {
        continue;
      }

      const publicPlayer = this.findPlayerByUserId(privatePlayer.userId);
      const current = counts.get(privatePlayer.lastVoteTarget) ?? { count: 0, hasMayorVote: false };
      current.count += 1;
      current.hasMayorVote = current.hasMayorVote || Boolean(publicPlayer?.mayor);
      counts.set(privatePlayer.lastVoteTarget, current);
    }

    const sorted = [...counts.entries()].sort((left, right) => right[1].count - left[1].count);
    for (const [targetUserId, value] of sorted) {
      const target = this.findPlayerByUserId(targetUserId);
      const item = new VoteTallyState();
      item.targetUserId = targetUserId;
      item.targetName = target?.displayName ?? "неизвестен играч";
      item.count = value.count;
      item.hasMayorVote = value.hasMayorVote;
      this.state.voteTally.push(item);
    }
  }

  private getPublicPlayer(client: Client) {
    const auth = getAuth(client);
    const player = auth ? this.findPlayerByUserId(auth.userId) : undefined;
    if (!player) {
      throw new Error("Играчът не е в тази стая.");
    }
    return player;
  }

  private getPrivatePlayer(userId: string) {
    const player = this.privatePlayers.get(userId);
    if (!player) {
      throw new Error("Играчът не е в тази стая.");
    }
    return player;
  }

  private findPlayerByUserId(userId: string) {
    return [...this.state.players.values()].find((player) => player.userId === userId);
  }

  private findPlayerEntryByUserId(userId: string): [string, PlayerPublicState] | undefined {
    for (const entry of this.state.players.entries()) {
      if (entry[1].userId === userId) {
        return entry;
      }
    }
    return undefined;
  }

  private hasHostPlayer() {
    return [...this.state.players.values()].some((player) => player.host);
  }

  private ensureHostAssigned() {
    const host = [...this.state.players.values()].find((player) => player.host);
    if (host) {
      this.hostUserId = host.userId;
      return;
    }
    this.assignHostSuccessor("");
  }

  private assignHostSuccessor(excludedUserId: string) {
    const successor = [...this.state.players.values()].find(
      (player) =>
        player.userId !== excludedUserId &&
        player.connected &&
        (player.playing || player.narrator),
    );
    this.hostUserId = successor?.userId;
    if (!successor) {
      return;
    }

    successor.host = true;
    this.addPublicEvent(`${successor.displayName} пое ролята на домакин.`);
    this.persistGameEvent("host_succeeded", {
      actorId: successor.userId,
      participantUserIds: [successor.userId, excludedUserId].filter(Boolean),
      visibility: "public",
      payload: { previousHostUserId: excludedUserId },
    });
  }

  private hasAvailablePlayerSlot(excludeUserId?: string) {
    const playingCount = [...this.state.players.values()].filter(
      (player) => player.playing && player.userId !== excludeUserId,
    ).length;
    return playingCount < this.config.maxPlayers;
  }

  private isFactionKillAllowed(privatePlayer: PrivatePlayerState) {
    if (this.state.phase === "first_night" && !this.config.firstNightKill) {
      return false;
    }
    return !privatePlayer.role || getRoleTeam(privatePlayer.role) !== "mafia" || this.config.mafiaNightKill;
  }

  private getAdjacentLivingPlayers(userId: string, living: Array<PrivatePlayerState & { role: RoleCode }>) {
    if (living.length <= 1) {
      return [];
    }
    const index = living.findIndex((player) => player.userId === userId);
    if (index === -1) {
      return [];
    }
    const previous = living[(index - 1 + living.length) % living.length];
    const next = living[(index + 1) % living.length];
    return [previous, next].filter((player): player is PrivatePlayerState & { role: RoleCode } =>
      Boolean(player && player.userId !== userId),
    );
  }

  private guardDogBlocksMayorElimination(targetUserId: string) {
    const target = this.findPlayerByUserId(targetUserId);
    if (!target?.mayor) {
      return false;
    }
    return [...this.privatePlayers.values()].some((player) => player.alive && player.role === "guard_dog");
  }

  private isCommissionerLike(userId: string) {
    const role = this.privatePlayers.get(userId)?.role;
    return role === "commissioner" || role === "detective";
  }

  private clientsFor(predicate: (player: PlayerPublicState) => boolean) {
    const clients: Client[] = [];
    for (const player of this.state.players.values()) {
      if (!predicate(player)) {
        continue;
      }
      const client = this.playerPresence.getClient(player.userId);
      if (client) {
        clients.push(client);
      }
    }
    return clients;
  }
}

function getGameTokenSecret() {
  const secret =
    process.env.GAME_TOKEN_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    "dev-only-secret-replace-before-production-32-chars";

  if (process.env.NODE_ENV === "production" && (!process.env.GAME_TOKEN_SECRET || !isProductionSecret(secret))) {
    throw new Error("GAME_TOKEN_SECRET трябва да е реална production тайна от поне 32 символа.");
  }

  return secret;
}

export function getGameRuntimeStats() {
  return GameRoom.getRuntimeStats();
}

function isProductionSecret(secret: string) {
  return secret.length >= 32 && !/dev-only|replace|change-me|placeholder/i.test(secret);
}
