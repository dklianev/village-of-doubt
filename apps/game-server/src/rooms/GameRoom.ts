import { Client, Room } from "colyseus";
import * as Sentry from "@sentry/node";
import {
  assignRoles,
  ACHIEVEMENTS,
  createGameConfigFromOptions,
  evaluateAchievementUnlocks,
  evaluateWinCondition,
  getRoleNameBg,
  getRoleTeam,
  phaseLabelBg,
  type ClientCommand,
  type GameConfig,
  type GameMode,
  type GamePhase,
  type JoinRoomOptions,
  type NightActionCommand,
  type RoleCode,
  type ServerEvent,
  type CreateRoomOptions,
  type ChatChannel,
  type AchievementEventLike,
} from "@werewolf/shared";
import { resolveNight, type SubmittedNightAction } from "../game-logic/night-resolver.js";
import {
  ChatMessageState,
  GameState,
  PlayerPublicState,
  PublicEventState,
  RoleCountState,
  VoteTallyState,
} from "./schemas/GameState.js";
import { normalizeRoomCode, verifyGameToken } from "@werewolf/shared/server";
import {
  createGamePersistence,
  type GamePersistence,
  type PersistEventInput,
} from "../persistence/game-persistence.js";

interface ClientAuth {
  userId: string;
  displayName: string;
}

interface PrivatePlayerState {
  userId: string;
  role?: RoleCode;
  alive: boolean;
  loverId?: string | null;
  witchHealUsed?: boolean;
  witchPoisonUsed?: boolean;
  priestBlessUsed?: boolean;
  priestBlessed?: boolean;
  blacksmithUsed?: boolean;
  investigatorUsed?: boolean;
  vampireHunterDisarmed?: boolean;
  drunkRealRole?: RoleCode;
  lastNightAction?: NightActionCommand;
  lastVoteTarget?: string;
  isMayor?: boolean;
}

interface CreateOptions extends CreateRoomOptions {}

const MAX_PUBLIC_EVENTS = 120;
const MAX_PUBLIC_CHAT = 80;

const PHASE_FLOW: Partial<Record<GamePhase, GamePhase>> = {
  role_reveal: "first_night",
  first_night: "day_announcement",
  night: "day_announcement",
  day_announcement: "day_discussion",
  day_discussion: "voting",
  voting: "resolution",
  resolution: "night",
};

export class GameRoom extends Room<{ state: GameState }> {
  private static liveRooms = new Set<GameRoom>();
  private static lastWinner: { code: string; winnerTeam: string; winnerReasonBg: string; endedAt: string } | null = null;

  static getRuntimeStats() {
    return {
      activeRooms: GameRoom.liveRooms.size,
      connectedPlayers: [...GameRoom.liveRooms].reduce((sum, room) => sum + room.clients.length, 0),
      lastWinner: GameRoom.lastWinner,
    };
  }

  maxClients = 47;
  private config!: GameConfig;
  private clientsByUserId = new Map<string, Client>();
  private privatePlayers = new Map<string, PrivatePlayerState>();
  private pendingNightActions = new Map<string, SubmittedNightAction[]>();
  private phaseTimer?: ReturnType<typeof this.clock.setTimeout>;
  private persistence: GamePersistence = createGamePersistence();
  private persistQueue: Promise<void> = Promise.resolve();
  private persistedGameId: string | undefined;
  private hostUserId: string | undefined;
  private gameFinishedPersisted = false;
  private pausedSnapshot: { phase: GamePhase; remainingMs: number } | undefined;
  private pendingHunterRevengeUserId: string | undefined;
  private pendingMayorSuccessor = false;
  private pendingVampireBites = new Map<string, { round: number; causeBg: string }>();
  private achievementEvents: AchievementEventLike[] = [];
  private announcedAchievementUnlocks = new Set<string>();
  private announcedWitchVictims = new Set<string>();

  onCreate(options: CreateOptions) {
    GameRoom.liveRooms.add(this);
    const mode = options.mode ?? "werewolves_classic";
    const playerCount = options.playerCount ?? (mode === "mafia_sport" ? 10 : 8);
    this.config = createGameConfigFromOptions({ ...options, mode, playerCount });

    this.setState(new GameState());
    this.state.code = options.code ? normalizeRoomCode(options.code) : generateRoomCode();
    this.state.rulesetVersion = this.config.rulesetVersion;
    this.state.phase = "lobby";
    this.syncPublicConfig();

    this.onMessage("*", (client, type, payload) => {
      this.handleCommand(client, { type, ...(isObject(payload) ? payload : {}) } as ClientCommand);
    });

    this.addPublicEvent("Стаята е създадена.");
  }

  async onAuth(_client: Client, options: JoinRoomOptions): Promise<ClientAuth> {
    const allowDevAuth = process.env.ALLOW_DEV_AUTH !== "false" && process.env.NODE_ENV !== "production";
    if (allowDevAuth && options.userId && options.displayName) {
      return { userId: options.userId, displayName: options.displayName };
    }

    if (options.token) {
      const payload = verifyGameToken(options.token, getGameTokenSecret(), { roomCode: this.state.code });
      return { userId: payload.userId, displayName: payload.displayName };
    }

    throw new Error("Невалидна сесия.");
  }

