import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { AchievementEventLike, RoleCode } from "@werewolf/shared";
import type { SubmittedNightAction } from "../game-logic/night-resolver.js";
import type {
  PersistEventInput,
  PersistPlayerInput,
  GamePersistence,
} from "../persistence/game-persistence.js";
import type {
  PersistenceQueueOptions,
  RoomPersistenceContext,
  RoomPersistenceTaskApi,
} from "../rooms/room-persistence-coordinator.js";
import appConfig from "../app.config.js";
import type { PrivatePlayerState } from "../rooms/game-room-runtime.js";
import { getGameRuntimeStats, type GameRoom } from "../rooms/GameRoom.js";
import { PlayerPublicState } from "../rooms/schemas/GameState.js";

type PersistenceTask = (api: RoomPersistenceTaskApi) => Promise<void>;

interface GameRoomPersistenceInternals {
  persistenceCoordinator: {
    queue: (
      context: RoomPersistenceContext,
      task: PersistenceTask,
      options?: PersistenceQueueOptions,
    ) => boolean;
    flush?: (timeoutMs: number) => Promise<boolean>;
    dispose: (timeoutMs: number) => Promise<boolean>;
    enabled?: boolean;
  };
  persistGameEvent: (
    type: string,
    event?: Omit<PersistEventInput, "round" | "phase" | "type">,
  ) => void;
  reportPersistentPriestProtection: (userIds: string[]) => void;
  buildFinalPlayerPersistenceRows: (win: {
    winnerPlayerIds: string[];
    personalWinnerPlayerIds: string[];
  }) => PersistPlayerInput[];
  privatePlayers: Map<string, {
    userId: string;
    role?: PersistPlayerInput["role"];
    alive: boolean;
    loverId?: string | null;
    deathRound?: number;
    deathCause?: string;
  }>;
  recordedGameId?: string;
  sendRecordedGameId: (client: { send: (type: string, payload: unknown) => void }) => void;
  sendAchievementUnlocks: (unlocks: Array<{ userId: string; achievementId: string }>) => void;
  persistAndSendAchievementUnlocks: (
    unlocks: Array<{ userId: string; achievementId: string }>,
    operation: string,
  ) => boolean;
}

function makePersistence(recordEvent: GamePersistence["recordEvent"]): GamePersistence {
  return {
    enabled: true,
    ensureGame: vi.fn(async () => "game-1"),
    markGameActive: vi.fn(async () => {}),
    upsertPlayers: vi.fn(async () => {}),
    recordEvent,
    recordAchievement: vi.fn(async () => {}),
    finishGame: vi.fn(async () => {}),
    recordGameCompletion: vi.fn(async () => {}),
  };
}

