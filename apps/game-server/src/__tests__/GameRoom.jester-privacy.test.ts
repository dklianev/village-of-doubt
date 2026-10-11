import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { AchievementEventLike, GameConfig, GamePhase, RoleCode, WinResult } from "@werewolf/shared";
import appConfig from "../app.config.js";
import type { SubmittedNightAction } from "../game-logic/night-resolver.js";
import type { GamePersistence } from "../persistence/game-persistence.js";
import type { AchievementBroadcaster, AchievementUnlock } from "../rooms/achievement-broadcaster.js";
import type { GameRoom } from "../rooms/GameRoom.js";
import type { PrivatePlayerState } from "../rooms/game-room-runtime.js";
import { RoomPersistenceCoordinator } from "../rooms/room-persistence-coordinator.js";
import { PlayerPublicState } from "../rooms/schemas/GameState.js";

interface RoomInternals {
  config: GameConfig;
  hostUserId: string;
  privatePlayers: Map<string, PrivatePlayerState>;
  personalWinnerUserIds: Set<string>;
  pendingNightActions: Map<string, SubmittedNightAction[]>;
  persistenceCoordinator: RoomPersistenceCoordinator;
  achievementBroadcaster: AchievementBroadcaster;
  recordedGameId?: string;
  transitionTo: (phase: GamePhase) => void;
  resolveVoting: () => void;
  resolveNightPhase: () => void;
  evaluateWin: () => WinResult;
  applyDeaths: (deaths: Array<{ userId: string; causeBg: string }>) => unknown[];
  rememberDelayedVampireBites: (deaths: Array<{ userId: string; causeBg: string }>) => void;
  applyPendingVampireBites: () => unknown[];
  submitHunterRevenge: (client: {
    sessionId: string;
    userData: { userId: string };
    send: ReturnType<typeof vi.fn>;
  }, targetUserId: string) => void;
  sendAchievementUnlocks: (unlocks: AchievementUnlock[]) => void;
}