  onJoin(client: Client, options: JoinRoomOptions, auth: ClientAuth) {
    this.clientsByUserId.set(auth.userId, client);
    client.userData = auth;

    const existingEntry = this.findPlayerEntryByUserId(auth.userId);
    const existing = existingEntry?.[1];
    if (existing) {
      if (existingEntry[0] !== client.sessionId) {
        this.state.players.delete(existingEntry[0]);
        this.state.players.set(client.sessionId, existing);
      }
      if (!options.spectator && !this.state.locked && this.state.phase === "lobby" && !existing.playing) {
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
        this.addPublicEvent(`${auth.displayName} се върна в стаята.`);
      }
      existing.connected = true;
      this.sendPrivateRole(client, auth.userId);
      this.sendNarratorRoleSnapshot(client, auth.userId);
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

    const player = new PlayerPublicState();
    player.userId = auth.userId;
    player.displayName = auth.displayName;
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

  async onDrop(client: Client) {
    const auth = getAuth(client);
    if (!auth) {
      return;
    }

    const player = this.clientsByUserId.get(auth.userId) === client ? this.findPlayerByUserId(auth.userId) : undefined;
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

    this.clientsByUserId.set(auth.userId, client);
    const player = this.findPlayerByUserId(auth.userId);
    if (player) {
      player.connected = true;
      this.sendPrivateRole(client, auth.userId);
      this.sendNarratorRoleSnapshot(client, auth.userId);
      this.addPublicEvent(`${player.displayName} възстанови връзката.`);
    }
  }

  onLeave(client: Client) {
    const auth = getAuth(client);
    if (!auth) {
      return;
    }

    if (this.clientsByUserId.get(auth.userId) === client) {
      this.clientsByUserId.delete(auth.userId);
    }
    const player = this.state.players.get(client.sessionId);
    if (player && this.state.phase === "lobby") {
      this.state.players.delete(client.sessionId);
      this.privatePlayers.delete(auth.userId);
      this.addPublicEvent(`${player.displayName} напусна стаята.`);
      this.persistGameEvent("player_left", {
        actorId: auth.userId,
        payload: { displayName: player.displayName },
      });
    }
  }

  onDispose() {
    GameRoom.liveRooms.delete(this);
    this.phaseTimer?.clear();
  }

  private handleCommand(client: Client, command: ClientCommand) {
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
        case "submitVote":
          this.submitVote(client, command.targetUserId);
          break;
        case "submitHunterRevenge":
          this.submitHunterRevenge(client, command.targetUserId);
          break;
        case "sendChat":
          this.sendChat(client, command.channel, command.message);
          break;
        case "typing":
          this.sendTyping(client, command.channel, command.active);
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
    const hostClient = this.clientsByUserId.get(this.hostUserId);
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
      throw new Error("Само host-ът може да избере Разказвач.");
    }
    if (this.state.phase !== "lobby") {
      throw new Error("Разказвачът се избира само преди старт.");
    }
    if (this.config.narratorMode === "automatic") {
      throw new Error("Тази стая е с Автоматичен Разказвач.");
    }

    const target = this.findPlayerByUserId(targetUserId);
    if (!target) {
      throw new Error("Играчът не е в тази стая.");
    }

    for (const player of this.state.players.values()) {
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
      throw new Error("Само host-ът или Разказвачът може да избере Кмет.");
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
      throw new Error("Само host-ът може да започне играта.");
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
      narratorMode: this.config.narratorMode,
      communicationMode: this.config.communicationMode,
      tempoProfile: this.config.tempoProfile,
      loversEnabled: this.config.loversEnabled,
      rolePreset: this.config.rolePreset,
      revealRolesOnDeath: this.config.revealRolesOnDeath,
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
    this.syncPublicConfig();
    const assignments = assignRoles(
      players.map((item) => item.userId),
      this.config.roles,
    );

    if (this.config.mayorMode !== "public_vote") {
      for (const item of players) {
        item.mayor = false;
      }
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
        privatePlayer.blacksmithUsed = false;
        privatePlayer.investigatorUsed = false;
        privatePlayer.vampireHunterDisarmed = false;
        privatePlayer.isMayor = assignment.role === "mayor" || assignment.role === "mafia_mayor";
        if (assignment.role === "drunk") {
          privatePlayer.drunkRealRole = chooseDrunkRealRole(this.config.roles);
        } else {
          delete privatePlayer.drunkRealRole;
        }
        delete privatePlayer.lastNightAction;
        delete privatePlayer.lastVoteTarget;
      }
      if (assignment.role === "mafia_mayor" || (assignment.role === "mayor" && this.config.mayorMode === "public_vote")) {
        const publicPlayer = players.find((item) => item.userId === assignment.playerId);
        if (publicPlayer) {
          publicPlayer.mayor = true;
          this.addPublicEvent(`${publicPlayer.displayName} е Кмет.`);
        }
      }
    }

    this.state.locked = true;
    this.state.round = 1;
    this.transitionTo("role_reveal");

    this.queuePersistence(async () => {
      const gameId = await this.ensurePersistedGame();
      if (!gameId) {
        return;
      }

      await this.persistence.markGameActive(gameId, this.config);
      await this.persistence.upsertPlayers(
        gameId,
        assignments.map((assignment) => {
          const publicPlayer = players.find((item) => item.userId === assignment.playerId);
          return {
            userId: assignment.playerId,
            displayName: publicPlayer?.displayName ?? assignment.playerId,
            role: assignment.role,
            isAlive: true,
          };
        }),
      );
      await this.persistence.recordEvent(gameId, {
        round: this.state.round,
        phase: this.currentPhase(),
        type: "game_started",
        actorId: player.userId,
        visibility: "moderator",
        payload: { assignments },
      });
    });

    for (const item of players) {
      const targetClient = this.clientsByUserId.get(item.userId);
      if (targetClient) {
        this.sendPrivateRole(targetClient, item.userId);
      }
    }
    for (const item of allPlayers) {
      const targetClient = this.clientsByUserId.get(item.userId);
      if (targetClient) {
        this.sendNarratorRoleSnapshot(targetClient, item.userId);
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
    this.applyImmediateNightAction(publicPlayer, privatePlayer, action);

    privatePlayer.lastNightAction = action;
    publicPlayer.actedThisPhase = true;
    this.queueNightAction(publicPlayer.userId, privatePlayer.role, action);
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

    if (this.config.timers.autoAdvanceWhenReady && this.allLivingNightActorsReady()) {
      this.advancePhase();
    }
  }

  private queueNightAction(actorUserId: string, role: RoleCode, action: NightActionCommand) {
    const submission = { actorUserId, action };
    if (role === "witch" && (action.kind === "witch_heal" || action.kind === "witch_poison")) {
      const existing = this.pendingNightActions.get(actorUserId) ?? [];
      this.pendingNightActions.set(actorUserId, [
        ...existing.filter((item) => item.action.kind !== action.kind),
        submission,
      ]);
      return;
    }

    this.pendingNightActions.set(actorUserId, [submission]);
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

  private notifyWitchesOfFactionVictim() {
    const actions = this.getSubmittedNightActions().filter((submission) => submission.action.kind === "faction_kill");
    for (const team of ["werewolves", "vampires"] as const) {
      const livingFaction = [...this.privatePlayers.values()].filter(
        (player) => player.alive && player.role && getRoleTeam(player.role) === team,
      );
      if (livingFaction.length === 0) {
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
        continue;
      }

      const key = `${this.state.round}:${this.state.phase}:${team}:${targetUserId}`;
      if (this.announcedWitchVictims.has(key)) {
        continue;
      }
      this.announcedWitchVictims.add(key);
      const target = this.findPlayerByUserId(targetUserId);
      if (!target) {
        continue;
      }

      for (const witch of this.privatePlayers.values()) {
        if (!witch.alive || witch.role !== "witch") {
          continue;
        }
        const client = this.clientsByUserId.get(witch.userId);
        if (client) {
          client.send("system", {
            type: "system",
            messageBg: `${target.displayName} е нарочен за смърт тази нощ.`,
          } satisfies ServerEvent);
        }
      }
    }
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
      if (this.config.timers.autoAdvanceWhenReady && this.allLivingPlayersVoted()) {
        this.advancePhase();
      }
      return;
    }
    if (!this.findPlayerByUserId(targetUserId)?.alive) {
      throw new Error("Целта не е жив играч.");
    }

    privatePlayer.lastVoteTarget = targetUserId;
    publicPlayer.hasVoted = true;
    this.syncVoteTally();
    this.persistGameEvent("vote_submitted", {
      actorId: publicPlayer.userId,
      targetId: targetUserId,
      visibility: "public",
    });

    if (this.config.timers.autoAdvanceWhenReady && this.allLivingPlayersVoted()) {
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

    this.pendingHunterRevengeUserId = undefined;
    const deaths = this.applyDeaths([{ userId: targetUserId, causeBg: "Застрелян от Ловеца." }]);
    // queueMayorSuccessor consults this.pendingMayorSuccessor too, so a mayor
    // who died alongside a hunter still triggers a successor selection here.
    if (this.queueMayorSuccessor(deaths)) {
      return;
    }
    this.transitionTo("resolution");
  }

  private sendChat(client: Client, channel: string, message: string) {
    const player = this.getPublicPlayer(client);
    const chatChannel = parseChatChannel(channel);
    if (!chatChannel) {
      throw new Error("Непознат чат канал.");
    }
    if (this.config.communicationMode === "no_chat" || this.config.communicationMode === "system_only") {
      throw new Error("В тази стая няма играчески чат.");
    }

    if (chatChannel !== "public") {
      this.sendPrivateChat(player, chatChannel, message);
      return;
    }
    if (this.config.communicationMode !== "built_in_chat") {
      throw new Error("Публичният чат не е активен в тази стая.");
    }
    if (this.state.phase !== "day_discussion") {
      throw new Error("Публичният чат е активен само през дневното обсъждане.");
    }
    if (!player.playing || !player.alive) {
      throw new Error("Само живи играчи могат да пишат в публичния дневен чат.");
    }

    const chat = new ChatMessageState();
    chat.id = crypto.randomUUID();
    chat.channel = "public";
    chat.senderUserId = player.userId;
    chat.senderName = player.displayName;
    chat.message = message.slice(0, 500);
    chat.createdAt = Date.now();
    this.state.publicChat.push(chat);
    while (this.state.publicChat.length > MAX_PUBLIC_CHAT) {
      this.state.publicChat.shift();
    }
    this.persistGameEvent("chat", {
      actorId: player.userId,
      visibility: "public",
      payload: {
        channel: chat.channel,
        message: chat.message,
      },
    });
  }

  private sendPrivateChat(player: PlayerPublicState, channel: ChatChannel, message: string) {
    const privatePlayer = this.getPrivatePlayer(player.userId);
    const text = message.slice(0, 500);
    const createdAt = Date.now();
    const recipients = this.getPrivateChatRecipients(player, privatePlayer, channel);
    if (recipients.length === 0) {
      throw new Error("Няма достъп до този чат канал.");
    }

    for (const recipient of recipients) {
      recipient.send("private_chat", {
        type: "private_chat",
        channel,
        senderUserId: player.userId,
        senderName: player.displayName,
        message: text,
        createdAt,
      } satisfies ServerEvent);
    }

    this.persistGameEvent("chat", {
      actorId: player.userId,
      visibility: channel === "dead" ? "private" : "faction",
      payload: { channel, message: text },
    });
  }

  private sendTyping(client: Client, channel: string, active: boolean) {
    const player = this.getPublicPlayer(client);
    const chatChannel = parseChatChannel(channel);
    if (!chatChannel || this.config.communicationMode === "no_chat" || this.config.communicationMode === "system_only") {
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

    if (chatChannel === "public") {
      if (
        this.config.communicationMode === "built_in_chat" &&
        this.state.phase === "day_discussion" &&
        player.playing &&
        player.alive
      ) {
        this.broadcast("typing", payload);
      }
      return;
    }

    const privatePlayer = this.getPrivatePlayer(player.userId);
    const recipients = this.getPrivateChatRecipients(player, privatePlayer, chatChannel);
    for (const recipient of recipients) {
      recipient.send("typing", payload);
    }
  }

  private getPrivateChatRecipients(player: PlayerPublicState, privatePlayer: PrivatePlayerState, channel: ChatChannel) {
    if (channel === "dead") {
      if (player.alive) {
        return [];
      }
      return this.clientsFor((candidate) => !candidate.alive);
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

    return this.clientsFor((candidate) => {
      const privateCandidate = this.privatePlayers.get(candidate.userId);
      return Boolean(
        privateCandidate?.alive &&
          privateCandidate.role &&
          ((channel === "mafia" && getRoleTeam(privateCandidate.role) === "mafia") ||
            (channel === "werewolves" && getRoleTeam(privateCandidate.role) === "werewolves") ||
            (channel === "vampires" && getRoleTeam(privateCandidate.role) === "vampires")),
      );
    });
  }

  private applyImmediateNightAction(
    publicPlayer: PlayerPublicState,
    privatePlayer: PrivatePlayerState,
    action: NightActionCommand,
  ) {
    if (action.kind === "witch_heal" && privatePlayer.witchHealUsed) {
      throw new Error("Вещицата вече е използвала лечението си.");
    }
    if (action.kind === "witch_heal" && this.hasPendingNightAction(publicPlayer.userId, "witch_heal")) {
      throw new Error("Вещицата вече избра лечебната отвара тази нощ.");
    }
    if (action.kind === "witch_poison" && privatePlayer.witchPoisonUsed) {
      throw new Error("Вещицата вече е използвала отровата си.");
    }
    if (action.kind === "witch_poison" && this.hasPendingNightAction(publicPlayer.userId, "witch_poison")) {
      throw new Error("Вещицата вече избра отровата тази нощ.");
    }
    if (action.kind === "healer_protect" && privatePlayer.role === "healer") {
      if (action.targetUserId === publicPlayer.userId) {
        throw new Error("Лечителят не може да лекува себе си.");
      }
      if (
        privatePlayer.lastNightAction?.kind === "healer_protect" &&
        privatePlayer.lastNightAction.targetUserId === action.targetUserId
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
      if (!this.findPlayerByUserId(action.receiverUserId)?.alive || !this.findPlayerByUserId(action.targetUserId)?.alive) {
        throw new Error("Ковашкият меч изисква двама живи играчи.");
      }
    }
    if (action.kind === "stray_cat_choose" && action.targetUserId === publicPlayer.userId) {
      throw new Error("Уличната котка трябва да избере друг играч.");
    }
    if (action.kind === "roleblock" && action.targetUserId === publicPlayer.userId) {
      throw new Error("Блокиращият трябва да избере друг играч.");
    }
    if (action.kind === "medium_contact") {
      this.applyMediumContact(publicPlayer, action.targetUserId);
    }
    if (action.kind === "priest_bless") {
      this.applyPriestBlessing(publicPlayer, privatePlayer, action.targetUserId);
    }
    if (action.kind === "thief_steal") {
      this.applyThiefSteal(publicPlayer, privatePlayer, action.targetUserId);
    }
    if (action.kind === "cupid_link") {
      this.linkLovers(publicPlayer, action.firstUserId, action.secondUserId);
    }
  }

  private applyMediumContact(actor: PlayerPublicState, targetUserId: string) {
    const target = this.privatePlayers.get(targetUserId);
    const publicTarget = this.findPlayerByUserId(targetUserId);
    if (!target || !publicTarget?.playing || target.alive || publicTarget.alive) {
      throw new Error("Медиумът може да се свърже само с елиминиран играч.");
    }
    if (!target.role) {
      throw new Error("Няма записана роля за този играч.");
    }

    const client = this.clientsByUserId.get(actor.userId);
    if (client) {
      client.send("private_check_result", {
        type: "private_check_result",
        targetUserId,
        role: target.role,
        messageBg: `${publicTarget.displayName} беше ${getRoleNameBg(target.role)}.`,
      } satisfies ServerEvent);
    }
    this.persistGameEvent("medium_contacted_dead", {
      actorId: actor.userId,
      targetId: targetUserId,
      visibility: "moderator",
    });
  }

  private applyThiefSteal(actor: PlayerPublicState, thief: PrivatePlayerState, targetUserId: string) {
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

    const stolenRole = target.role;
    thief.role = stolenRole;
    target.role = "ordinary_villager";
    delete target.lastNightAction;
    this.pendingNightActions.delete(targetUserId);
    publicTarget.actedThisPhase = false;

    const actorClient = this.clientsByUserId.get(actor.userId);
    const targetClient = this.clientsByUserId.get(targetUserId);
    if (actorClient) {
      this.sendPrivateRole(actorClient, actor.userId);
    }
    if (targetClient) {
      this.sendPrivateRole(targetClient, targetUserId);
      targetClient.send("system", {
        type: "system",
        messageBg: "Крадецът взе картата ти. Вече си Обикновен селянин.",
      } satisfies ServerEvent);
    }
    this.sendNarratorSnapshotsToNarrators();
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

  private applyPriestBlessing(actor: PlayerPublicState, privatePlayer: PrivatePlayerState, targetUserId: string) {
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

    privatePlayer.priestBlessUsed = true;
    target.priestBlessed = true;
    this.persistGameEvent("priest_blessed", {
      actorId: actor.userId,
      targetId: targetUserId,
      visibility: "moderator",
    });
  }

  private linkLovers(actor: PlayerPublicState, firstUserId: string, secondUserId: string) {
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

    first.loverId = secondUserId;
    second.loverId = firstUserId;
    this.sendPrivateLover(firstUserId, secondUserId);
    this.sendPrivateLover(secondUserId, firstUserId);
    this.addPublicEvent(`${actor.displayName} избра Влюбените.`);
    this.persistGameEvent("lovers_linked", {
      actorId: actor.userId,
      visibility: "moderator",
      payload: { firstUserId, secondUserId },
    });
  }

  private pauseByNarrator(client: Client) {
    const player = this.getPublicPlayer(client);
    if (!player.host && !player.narrator) {
      throw new Error("Само Разказвачът или host-ът може да паузира.");
    }
    if (this.state.phase === "paused" || this.state.phase === "game_over") {
      throw new Error("Тази фаза не може да бъде паузирана.");
    }
    this.pausedSnapshot = {
      phase: this.currentPhase(),
      remainingMs: Math.max(0, this.state.phaseEndsAt - Date.now()),
    };
    this.addPublicEvent(`${player.displayName} паузира играта.`);
    this.auditNarratorAction(player, "narrator_pause", { fromPhase: this.state.phase });
    this.transitionTo("paused");
  }

  private advanceByNarrator(client: Client) {
    const player = this.getPublicPlayer(client);
    if (!player.host && !player.narrator) {
      throw new Error("Само Разказвачът или host-ът може да смени фазата.");
    }
    if (this.state.phase === "paused" && this.pausedSnapshot) {
      this.resumePausedPhase(player);
      return;
    }

    this.auditNarratorAction(player, "narrator_advance", { fromPhase: this.state.phase });
    this.advancePhase();
  }

  private extendTimerByNarrator(client: Client, seconds: number) {
    const player = this.getPublicPlayer(client);
    if (!player.host && !player.narrator) {
      throw new Error("Само Разказвачът или host-ът може да удължи таймера.");
    }
    if (!this.state.phaseEndsAt || this.state.phase === "paused" || this.state.phase === "game_over") {
      throw new Error("В тази фаза няма активен таймер.");
    }

    const safeSeconds = Math.min(600, Math.max(10, Math.floor(seconds)));
    this.phaseTimer?.clear();
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
    this.phaseTimer?.clear();
    this.state.phase = phase;

    if (phase !== "paused") {
      for (const player of this.state.players.values()) {
        player.actedThisPhase = false;
        if (phase !== "voting") {
          player.hasVoted = false;
        }
      }
    }
    if (phase !== "voting") {
      this.state.voteTally.clear();
    }
    if (isNightPhase(phase)) {
      this.announcedWitchVictims.clear();
    }

    const duration = this.getPhaseDurationMs(phase);
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

    if (phase === "game_over" && this.state.winnerTeam && !this.gameFinishedPersisted) {
      this.gameFinishedPersisted = true;
      GameRoom.lastWinner = {
        code: this.state.code,
        winnerTeam: this.state.winnerTeam,
        winnerReasonBg: this.state.winnerReasonBg,
        endedAt: new Date().toISOString(),
      };
      const achievementUnlocks = this.evaluateAchievementUnlocks();
      this.sendAchievementUnlocks(achievementUnlocks);
      this.queuePersistence(async () => {
        const gameId = await this.ensurePersistedGame();
        if (gameId) {
          await this.persistence.finishGame(gameId, {
            winnerTeam: this.state.winnerTeam as never,
          });
          for (const unlock of achievementUnlocks) {
            await this.persistence.recordAchievement(unlock.userId, unlock.achievementId, gameId);
          }
        }
      });
    }

    this.scheduleCurrentPhaseTimer(duration);
  }

  private resumePausedPhase(player: PlayerPublicState) {
    const snapshot = this.pausedSnapshot;
    if (!snapshot) {
      return;
    }

    this.phaseTimer?.clear();
    this.pausedSnapshot = undefined;
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
  }

  private scheduleCurrentPhaseTimer(durationMs: number) {
    if (durationMs > 0 && this.state.phase !== "paused" && this.state.phase !== "game_over") {
      this.phaseTimer = this.clock.setTimeout(() => this.advancePhase(), durationMs);
    }
  }

  private resolveNightPhase() {
    const players = [...this.privatePlayers.values()]
      .filter((player): player is PrivatePlayerState & { role: RoleCode } => Boolean(player.role))
      .map((player) => ({
        userId: player.userId,
        role: player.role,
        alive: player.alive,
        ...(player.priestBlessed ? { priestBlessed: true } : {}),
      }));

    const submittedActions = this.getSubmittedNightActions().filter((submission) => {
      const privatePlayer = this.privatePlayers.get(submission.actorUserId);
      if (
        this.config.mafiaNightKill ||
        submission.action.kind !== "faction_kill" ||
        !privatePlayer?.role ||
        getRoleTeam(privatePlayer.role) !== "mafia"
      ) {
        return true;
      }

      const client = this.clientsByUserId.get(submission.actorUserId);
      if (client) {
        client.send("system", {
          type: "system",
          messageBg: "Нощното убийство на Мафията е изключено за тази стая.",
        } satisfies ServerEvent);
      }
      return false;
    });
    const resolution = resolveNight(players, submittedActions);
    this.reportPersistentPriestProtection(resolution.protectedByPriest);
    this.reportPreventedDeaths(resolution.preventedDeaths);
    this.rememberDelayedVampireBites(resolution.delayedDeaths);
    this.sendPrivateNightMessages(resolution.privateMessages);
    this.sendInsomniacResults(submittedActions);
    this.markNightActionConsumables();
    this.pendingNightActions.clear();

    for (const check of resolution.checks) {
      const targetClient = this.clientsByUserId.get(check.actorUserId);
      if (targetClient) {
        const exactRole =
          this.config.commissionerResultMode === "exact_role" && this.isCommissionerLike(check.actorUserId)
            ? this.privatePlayers.get(check.targetUserId)?.role
            : undefined;
        targetClient.send("private_check_result", {
          type: "private_check_result",
          targetUserId: check.targetUserId,
          ...(check.targetUserIds ? { targetUserIds: check.targetUserIds } : {}),
          ...(exactRole ? { role: exactRole } : check.role ? { role: check.role } : {}),
          ...(typeof check.isEvil === "boolean" ? { isEvil: check.isEvil } : {}),
          ...(typeof check.isCommissioner === "boolean" ? { isCommissioner: check.isCommissioner } : {}),
          ...(check.messageBg ? { messageBg: check.messageBg } : {}),
        } satisfies ServerEvent);
      }
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

  private reportPreventedDeaths(events: Array<{ userId: string; reasonBg: string }>) {
    const uniqueMessages = new Set<string>();
    for (const event of events) {
      uniqueMessages.add(event.reasonBg);
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
        targetId: userId,
        visibility: "public",
      });
    }
  }

  private sendPrivateNightMessages(messages: Array<{ targetUserId: string; messageBg: string }>) {
    for (const message of messages) {
      const client = this.clientsByUserId.get(message.targetUserId);
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
      const client = this.clientsByUserId.get(player.userId);
      if (client) {
        client.send("private_check_result", {
          type: "private_check_result",
          targetUserId: player.userId,
          targetUserIds: neighbors.map((neighbor) => neighbor.userId),
          messageBg: someoneMoved
            ? "Неспящата усети движение до себе си: поне един от двамата съседни играчи действа тази нощ."
            : "Неспящата не усети движение до себе си тази нощ.",
        } satisfies ServerEvent);
      }
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

  private markNightActionConsumables() {
    for (const submission of this.getSubmittedNightActions()) {
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
      if (submission.action.kind === "faction_kill" && privatePlayer.role === "vampire_hunter") {
        const target = this.privatePlayers.get(submission.action.targetUserId);
        if (target?.role && getRoleTeam(target.role) !== "werewolves" && getRoleTeam(target.role) !== "vampires") {
          privatePlayer.vampireHunterDisarmed = true;
          const client = this.clientsByUserId.get(submission.actorUserId);
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
        })),
    );
  }

  private allLivingNightActorsReady() {
    return [...this.privatePlayers.values()].every((privatePlayer) => {
      if (!privatePlayer.alive || !privatePlayer.role) {
        return true;
      }
      const team = getRoleTeam(privatePlayer.role);
      if (privatePlayer.role === "witch") {
        return (
          this.hasPendingNightAction(privatePlayer.userId, "skip") ||
          ((privatePlayer.witchHealUsed || this.hasPendingNightAction(privatePlayer.userId, "witch_heal")) &&
            (privatePlayer.witchPoisonUsed || this.hasPendingNightAction(privatePlayer.userId, "witch_poison")))
        );
      }
      const needsAction =
        team === "mafia" ||
        team === "werewolves" ||
        team === "vampires" ||
        privatePlayer.role === "seer" ||
        privatePlayer.role === "oracle" ||
        privatePlayer.role === "commissioner" ||
        privatePlayer.role === "don" ||
        privatePlayer.role === "healer" ||
        privatePlayer.role === "doctor" ||
        privatePlayer.role === "bodyguard" ||
        privatePlayer.role === "detective" ||
        privatePlayer.role === "vigilante" ||
        privatePlayer.role === "maniac" ||
        privatePlayer.role === "roleblocker" ||
        privatePlayer.role === "lawyer" ||
        privatePlayer.role === "informant" ||
        privatePlayer.role === "medium" ||
        (privatePlayer.role === "vampire_hunter" && !privatePlayer.vampireHunterDisarmed) ||
        (privatePlayer.role === "blacksmith" && !privatePlayer.blacksmithUsed) ||
        (privatePlayer.role === "investigator" && !privatePlayer.investigatorUsed) ||
        privatePlayer.role === "stray_cat" ||
        (privatePlayer.role === "priest" && !privatePlayer.priestBlessUsed) ||
        (privatePlayer.role === "thief" && this.state.phase === "first_night") ||
        ((privatePlayer.role === "cupid" || privatePlayer.role === "lovers") && this.state.phase === "first_night");

      return !needsAction || this.hasPendingNightAction(privatePlayer.userId);
    });
  }

  private allLivingPlayersVoted() {
    return [...this.privatePlayers.values()].every((privatePlayer) => {
      const publicPlayer = this.findPlayerByUserId(privatePlayer.userId);
      return !privatePlayer.alive || Boolean(publicPlayer?.hasVoted);
    });
  }

  private getPhaseDurationMs(phase: GamePhase) {
    const timers = this.config.timers;
    const seconds =
      phase === "role_reveal"
        ? timers.roleRevealSeconds
        : isNightPhase(phase)
          ? timers.factionNightActionSeconds
          : phase === "day_discussion"
            ? timers.dayDiscussionSeconds
            : phase === "voting"
              ? timers.voteSeconds
              : phase === "resolution" || phase === "day_announcement"
                ? timers.resolutionSeconds
                : 0;

    return seconds * 1000;
  }

  private sendPrivateRole(client: Client, userId: string) {
    const privatePlayer = this.privatePlayers.get(userId);
    const role = privatePlayer?.role;
    if (!role) {
      return;
    }

    client.send("private_role", {
      type: "private_role",
      role,
      roleNameBg: getRoleNameBg(role),
    } satisfies ServerEvent);
    if (privatePlayer?.loverId) {
      this.sendPrivateLover(userId, privatePlayer.loverId);
    }
  }

  private sendPrivateLover(userId: string, loverUserId: string) {
    const client = this.clientsByUserId.get(userId);
    const lover = this.findPlayerByUserId(loverUserId);
    if (!client || !lover) {
      return;
    }

    client.send("private_lovers", {
      type: "private_lovers",
      loverUserId,
      loverName: lover.displayName,
    } satisfies ServerEvent);
  }

  private sendNarratorRoleSnapshot(client: Client, userId: string) {
    if (this.config.narratorMode !== "full_human") {
      return;
    }

    const publicPlayer = this.findPlayerByUserId(userId);
    if (!publicPlayer?.narrator) {
      return;
    }

    const roles = [...this.privatePlayers.values()]
      .filter((player): player is PrivatePlayerState & { role: RoleCode } => Boolean(player.role))
      .map((player) => {
        const publicState = this.findPlayerByUserId(player.userId);
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

  private sendNarratorSnapshotsToNarrators() {
    for (const player of this.state.players.values()) {
      const client = this.clientsByUserId.get(player.userId);
      if (client) {
        this.sendNarratorRoleSnapshot(client, player.userId);
      }
    }
  }

  private revealDrunkRoles() {
    for (const privatePlayer of this.privatePlayers.values()) {
      if (!privatePlayer.alive || privatePlayer.role !== "drunk" || !privatePlayer.drunkRealRole) {
        continue;
      }
      const newRole = privatePlayer.drunkRealRole;
      privatePlayer.role = newRole;
      delete privatePlayer.drunkRealRole;
      const client = this.clientsByUserId.get(privatePlayer.userId);
      if (client) {
        this.sendPrivateRole(client, privatePlayer.userId);
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
    this.sendNarratorSnapshotsToNarrators();
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
    this.achievementEvents.push({
      round: this.state.round,
      phase: this.currentPhase(),
      type,
      actorId: event.actorId ?? null,
      targetId: event.targetId ?? null,
      payload: event.payload ?? {},
    });

    this.queuePersistence(async () => {
      const gameId = await this.ensurePersistedGame();
      if (!gameId) {
        return;
      }

      await this.persistence.recordEvent(gameId, {
        round: this.state.round,
        phase: this.currentPhase(),
        type,
        ...event,
      });
    });
  }

  private evaluateAchievementUnlocks() {
    const rawUnlocks = evaluateAchievementUnlocks({
      events: this.achievementEvents,
      winnerTeam: this.state.winnerTeam,
      players: [...this.privatePlayers.values()].map((player) => ({
        userId: player.userId,
        ...(player.role ? { role: player.role } : {}),
        alive: player.alive,
      })),
    });

    const seen = new Set<string>();
    return rawUnlocks.filter((unlock) => {
      const key = `${unlock.userId}:${unlock.achievementId}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private sendAchievementUnlocks(unlocks: Array<{ userId: string; achievementId: string }>) {
    if (unlocks.length === 0) {
      return;
    }

    const knownAchievementIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
    const byUserId = new Map<string, string[]>();
    for (const unlock of unlocks) {
      if (!knownAchievementIds.has(unlock.achievementId)) {
        continue;
      }
      const key = `${unlock.userId}:${unlock.achievementId}`;
      if (this.announcedAchievementUnlocks.has(key)) {
        continue;
      }
      this.announcedAchievementUnlocks.add(key);
      byUserId.set(unlock.userId, [...(byUserId.get(unlock.userId) ?? []), unlock.achievementId]);
    }

    for (const [userId, achievementIds] of byUserId) {
      const client = this.clientsByUserId.get(userId);
      client?.send("achievements_unlocked", {
        type: "achievements_unlocked",
        achievementIds,
      } satisfies ServerEvent);
    }
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

  private async ensurePersistedGame() {
    if (this.persistedGameId || !this.persistence.enabled || !this.hostUserId) {
      return this.persistedGameId;
    }

    this.persistedGameId = await this.persistence.ensureGame({
      code: this.state.code,
      hostId: this.hostUserId,
      config: this.config,
    });

    return this.persistedGameId;
  }

  private currentPhase(): GamePhase {
    return this.state.phase as GamePhase;
  }

  private queuePersistence(task: () => Promise<void>) {
    if (!this.persistence.enabled) {
      return;
    }

    this.persistQueue = this.persistQueue
      .then(task)
      .catch((error) => {
        if (process.env.SENTRY_DSN) {
          Sentry.captureException(error);
        }
        console.error("[game-persistence]", error);
      });
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
      const client = this.clientsByUserId.get(player.userId);
      if (client) {
        clients.push(client);
      }
    }
    return clients;
  }
}

function getAuth(client: Client): ClientAuth | undefined {
  return client.userData as ClientAuth | undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNightPhase(phase: string): phase is "first_night" | "night" {
  return phase === "first_night" || phase === "night";
}

function getActionTargetUserId(action: NightActionCommand): string | null {
  switch (action.kind) {
    case "faction_kill":
    case "check_alignment":
    case "check_role":
    case "check_commissioner":
    case "witch_heal":
    case "witch_poison":
    case "healer_protect":
    case "priest_bless":
    case "investigator_check":
    case "stray_cat_choose":
    case "thief_steal":
    case "roleblock":
    case "lawyer_cover":
    case "medium_contact":
      return action.targetUserId;
    case "blacksmith_sword":
      return action.targetUserId;
    case "cupid_link":
      return action.firstUserId;
    case "skip":
      return null;
  }
}

function parseChatChannel(channel: string): ChatChannel | null {
  return channel === "public" ||
    channel === "mafia" ||
    channel === "werewolves" ||
    channel === "vampires" ||
    channel === "dead" ||
    channel === "system"
    ? channel
    : null;
}

function ensureNightActionAllowed(role: RoleCode, action: NightActionCommand, phase: string): void {
  const team = getRoleTeam(role);
  const allowed =
    action.kind === "skip" ||
    (action.kind === "faction_kill" &&
      (team === "mafia" ||
        team === "werewolves" ||
        team === "vampires" ||
        role === "vigilante" ||
        role === "maniac" ||
        role === "vampire_hunter")) ||
    (action.kind === "check_alignment" && (role === "commissioner" || role === "detective")) ||
    (action.kind === "check_role" && (role === "seer" || role === "oracle" || role === "informant")) ||
    (action.kind === "check_commissioner" && role === "don") ||
    (action.kind === "investigator_check" && role === "investigator") ||
    (action.kind === "witch_heal" && role === "witch") ||
    (action.kind === "witch_poison" && role === "witch") ||
    (action.kind === "healer_protect" && (role === "healer" || role === "doctor" || role === "bodyguard")) ||
    (action.kind === "priest_bless" && role === "priest") ||
    (action.kind === "blacksmith_sword" && role === "blacksmith") ||
    (action.kind === "stray_cat_choose" && role === "stray_cat") ||
    (action.kind === "thief_steal" && role === "thief" && phase === "first_night") ||
    (action.kind === "cupid_link" && (role === "cupid" || role === "lovers") && phase === "first_night") ||
    (action.kind === "roleblock" && role === "roleblocker") ||
    (action.kind === "lawyer_cover" && role === "lawyer") ||
    (action.kind === "medium_contact" && role === "medium");

  if (!allowed) {
    throw new Error("Тази роля няма право на това нощно действие.");
  }
}

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function chooseDrunkRealRole(roles: Partial<Record<RoleCode, number>>): RoleCode {
  const preferred: RoleCode[] = [
    "ordinary_villager",
    "healer",
    "hunter",
    "seer",
    "witch",
    "oracle",
    "priest",
    "cook",
    "red_riding_hood",
  ];
  return preferred.find((role) => (roles[role] ?? 0) > 0 && role !== "drunk") ?? "ordinary_villager";
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