describe("GameRoom persistence snapshots", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(appConfig, 2684);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("persists the phase and round captured when the event is queued", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "PERS23",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const internals = room as unknown as GameRoomPersistenceInternals;
    let queuedTask: PersistenceTask | undefined;
    let queuedOptions: PersistenceQueueOptions | undefined;
    let queuedContext: RoomPersistenceContext | undefined;
    const recordEvent = vi.fn<GamePersistence["recordEvent"]>(async () => {});

    internals.persistenceCoordinator = {
      queue: (context, task, options) => {
        queuedContext = context;
        queuedTask = task;
        queuedOptions = options;
        return true;
      },
      dispose: vi.fn(async () => true),
    };

    const actor = new PlayerPublicState();
    actor.userId = "actor-1";
    actor.displayName = "Актьор";
    actor.playing = true;
    actor.alive = true;
    room.state.players.set("actor-session", actor);

    const target = new PlayerPublicState();
    target.userId = "target-1";
    target.displayName = "Цел";
    target.playing = true;
    target.alive = true;
    room.state.players.set("target-session", target);

    room.state.round = 4;
    room.state.phase = "night";
    const payload = { causeBg: "Първоначална причина" };
    internals.persistGameEvent("death", { actorId: "actor-1", targetId: "target-1", payload });

    room.state.round = 5;
    room.state.phase = "day_discussion";
    room.state.players.delete("target-session");
    payload.causeBg = "Променена след enqueue";
    await queuedTask?.({
      persistence: makePersistence(recordEvent),
      ensureGame: async () => "game-1",
      idempotencyKeys: {
        game: "room-instance",
        event: (scope = "default") => `room-instance:event:0:${scope}`,
      },
    });

    expect(queuedOptions).toMatchObject({ priority: "critical" });
    expect(queuedContext).toMatchObject({ roomIdempotencyKey: room.roomId });
    expect(recordEvent).toHaveBeenCalledWith("game-1", {
      round: 4,
      phase: "night",
      type: "death",
      actorId: "actor-1",
      targetId: "target-1",
      payload: { causeBg: "Първоначална причина" },
      participantUserIds: ["actor-1", "target-1"],
      occurredAt: expect.any(Date),
      idempotencyKey: "room-instance:event:0:death",
    });
  });

  it("reports a rejected critical gameplay event", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "REGE23",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const internals = room as unknown as GameRoomPersistenceInternals;
    internals.persistenceCoordinator = {
      enabled: true,
      queue: () => false,
      dispose: vi.fn(async () => true),
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    internals.persistGameEvent("death", { targetId: "target-1" });

    expect(error).toHaveBeenCalledWith(
      "[game-persistence]",
      {
        event: "queue-rejected",
        operation: "event death",
        priority: "critical",
        terminal: false,
      },
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("REGE23");
    error.mockRestore();
  });

  it("persists current roles and exact team plus personal winners", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "DYNC23",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const internals = room as unknown as GameRoomPersistenceInternals;
    internals.privatePlayers = new Map([
      ["dynamic", { userId: "dynamic", role: "vampire", alive: true }],
      ["lover-a", { userId: "lover-a", role: "seer", alive: true, loverId: "lover-b" }],
      ["lover-b", { userId: "lover-b", role: "werewolf", alive: true, loverId: "lover-a" }],
      ["jester", { userId: "jester", role: "jester", alive: false }],
      ["loser", {
        userId: "loser",
        role: "ordinary_villager",
        alive: false,
        deathRound: 3,
        deathCause: "Изгонен след гласуване.",
      }],
    ]);

    const rows = internals.buildFinalPlayerPersistenceRows({
      winnerPlayerIds: ["dynamic", "lover-a", "lover-b"],
      personalWinnerPlayerIds: ["jester"],
    });
    const byUserId = new Map(rows.map((row) => [row.userId, row]));

    expect(byUserId.get("dynamic")).toMatchObject({ role: "vampire", won: true });
    expect(byUserId.get("lover-a")).toMatchObject({ isLover: true, loverUserId: "lover-b", won: true });
    expect(byUserId.get("lover-b")).toMatchObject({ isLover: true, loverUserId: "lover-a", won: true });
    expect(byUserId.get("jester")).toMatchObject({ role: "jester", won: true });
    expect(byUserId.get("loser")).toMatchObject({
      won: false,
      deathRound: 3,
      deathCause: "Изгонен след гласуване.",
    });
  });

  it("keeps a disposing room active until persistence has drained", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "DRAN23",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const internals = room as unknown as GameRoomPersistenceInternals;
    let releaseDrain!: () => void;
    const draining = new Promise<boolean>((resolve) => {
      releaseDrain = () => resolve(true);
    });
    internals.persistenceCoordinator = {
      enabled: true,
      queue: () => true,
      dispose: vi.fn(() => draining),
    };

    const activeBeforeDispose = getGameRuntimeStats().activeRooms;
    const disposePromise = room.onDispose();

    expect(getGameRuntimeStats().activeRooms).toBe(activeBeforeDispose);
    releaseDrain();
    await disposePromise;
    expect(getGameRuntimeStats().activeRooms).toBe(activeBeforeDispose - 1);
  });

  it("reports incomplete persistence disposal without logging the private room code", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "SAFE23",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const internals = room as unknown as GameRoomPersistenceInternals;
    internals.persistenceCoordinator = {
      enabled: true,
      queue: () => true,
      dispose: vi.fn(async () => false),
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await room.onDispose();

    expect(error).toHaveBeenCalledWith(
      "[game-persistence]",
      { event: "coordinator-disposal-incomplete" },
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("SAFE23");
    error.mockRestore();
  });

  it("queues final outcomes before finishGame as terminal critical work", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "TERM23",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const internals = room as unknown as GameRoomPersistenceInternals & {
      transitionTo: (phase: "game_over") => void;
      evaluateWin: () => {
        winner: "village";
        reasonBg: string;
        winnerPlayerIds: string[];
        personalWinnerPlayerIds: string[];
      };
    };
    let terminalTask: PersistenceTask | undefined;
    let terminalOptions: PersistenceQueueOptions | undefined;
    internals.persistenceCoordinator = {
      enabled: true,
      queue: (_context, task, options) => {
        if (options?.terminal) {
          terminalTask = task;
          terminalOptions = options;
        }
        return true;
      },
      dispose: vi.fn(async () => true),
    };
    internals.privatePlayers = new Map([
      ["winner", { userId: "winner", role: "seer", alive: true }],
      ["jester", { userId: "jester", role: "jester", alive: false }],
    ]);
    internals.evaluateWin = () => ({
      winner: "village",
      reasonBg: "Победа.",
      winnerPlayerIds: ["winner"],
      personalWinnerPlayerIds: ["jester"],
    });
    room.state.winnerTeam = "village";
    room.state.winnerReasonBg = "Победа.";
    const broadcast = vi.spyOn(room, "broadcast");
    const sendAchievementUnlocks = vi.spyOn(internals, "sendAchievementUnlocks");
    internals.persistGameEvent("jester_personal_win", {
      targetId: "jester",
      visibility: "public",
    });

    internals.transitionTo("game_over");

    expect(sendAchievementUnlocks).not.toHaveBeenCalled();

    const persistence = makePersistence(vi.fn(async () => {}));
    await terminalTask?.({
      persistence,
      ensureGame: async () => "game-1",
      idempotencyKeys: {
        game: "room-instance",
        event: (scope = "default") => `room-instance:event:1:${scope}`,
      },
    });

    expect(terminalOptions).toEqual({ priority: "critical", terminal: true, maxAttempts: 3 });
    expect(persistence.recordGameCompletion).toHaveBeenCalledWith(
      "game-1",
      {
        winnerTeam: "village",
        players: expect.arrayContaining([
          expect.objectContaining({ userId: "winner", won: true }),
          expect.objectContaining({ userId: "jester", won: true }),
        ]),
        achievements: expect.any(Array),
      },
    );
    expect(persistence.upsertPlayers).not.toHaveBeenCalled();
    expect(persistence.finishGame).not.toHaveBeenCalled();
    expect(persistence.recordAchievement).not.toHaveBeenCalled();
    expect(sendAchievementUnlocks).toHaveBeenCalledOnce();
    expect(sendAchievementUnlocks).toHaveBeenCalledWith([
      { userId: "jester", achievementId: "jester_win" },
    ]);
    expect(broadcast).toHaveBeenCalledWith("game_recorded", {
      type: "game_recorded",
      gameId: "game-1",
    });
    expect(internals.recordedGameId).toBe("game-1");

    const send = vi.fn();
    internals.sendRecordedGameId({ send });
    expect(send).toHaveBeenCalledWith("game_recorded", {
      type: "game_recorded",
      gameId: "game-1",
    });
  });

  it("announces an in-game achievement only after its database write succeeds", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "ACHV23",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const internals = room as unknown as GameRoomPersistenceInternals;
    let queuedTask: PersistenceTask | undefined;
    internals.persistenceCoordinator = {
      enabled: true,
      queue: (_context, task) => {
        queuedTask = task;
        return true;
      },
      dispose: vi.fn(async () => true),
    };
    const sendAchievementUnlocks = vi.spyOn(internals, "sendAchievementUnlocks");
    const persistence = makePersistence(vi.fn(async () => {}));

    expect(internals.persistAndSendAchievementUnlocks(
      [{ userId: "jester", achievementId: "jester_win" }],
      "jester achievement",
    )).toBe(true);
    expect(sendAchievementUnlocks).not.toHaveBeenCalled();

    await queuedTask?.({
      persistence,
      ensureGame: async () => "game-1",
      idempotencyKeys: {
        game: "room-instance",
        event: (scope = "default") => `room-instance:event:1:${scope}`,
      },
    });

    expect(persistence.recordAchievement).toHaveBeenCalledWith("jester", "jester_win", "game-1");
    expect(sendAchievementUnlocks).toHaveBeenCalledOnce();
    expect(sendAchievementUnlocks).toHaveBeenCalledWith([
      { userId: "jester", achievementId: "jester_win" },
    ]);
  });

  it("reports a rejected terminal persistence task", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "REJT23",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const internals = room as unknown as GameRoomPersistenceInternals & {
      transitionTo: (phase: "game_over") => void;
      evaluateWin: () => {
        winner: "village";
        reasonBg: string;
        winnerPlayerIds: string[];
        personalWinnerPlayerIds: string[];
      };
    };
    internals.persistenceCoordinator = {
      enabled: true,
      queue: (_context, _task, options) => !options?.terminal,
      dispose: vi.fn(async () => true),
    };
    internals.evaluateWin = () => ({
      winner: "village",
      reasonBg: "Победа.",
      winnerPlayerIds: [],
      personalWinnerPlayerIds: [],
    });
    room.state.winnerTeam = "village";
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    internals.transitionTo("game_over");

    expect(error).toHaveBeenCalledWith(
      "[game-persistence]",
      {
        event: "queue-rejected",
        operation: "terminal game-over",
        priority: "critical",
        terminal: true,
      },
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("REJT23");
    error.mockRestore();
  });

  it("disposes the persistence coordinator when the room closes", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "DSP223",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const internals = room as unknown as GameRoomPersistenceInternals;
    const dispose = vi.fn(async () => true);
    internals.persistenceCoordinator = {
      queue: vi.fn(() => true),
      dispose,
    };

    await room.onDispose();

    expect(dispose).toHaveBeenCalledWith(25_000);
  });

  it("keeps the protected Priest target out of public persistence", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "PRJVPR",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const internals = room as unknown as GameRoomPersistenceInternals;
    const persistGameEvent = vi.fn();
    internals.persistGameEvent = persistGameEvent;

    internals.reportPersistentPriestProtection(["blessed-player"]);

    expect(persistGameEvent).toHaveBeenCalledWith("priest_blessing_protected", {
      visibility: "public",
    });
    expect(persistGameEvent).toHaveBeenCalledWith("priest_blessing_protected_target", {
      targetId: "blessed-player",
      visibility: "moderator",
    });
    expect(persistGameEvent).not.toHaveBeenCalledWith(
      "priest_blessing_protected",
      expect.objectContaining({ targetId: "blessed-player", visibility: "public" }),
    );
  });

  it("persists personal night-save attribution without adding it to public narration", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "SAVE23", mode: "werewolves_classic", playerCount: 6,
    });
    const internals = room as unknown as GameRoomPersistenceInternals & {
      reportPreventedDeaths: (events: Array<{ userId: string; reasonBg: string; actorUserId?: string }>) => void;
      evaluateAchievementUnlocks: () => Array<{ userId: string; achievementId: string }>;
    };
    internals.privatePlayers.set("guardian-user", { userId: "guardian-user", role: "healer", alive: true });
    internals.privatePlayers.set("other-guardian", { userId: "other-guardian", role: "doctor", alive: true });
    const persist = vi.spyOn(internals, "persistGameEvent");
    room.state.phase = "night";
    for (const round of [2, 3]) {
      room.state.round = round;
      internals.reportPreventedDeaths([
        { userId: "protected-user", actorUserId: "guardian-user", reasonBg: "Лечителят спря нощна атака." },
      ]);
    }
    expect(persist).toHaveBeenCalledWith("night_death_prevented", {
      actorId: "guardian-user", targetId: "protected-user", visibility: "moderator",
      payload: { reasonBg: "Лечителят спря нощна атака." },
    });
    expect(internals.evaluateAchievementUnlocks()).toEqual([
      { userId: "guardian-user", achievementId: "guardian_save" },
    ]);
    expect(JSON.stringify(room.state.publicEvents.toJSON())).not.toMatch(/guardian-user|protected-user/);
  });

  it("attributes repeated blessings to the actual Priest even after their death", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "PRSV23", mode: "werewolves_classic", playerCount: 6,
    });
    const internals = room as unknown as Omit<GameRoomPersistenceInternals, "privatePlayers"> & {
      privatePlayers: Map<string, PrivatePlayerState>;
      evaluateAchievementUnlocks: () => Array<{ userId: string; achievementId: string }>;
    };
    internals.privatePlayers.set("priest-user", {
      userId: "priest-user", role: "priest", alive: false, priestBlessedTargetUserId: "blessed-user",
    });
    const persist = vi.spyOn(internals, "persistGameEvent");
    room.state.phase = "night";
    for (const round of [2, 3]) {
      room.state.round = round;
      internals.reportPersistentPriestProtection(["blessed-user"]);
    }
    expect(persist).toHaveBeenCalledWith("priest_blessing_protected", { visibility: "public" });
    expect(persist).toHaveBeenCalledWith("priest_blessing_protected_target", {
      actorId: "priest-user", targetId: "blessed-user", visibility: "moderator",
    });
    expect(internals.evaluateAchievementUnlocks()).toEqual([{ userId: "priest-user", achievementId: "guardian_save" }]);
    const publicEvents = persist.mock.calls.filter(([, event]) => event?.visibility === "public");
    expect(JSON.stringify(publicEvents)).not.toMatch(/priest-user|blessed-user/);
    expect(JSON.stringify(room.state.publicEvents.toJSON())).not.toMatch(/priest-user|blessed-user/);
  });

  describe("guardian save resolution cycles", () => {
    async function setup() {
      const roles: Record<string, RoleCode> = {
        healer: "healer", wolf: "werewolf", witch: "witch", hunter: "hunter",
        a: "ordinary_villager", b: "ordinary_villager", source: "ordinary_villager",
        partner: "ordinary_villager", c: "ordinary_villager",
      };
      const room = await colyseus.createRoom<GameRoom>("game", {
        code: "GDSV23", mode: "werewolves_classic", playerCount: 9,
        tempoProfile: "manual", mayorEnabled: false,
      });
      const internals = room as unknown as {
        privatePlayers: Map<string, PrivatePlayerState>;
        pendingNightActions: Map<string, SubmittedNightAction[]>;
        resolveNightPhase: () => void;
        resolveVoting: () => void;
        transitionTo: (phase: string) => void;
        submitHunterRevenge: (client: { sessionId: string; userData: { userId: string }; send: ReturnType<typeof vi.fn> }, target: string) => void;
        evaluateAchievementUnlocks: () => Array<{ userId: string; achievementId: string }>;
        achievementBroadcaster: { recordEvent: (event: AchievementEventLike) => void };
      };
      for (const [userId, role] of Object.entries(roles)) {
        const player = new PlayerPublicState();
        player.userId = userId;
        player.displayName = userId;
        player.alive = true;
        player.playing = true;
        room.state.players.set(userId, player);
        internals.privatePlayers.set(userId, { userId, role, alive: true });
      }
      const recorded = vi.spyOn(internals.achievementBroadcaster, "recordEvent");
      const events = () => recorded.mock.calls.map(([event]) => event);
      const resolveNight = (round: number, actions: SubmittedNightAction[]) => {
        room.state.round = round;
        internals.transitionTo(round === 1 ? "first_night" : "night");
        for (const action of actions) {
          internals.pendingNightActions.set(action.actorUserId, [action]);
        }
        internals.resolveNightPhase();
      };
      const revenge = (target: string) => internals.submitHunterRevenge({
        sessionId: "hunter", userData: { userId: "hunter" }, send: vi.fn(),
      }, target);
      const linkLovers = (a: string, b: string) => {
        internals.privatePlayers.get(a)!.loverId = b;
        internals.privatePlayers.get(b)!.loverId = a;
      };
      const guardians = () => internals.evaluateAchievementUnlocks()
        .filter((unlock) => unlock.achievementId === "guardian_save");
      return { room, internals, events, resolveNight, revenge, linkLovers, guardians };
    }

    function protect(targetUserId: string): SubmittedNightAction[] {
      return [
        { actorUserId: "wolf", action: { kind: "faction_kill", targetUserId } },
        { actorUserId: "healer", action: { kind: "healer_protect", targetUserId } },
      ];
    }

    function poison(targetUserId: string): SubmittedNightAction {
      return { actorUserId: "witch", action: { kind: "witch_poison", targetUserId } };
    }

    it.each(["hunter", "lover", "lover-hunter-lover"])(
      "excludes a prevented attack followed by a same-night %s death chain", async (chain) => {
        const { room, events, resolveNight, revenge, linkLovers, guardians } = await setup();
        resolveNight(1, protect("a"));
        expect(room.state.phase).toBe("day_announcement");
        if (chain === "lover") {
          linkLovers("source", "b");
        } else if (chain === "lover-hunter-lover") {
          linkLovers("source", "hunter");
          linkLovers("partner", "b");
        }
        resolveNight(2, [...protect("b"), poison(chain === "hunter" ? "hunter" : "source")]);
        if (chain !== "lover") {
          expect(room.state.phase).toBe("hunter_revenge");
          expect(room.state.players.get("b")?.alive).toBe(true);
          revenge(chain === "hunter" ? "b" : "partner");
        }
        expect(room.state.phase).toBe("day_announcement");
        expect(room.state.players.get("b")?.alive).toBe(false);
        expect(events()).toContainEqual(expect.objectContaining({
          type: "night_death_prevented", phase: "night", round: 2, actorId: "healer", targetId: "b",
        }));
        expect(events().filter((event) => event.type === "death").map((event) => [event.targetId, event.phase]))
          .toEqual(chain === "hunter" ? [["hunter", "night"], ["b", "hunter_revenge"]]
            : chain === "lover" ? [["source", "night"], ["b", "night"]]
              : [["source", "night"], ["hunter", "night"], ["partner", "hunter_revenge"], ["b", "hunter_revenge"]]);
        expect(guardians()).toEqual([]);
      },
    );

    it("preserves genuine saves when a daytime ballot triggers hunter and lover deaths", async () => {
      const { room, internals, events, resolveNight, revenge, linkLovers, guardians } = await setup();
      resolveNight(1, protect("a"));
      resolveNight(2, protect("b"));
      expect(room.state.phase).toBe("day_announcement");
      linkLovers("partner", "b");
      internals.transitionTo("voting");
      internals.privatePlayers.get("a")!.lastVoteTarget = "hunter";
      internals.resolveVoting();
      expect(room.state.phase).toBe("hunter_revenge");
      revenge("partner");
      expect(room.state.phase).toBe("resolution");
      expect(room.state.players.get("b")?.alive).toBe(false);
      expect(events()).toContainEqual(expect.objectContaining({
        type: "death", phase: "hunter_revenge", round: 2, targetId: "b",
      }));
      expect(guardians()).toEqual([{ userId: "healer", achievementId: "guardian_save" }]);
    });

    it.each(["night", "hunter_revenge"])("preserves saves when the target dies the following night in %s", async (phase) => {
      const { room, events, resolveNight, revenge, guardians } = await setup();
      resolveNight(1, protect("b"));
      resolveNight(2, protect("b"));
      resolveNight(3, [poison(phase === "night" ? "b" : "hunter")]);
      if (phase === "hunter_revenge") {
        expect(room.state.phase).toBe("hunter_revenge");
        revenge("b");
      }
      expect(room.state.phase).toBe("day_announcement");
      expect(room.state.players.get("b")?.alive).toBe(false);
      expect(events()).toContainEqual(expect.objectContaining({ type: "death", phase, round: 3, targetId: "b" }));
      expect(guardians()).toEqual([{ userId: "healer", achievementId: "guardian_save" }]);
    });
  });

  it("captures only final living voters and checks every completed revote", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "VTSV23", mode: "werewolves_classic", playerCount: 6, tempoProfile: "manual",
    });
    const internals = room as unknown as Omit<GameRoomPersistenceInternals, "privatePlayers"> & {
      privatePlayers: Map<string, PrivatePlayerState>;
      submitVote: (client: { userData: { userId: string }; sessionId: string; send: ReturnType<typeof vi.fn> }, targetUserId: string) => void;
      resolveVoting: () => void;
      transitionTo: (phase: string) => void;
      evaluateAchievementUnlocks: () => Array<{ userId: string; achievementId: string }>;
    };
    for (const userId of ["cast", "skipped", "idle", "dead"]) {
      const player = new PlayerPublicState();
      player.userId = userId;
      player.alive = userId !== "dead";
      player.playing = true;
      room.state.players.set(userId, player);
      internals.privatePlayers.set(userId, {
        userId, role: "ordinary_villager", alive: player.alive,
        ...(userId === "dead" ? { lastVoteTarget: "idle" } : {}),
      });
    }
    room.state.phase = "voting";
    room.state.round = 2;
    const persist = vi.spyOn(internals, "persistGameEvent");
    vi.spyOn(internals, "transitionTo").mockImplementation(() => {});
    // Keep all players alive while inspecting the completed ballot snapshots.
    const deathInternals = room as unknown as { applyDeaths: () => unknown[] };
    vi.spyOn(deathInternals, "applyDeaths").mockImplementation(() => []);
    const cast = { userData: { userId: "cast" }, sessionId: "cast", send: vi.fn() };
    const skipped = { userData: { userId: "skipped" }, sessionId: "skipped", send: vi.fn() };
    internals.submitVote(cast, "skip");
    internals.submitVote(cast, "idle");
    internals.submitVote(skipped, "idle");
    internals.submitVote(skipped, "skip");
    internals.resolveVoting();

    expect(persist).toHaveBeenCalledWith("vote_tally", expect.objectContaining({
      visibility: "moderator", payload: expect.objectContaining({ voters: [{ userId: "cast" }] }),
    }));
    expect(internals.evaluateAchievementUnlocks()).toContainEqual({ userId: "cast", achievementId: "silent_civilian" });
    expect(internals.evaluateAchievementUnlocks().filter((unlock) => unlock.achievementId === "silent_civilian"))
      .toHaveLength(1);

    // A new completed ballot in the same round must have its own participation.
    internals.resolveVoting();
    expect(internals.evaluateAchievementUnlocks().filter((unlock) => unlock.achievementId === "silent_civilian"))
      .toEqual([]);
  });
});