function makePersistence() {
  return {
    enabled: true,
    ensureGame: vi.fn<GamePersistence["ensureGame"]>(async () => "jester-game"),
    markGameActive: vi.fn<GamePersistence["markGameActive"]>(async () => {}),
    upsertPlayers: vi.fn<GamePersistence["upsertPlayers"]>(async () => {}),
    recordEvent: vi.fn<GamePersistence["recordEvent"]>(async () => {}),
    recordAchievement: vi.fn<GamePersistence["recordAchievement"]>(async () => {}),
    finishGame: vi.fn<GamePersistence["finishGame"]>(async () => {}),
    recordGameCompletion: vi.fn<GamePersistence["recordGameCompletion"]>(async () => {}),
  } satisfies GamePersistence;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("GameRoom Jester death and terminal persistence privacy", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    // Synthetic clients join with dev identities, like the other GameRoom suites; never rely on ambient env.
    vi.stubEnv("ALLOW_DEV_AUTH", "true");
    vi.stubEnv("GAME_TOKEN_SECRET", "jester-privacy-secret-that-is-long-enough");
    vi.stubEnv("NODE_ENV", "test");
    colyseus = await boot(appConfig, 2697);
  });
  afterEach(async () => {
    await colyseus.cleanup();
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    await colyseus.shutdown();
    vi.unstubAllEnvs();
  });

  describe.each(["mafia_free", "werewolves_classic"] as const)("%s preset room settings", (mode) => {
    it.each([
      { planned: 10, actual: 6, requested: true },
      { planned: 10, actual: 6, requested: false },
      { planned: 10, actual: 8, requested: true },
      { planned: 10, actual: 8, requested: false },
      { planned: 6, actual: 8, requested: true },
      { planned: 6, actual: 8, requested: false },
    ])("preserves requested=$requested when $planned intended seats become $actual players", async ({ planned, actual, requested }) => {
      const room = await colyseus.createRoom<GameRoom>("game", {
        code: "JESCFG", mode, playerCount: planned, maxPlayers: 10,
        jesterEnabled: true, revealRolesOnDeath: requested,
      });
      const internals = room as unknown as RoomInternals;
      const clients = [];
      for (let i = 0; i < actual; i++) {
        const client = await colyseus.connectTo(room, {
          code: room.state.code, userId: `synthetic-${room.roomId}-${i}`, displayName: `Synthetic ${i}`,
        });
        client.onMessage("private_faction_roster", () => {});
        clients.push(client);
      }
      const roleMessages = clients.map((client) => client.waitForMessage("private_role"));
      clients[0]!.send("startGame", {});
      await Promise.all(roleMessages);

      const hasJester = actual >= 8;
      const effectiveReveal = hasJester ? false : requested;
      expect(room.state.phase).toBe("role_reveal");
      expect(internals.config.playerCount).toBe(actual);
      expect(internals.config.roles.jester ?? 0).toBe(hasJester ? 1 : 0);
      expect(internals.config.requestedRevealRolesOnDeath).toBe(requested);
      expect(room.state.revealRolesOnDeath).toBe(effectiveReveal);
      expect(JSON.parse(room.state.nextRoomOptionsJson).revealRolesOnDeath).toBe(requested);

      const player = internals.privatePlayers.get(`synthetic-${room.roomId}-0`)!;
      internals.applyDeaths([{ userId: player.userId, causeBg: "Synthetic elimination." }]);
      const publicPlayer = [...room.state.players.values()].find((entry) => entry.userId === player.userId)!;
      expect(publicPlayer.revealedRole).toBe(effectiveReveal ? player.role : "");
    });
  });

  async function setup(retryDelay: (attempt: number) => Promise<void> = async () => {}) {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "JESPRV", mode: "werewolves_classic", playerCount: 8,
      tempoProfile: "manual", mayorEnabled: false, revealRolesOnDeath: true,
      roles: { jester: 1, werewolf: 1, hunter: 1, ordinary_villager: 5 },
    });
    const internals = room as unknown as RoomInternals;
    const roles: Record<string, RoleCode> = {
      jester: "jester", wolf: "werewolf", hunter: "hunter", voter: "ordinary_villager",
      partner: "ordinary_villager", guard: "ordinary_villager",
      otherA: "ordinary_villager", otherB: "ordinary_villager",
    };
    for (const [userId, role] of Object.entries(roles)) {
      const player = new PlayerPublicState();
      player.userId = userId;
      player.displayName = `Synthetic ${userId}`;
      player.playing = true;
      player.alive = true;
      room.state.players.set(userId, player);
      internals.privatePlayers.set(userId, { userId, role, alive: true });
    }
    internals.hostUserId = "voter";
    room.state.round = 2;
    const persistence = makePersistence();
    const coordinator = new RoomPersistenceCoordinator(persistence, vi.fn(), retryDelay);
    internals.persistenceCoordinator = coordinator;
    const queued = vi.spyOn(coordinator, "queue");
    const broadcast = vi.spyOn(room, "broadcast");
    const awards = vi.spyOn(internals, "sendAchievementUnlocks");
    const events = () => persistence.recordEvent.mock.calls.map(([, event]) => event);
    const finalEvents = () => events().filter((event) => event.type === "reveal" && event.phase === "game_over");
    const announcements = () => [...room.state.publicEvents.values()]
      .filter((event) => event.messageBg.includes("беше Шут"));
    const recordedMessages = () => broadcast.mock.calls.filter(([type]) => type === "game_recorded");
    const voteOut = (target: string) => {
      room.state.phase = "voting";
      for (const player of internals.privatePlayers.values()) {
        if (player.alive && player.userId !== target) player.lastVoteTarget = target;
      }
      internals.resolveVoting();
    };
    const finish = () => {
      internals.applyDeaths([{ userId: "wolf", causeBg: "Eliminated for the finale fixture." }]);
      const win = internals.evaluateWin();
      expect(win.winner).toBe("village");
      room.state.winnerTeam = win.winner!;
      room.state.winnerReasonBg = win.reasonBg ?? "";
      internals.transitionTo("game_over");
    };
    const expectNoPersonalWin = async () => {
      expect(await coordinator.flush(1_000)).toBe(true);
      expect(internals.personalWinnerUserIds.size).toBe(0);
      expect(internals.evaluateWin().personalWinnerPlayerIds).toEqual([]);
      expect(events().some((event) => event.type === "jester_personal_win")).toBe(false);
      expect(announcements()).toHaveLength(0);
      expect(awards).not.toHaveBeenCalled();
      expect(room.state.players.get("jester")?.revealedRole).toBe("");
    };
    return { room, internals, persistence, coordinator, queued, awards, events, finalEvents,
      announcements, recordedMessages, voteOut, finish, expectNoPersonalWin };
  }

  it("does not award a Jester whose mayor elimination is blocked by the guard dog", async () => {
    const fixture = await setup();
    // Model the public mayor title and a living manual-role protector directly.
    fixture.room.state.players.get("jester")!.mayor = true;
    fixture.internals.privatePlayers.get("jester")!.isMayor = true;
    fixture.internals.privatePlayers.get("guard")!.role = "guard_dog";

    fixture.voteOut("jester");

    expect(fixture.room.state.players.get("jester")?.alive).toBe(true);
    expect(fixture.internals.privatePlayers.get("jester")?.alive).toBe(true);
    await fixture.expectNoPersonalWin();
    expect(fixture.events()).toContainEqual(expect.objectContaining({
      type: "guard_dog_protected_mayor", targetId: "jester",
    }));
    expect(fixture.events().some((event) => event.type === "death" && event.targetId === "jester")).toBe(false);
  });

  it("does not award a Jester who dies with the lover targeted by the vote", async () => {
    const fixture = await setup();
    fixture.internals.privatePlayers.get("jester")!.loverId = "partner";
    fixture.internals.privatePlayers.get("partner")!.loverId = "jester";

    fixture.voteOut("partner");

    expect(fixture.room.state.players.get("partner")?.alive).toBe(false);
    expect(fixture.room.state.players.get("jester")?.alive).toBe(false);
    await fixture.expectNoPersonalWin();
    expect(fixture.events().filter((event) => event.type === "death").map((event) => event.targetId))
      .toEqual(["partner", "jester"]);
  });

  it.each(["hunter", "delayed bite"] as const)("does not award a Jester killed by %s instead of the ballot", async (cause) => {
    const fixture = await setup();
    if (cause === "hunter") {
      fixture.voteOut("hunter");
      expect(fixture.room.state.phase).toBe("hunter_revenge");
      fixture.internals.submitHunterRevenge({
        sessionId: "hunter", userData: { userId: "hunter" }, send: vi.fn(),
      }, "jester");
    } else {
      fixture.room.state.phase = "resolution";
      fixture.internals.rememberDelayedVampireBites([{ userId: "jester", causeBg: "Delayed bite." }]);
      expect(fixture.internals.applyPendingVampireBites()).toHaveLength(1);
    }

    expect(fixture.room.state.players.get("jester")?.alive).toBe(false);
    await fixture.expectNoPersonalWin();
    expect(fixture.events()).toContainEqual(expect.objectContaining({
      type: "death", targetId: "jester", payload: expect.objectContaining({ revealRole: null }),
    }));
  });

  it("persists final structured reveals and the award after achievement history was truncated", async () => {
    const fixture = await setup();
    fixture.voteOut("jester");
    expect(await fixture.coordinator.flush(1_000)).toBe(true);
    expect(fixture.events()).toContainEqual(expect.objectContaining({
      type: "jester_personal_win", actorId: "jester", targetId: "jester", visibility: "private",
    }));
    expect(fixture.awards).not.toHaveBeenCalled();

    // Seed an already-truncated buffer; cap mechanics have separate multiplayer coverage.
    const history = fixture.internals.achievementBroadcaster as unknown as {
      events: AchievementEventLike[];
      eventsTruncated: boolean;
    };
    history.events.splice(0, history.events.length,
      ...Array.from({ length: 500 }, () => ({ type: "phase_change", phase: "resolution", round: 2 })));
    history.eventsTruncated = true;
    expect(fixture.internals.achievementBroadcaster.evaluateUnlocks({ players: [] }))
      .not.toContainEqual(expect.objectContaining({ achievementId: "jester_win" }));

    fixture.finish();
    expect(await fixture.coordinator.flush(1_000)).toBe(true);

    const finalEvents = fixture.finalEvents();
    expect(finalEvents).toHaveLength(2);
    expect(finalEvents[0]).toMatchObject({ visibility: "public", payload: {
      roles: [...fixture.internals.privatePlayers.values()].map(({ userId, role }) => ({ userId, role })),
    } });
    expect(finalEvents[1]).toMatchObject({
      visibility: "public", targetId: "jester", payload: { role: "jester", personalWin: true },
    });
    for (const event of finalEvents) {
      expect(event.payload).not.toHaveProperty("messageBg");
      expect(JSON.stringify(event.payload)).not.toContain("Synthetic");
    }
    const completion = fixture.persistence.recordGameCompletion.mock.calls[0]![1];
    expect(completion.players).toContainEqual(expect.objectContaining({ userId: "jester", won: true }));
    expect(completion.achievements?.filter((award) => award.achievementId === "jester_win"))
      .toEqual([{ userId: "jester", achievementId: "jester_win" }]);
    expect(fixture.persistence.recordEvent.mock.invocationCallOrder.at(-1))
      .toBeLessThan(fixture.persistence.recordGameCompletion.mock.invocationCallOrder[0]!);
    expect(fixture.queued.mock.calls.filter(([, , options]) => options?.terminal).map(([, , options]) => options))
      .toEqual([{ priority: "critical", terminal: true, maxAttempts: 3 }]);
    expect(fixture.announcements()).toHaveLength(1);
    expect(fixture.recordedMessages()).toHaveLength(1);
  });

  it.each(["reveal", "completion"] as const)("retries a failed final %s with stable keys and waits before announcing a recorded game", async (failure) => {
    const retry = deferred();
    const completion = deferred();
    const retryDelay = vi.fn(() => retry.promise);
    const fixture = await setup(retryDelay);
    fixture.voteOut("jester");
    expect(await fixture.coordinator.flush(1_000)).toBe(true);
    let failed = false;
    fixture.persistence.recordEvent.mockImplementation(async (_gameId, event) => {
      if (failure === "reveal" && event.type === "reveal" && event.targetId === "jester" && !failed) {
        failed = true;
        throw new Error("Synthetic final reveal write failure");
      }
    });
    fixture.persistence.recordGameCompletion.mockImplementation(async () => {
      if (failure === "completion" && !failed) {
        failed = true;
        throw new Error("Synthetic completion write failure");
      }
      await completion.promise;
    });

    try {
      fixture.finish();
      await expect.poll(() => retryDelay.mock.calls.length).toBe(1);
      expect(fixture.persistence.recordGameCompletion).toHaveBeenCalledTimes(failure === "completion" ? 1 : 0);
      expect(fixture.internals.recordedGameId).toBeUndefined();
      expect(fixture.recordedMessages()).toHaveLength(0);
      expect(fixture.awards).not.toHaveBeenCalled();

      retry.resolve();
      await expect.poll(() => fixture.persistence.recordGameCompletion.mock.calls.length)
        .toBe(failure === "completion" ? 2 : 1);
      expect(fixture.recordedMessages()).toHaveLength(0);
      expect(fixture.internals.recordedGameId).toBeUndefined();
      expect(fixture.awards).not.toHaveBeenCalled();

      completion.resolve();
      expect(await fixture.coordinator.flush(1_000)).toBe(true);
      const reveals = fixture.finalEvents();
      expect(reveals).toHaveLength(4);
      const firstKeys = reveals.slice(0, 2).map((event) => event.idempotencyKey);
      expect(firstKeys[0]).toEqual(expect.stringMatching(/:final-reveal-0$/));
      expect(firstKeys[1]).toEqual(expect.stringMatching(/:final-reveal-1$/));
      expect(reveals.slice(2).map((event) => event.idempotencyKey)).toEqual(firstKeys);
      expect(fixture.internals.recordedGameId).toBe("jester-game");
      expect(fixture.recordedMessages()).toHaveLength(1);
      expect(fixture.awards).toHaveBeenCalledOnce();
      expect(fixture.announcements()).toHaveLength(1);

      fixture.internals.transitionTo("game_over");
      expect(await fixture.coordinator.flush(1_000)).toBe(true);
      expect(fixture.queued.mock.calls.filter(([, , options]) => options?.terminal)).toHaveLength(1);
      expect(fixture.finalEvents()).toHaveLength(4);
      expect(fixture.announcements()).toHaveLength(1);
      expect(fixture.recordedMessages()).toHaveLength(1);
    } finally {
      retry.resolve();
      completion.resolve();
      await fixture.coordinator.flush(1_000);
    }
  });

  it("reveals a night-dead Jester at the finale without a personal win or award", async () => {
    const fixture = await setup();
    fixture.room.state.phase = "night";
    fixture.internals.pendingNightActions.set("wolf", [{
      actorUserId: "wolf", action: { kind: "faction_kill", targetUserId: "jester" },
    }]);
    fixture.internals.resolveNightPhase();
    expect(fixture.room.state.players.get("jester")?.alive).toBe(false);
    await fixture.expectNoPersonalWin();

    fixture.finish();
    expect(await fixture.coordinator.flush(1_000)).toBe(true);

    expect(fixture.room.state.players.get("jester")?.revealedRole).toBe("jester");
    expect([...fixture.room.state.players.values()].every((player) => Boolean(player.revealedRole))).toBe(true);
    expect(fixture.finalEvents()).toHaveLength(1);
    expect(fixture.finalEvents()[0]?.payload).toMatchObject({ roles: expect.arrayContaining([
      { userId: "jester", role: "jester" },
    ]) });
    const result = fixture.persistence.recordGameCompletion.mock.calls[0]![1];
    expect(result.players).toContainEqual(expect.objectContaining({ userId: "jester", won: false }));
    expect(result.achievements).not.toContainEqual(expect.objectContaining({ achievementId: "jester_win" }));
    expect(fixture.events().some((event) => event.type === "jester_personal_win")).toBe(false);
    expect(fixture.announcements()).toHaveLength(0);
  });
});
