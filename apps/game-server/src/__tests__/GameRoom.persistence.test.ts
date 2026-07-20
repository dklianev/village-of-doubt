import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
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

    internals.transitionTo("game_over");

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
    expect(persistence.upsertPlayers).toHaveBeenCalledWith(
      "game-1",
      expect.arrayContaining([
        expect.objectContaining({ userId: "winner", won: true }),
        expect.objectContaining({ userId: "jester", won: true }),
      ]),
    );
    expect(vi.mocked(persistence.upsertPlayers).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(persistence.finishGame).mock.invocationCallOrder[0] ?? Infinity);
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
      expect.objectContaining({ message: expect.stringContaining("terminal") }),
    );
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
});
