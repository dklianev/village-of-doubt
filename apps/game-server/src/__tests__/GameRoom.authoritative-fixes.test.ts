import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { NightActionCapabilities } from "@werewolf/shared";
import appConfig from "../app.config.js";
import type { GameRoom } from "../rooms/GameRoom.js";
import type { PrivatePlayerState } from "../rooms/game-room-runtime.js";
import { PlayerPublicState } from "../rooms/schemas/GameState.js";
import type { RoomPersistenceContext } from "../rooms/room-persistence-coordinator.js";
import {
  advanceToFirstNight,
  advanceToPhase,
  connectPlayers,
  connectWithRetry,
  delay,
  findPublicPlayer,
  publicEvents,
  restoreEnvValue,
  startGameAndCollectRoles,
  waitForCondition,
} from "./helpers.js";

describe("GameRoom authoritative gameplay boundaries", () => {
  let colyseus: ColyseusTestServer;
  let previousAllowDevAuth: string | undefined;
  let previousNodeEnv: string | undefined;

  beforeAll(async () => {
    previousAllowDevAuth = process.env.ALLOW_DEV_AUTH;
    previousNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "test";
    colyseus = await boot(appConfig, 2685);
  });

  afterEach(async () => {
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
    restoreEnvValue("ALLOW_DEV_AUTH", previousAllowDevAuth);
    restoreEnvValue("NODE_ENV", previousNodeEnv);
  });

  it("does not expose submitted night activity through public player state", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "ACTSEC",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: { ordinary_villager: 5, werewolf: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "acted-private");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const werewolf = roles.find((item) => item.role === "werewolf");
    const target = roles.find((item) => item.role === "ordinary_villager");
    const ack = werewolf?.client.waitForMessage("night_action_ack") as Promise<unknown>;

    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: target?.userId },
    });
    await ack;
    await room.waitForNextPatch(25).catch(() => undefined);

    for (const player of room.state.players.values()) {
      expect(player.actedThisPhase).toBe(false);
    }
  });

  it("moves hidden role-bound state with a role stolen on the first night", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "THFSTA",
      mode: "werewolves_classic",
      playerCount: 6,
      mayorMode: "secret_role",
    });
    const actor = new PlayerPublicState();
    actor.userId = "thief-user";
    actor.displayName = "Крадец";
    actor.playing = true;
    actor.alive = true;
    const target = new PlayerPublicState();
    target.userId = "target-user";
    target.displayName = "Цел";
    target.playing = true;
    target.alive = true;
    room.state.players.set("thief-session", actor);
    room.state.players.set("target-session", target);
    room.state.phase = "first_night";

    const internals = room as unknown as {
      privatePlayers: Map<string, PrivatePlayerState>;
      config: { mayorMode: string };
      applyThiefSteal: (
        actor: PlayerPublicState,
        thief: PrivatePlayerState,
        targetUserId: string,
      ) => void;
    };
    const thiefState: PrivatePlayerState = { userId: actor.userId, role: "thief", alive: true };
    const targetState: PrivatePlayerState = {
      userId: target.userId,
      role: "drunk",
      alive: true,
      drunkRealRole: "seer",
    };
    internals.privatePlayers.set(actor.userId, thiefState);
    internals.privatePlayers.set(target.userId, targetState);

    internals.applyThiefSteal(actor, thiefState, target.userId);

    expect(thiefState).toMatchObject({ role: "drunk", drunkRealRole: "seer" });
    expect(targetState.role).toBe("ordinary_villager");
    expect(targetState).not.toHaveProperty("drunkRealRole");

    thiefState.role = "thief";
    delete thiefState.drunkRealRole;
    targetState.role = "mayor";
    targetState.isMayor = true;
    internals.applyThiefSteal(actor, thiefState, target.userId);

    expect(thiefState).toMatchObject({ role: "mayor", isMayor: true });
    expect(targetState).toMatchObject({ role: "ordinary_villager", isMayor: false });
  });

  it("keeps spectators outside the player roster when the narrator changes", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "NARSPE",
      mode: "mafia_free",
      playerCount: 4,
      narratorMode: "honest_human",
      tempoProfile: "manual",
    });
    const participants = await connectPlayers(colyseus, room, 5, "narrator-swap");
    await connectWithRetry(colyseus, room, {
      code: room.state.code,
      userId: "narrator-spectator",
      displayName: "Наблюдател",
      spectator: true,
    });

    participants[0]?.client.send("setNarrator", {
      targetUserId: participants[1]?.userId,
      narrator: true,
    });
    await room.waitForNextPatch(25).catch(() => undefined);

    expect(findPublicPlayer(room, "narrator-spectator")).toMatchObject({
      playing: false,
      alive: false,
      narrator: false,
    });
  });

  it("rejects unknown and allied faction targets before acknowledging the action", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "TGTVAL",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: { ordinary_villager: 4, werewolf: 2 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "target-validation");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const wolves = roles.filter((item) => item.role === "werewolf");

    const unknownError = wolves[0]?.client.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    wolves[0]?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: "outside-this-room" },
    });
    await expect(unknownError).resolves.toMatchObject({
      messageBg: "Целта не е жив активен играч.",
    });

    const alliedError = wolves[0]?.client.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    wolves[0]?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: wolves[1]?.userId },
    });
    await expect(alliedError).resolves.toMatchObject({
      messageBg: "Не можеш да избереш свой съотборник.",
    });
  });

  it("rejects an invalid one-shot target before persistence or resource consumption", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "PNETGT",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: { investigator: 1, ordinary_villager: 4, werewolf: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "one-shot-target");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const investigator = roles.find((item) => item.role === "investigator");
    const validTarget = roles.find((item) => item.role === "ordinary_villager");
    const queue = vi.fn(() => true);
    const internals = room as unknown as {
      privatePlayers: Map<string, PrivatePlayerState>;
      persistenceCoordinator: {
        queue: (context: RoomPersistenceContext, task: () => Promise<void>) => boolean;
        flush: (timeoutMs: number) => Promise<boolean>;
        dispose: (timeoutMs: number) => Promise<boolean>;
      };
    };
    internals.persistenceCoordinator = {
      queue,
      flush: vi.fn(async () => true),
      dispose: vi.fn(async () => true),
    };

    const error = investigator?.client.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    investigator?.client.send("submitNightAction", {
      action: { kind: "investigator_check", targetUserId: "outside-this-room" },
    });
    await expect(error).resolves.toMatchObject({ messageBg: "Целта не е жив активен играч." });
    expect(queue).not.toHaveBeenCalled();
    expect(internals.privatePlayers.get(investigator?.userId ?? "")?.investigatorUsed).not.toBe(true);

    const ack = investigator?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    investigator?.client.send("submitNightAction", {
      action: { kind: "investigator_check", targetUserId: validTarget?.userId },
    });
    await expect(ack).resolves.toBeTruthy();
    expect(queue).toHaveBeenCalledTimes(1);
  });

  it("lets the Don vote for the faction kill and investigate in the same night", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "DPNDUP",
      mode: "mafia_free",
      playerCount: 4,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: { civilian: 1, commissioner: 1, mafioso: 1, don: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 4, "don-dual");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const don = roles.find((item) => item.role === "don");
    const mafioso = roles.find((item) => item.role === "mafioso");
    const commissioner = roles.find((item) => item.role === "commissioner");
    const victim = roles.find((item) => item.role === "civilian");
    const result = don?.client.waitForMessage("private_check_result") as Promise<{
      targetUserId: string;
      isCommissioner: boolean;
    }>;

    don?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: victim?.userId },
    });
    await room.waitForNextPatch(20).catch(() => undefined);
    don?.client.send("submitNightAction", {
      action: { kind: "check_commissioner", targetUserId: commissioner?.userId },
    });
    await room.waitForNextPatch(20).catch(() => undefined);
    mafioso?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: victim?.userId },
    });
    await room.waitForNextPatch(20).catch(() => undefined);
    clients[0]?.client.send("narratorAdvance", {});

    await expect(result).resolves.toMatchObject({
      targetUserId: commissioner?.userId,
      isCommissioner: true,
    });
    expect(findPublicPlayer(room, victim?.userId)?.alive).toBe(false);
  });

  it("rejects a vote against the acting player's lover", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "LPVVPT",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      loversEnabled: true,
      roles: { cupid: 1, ordinary_villager: 4, werewolf: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "lover-vote");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const cupid = roles.find((item) => item.role === "cupid");
    const lovers = roles.filter((item) => item.userId !== cupid?.userId).slice(0, 2);
    const cupidAck = cupid?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    cupid?.client.send("submitNightAction", {
      action: {
        kind: "cupid_link",
        firstUserId: lovers[0]?.userId,
        secondUserId: lovers[1]?.userId,
      },
    });
    await cupidAck;
    await advanceToPhase(clients[0]?.client, room, "voting");

    const error = lovers[0]?.client.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    lovers[0]?.client.send("submitVote", { targetUserId: lovers[1]?.userId });

    await expect(error).resolves.toMatchObject({
      messageBg: "Влюбените не могат да гласуват един срещу друг.",
    });
  });

  it("does not reveal an exact role hidden by the Lawyer", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "LAWEXA",
      mode: "mafia_free",
      playerCount: 4,
      tempoProfile: "manual",
      commissionerResultMode: "exact_role",
      roles: { lawyer: 1, commissioner: 1, civilian: 1, mafioso: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 4, "lawyer-exact");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const lawyer = roles.find((item) => item.role === "lawyer");
    const commissioner = roles.find((item) => item.role === "commissioner");
    const mafioso = roles.find((item) => item.role === "mafioso");
    const result = commissioner?.client.waitForMessage("private_check_result") as Promise<{
      role?: string;
      isEvil: boolean;
    }>;

    lawyer?.client.send("submitNightAction", {
      action: { kind: "lawyer_cover", targetUserId: mafioso?.userId },
    });
    await room.waitForNextPatch(20).catch(() => undefined);
    commissioner?.client.send("submitNightAction", {
      action: { kind: "check_alignment", targetUserId: mafioso?.userId },
    });
    await room.waitForNextPatch(20).catch(() => undefined);
    clients[0]?.client.send("narratorAdvance", {});

    const payload = await result;
    expect(payload.isEvil).toBe(false);
    expect(payload.role).toBeUndefined();
  });

  it("protects the Cook without identifying the role publicly", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "CPPKPV",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: { cook: 1, ordinary_villager: 4, werewolf: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "cook-private");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const wolf = roles.find((item) => item.role === "werewolf");
    const cook = roles.find((item) => item.role === "cook");

    wolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: cook?.userId },
    });
    await room.waitForNextPatch(20).catch(() => undefined);
    clients[0]?.client.send("narratorAdvance", {});
    await room.waitForNextPatch(20).catch(() => undefined);

    expect(findPublicPlayer(room, cook?.userId)?.alive).toBe(true);
    expect(publicEvents(room).some((message) => message.includes("Готвач"))).toBe(false);
  });

  it("does not disarm the Vampire Hunter when protection prevents the innocent death", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "VHSAFE",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: {
        priest: 1,
        vampire_hunter: 1,
        blacksmith: 1,
        witch: 1,
        ordinary_villager: 1,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, room, 6, "hunter-safe");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const priest = roles.find((item) => item.role === "priest");
    const hunter = roles.find((item) => item.role === "vampire_hunter");
    const innocent = roles.find((item) => item.role === "ordinary_villager");
    const werewolf = roles.find((item) => item.role === "werewolf");

    priest?.client.send("submitNightAction", {
      action: { kind: "priest_bless", targetUserId: innocent?.userId },
    });
    await room.waitForNextPatch(20).catch(() => undefined);
    hunter?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: innocent?.userId },
    });
    await room.waitForNextPatch(20).catch(() => undefined);
    clients[0]?.client.send("narratorAdvance", {});
    await advanceToPhase(clients[0]?.client, room, "night");

    const ack = hunter?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    hunter?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: werewolf?.userId },
    });
    await expect(ack).resolves.toBeTruthy();
  });

  it("keeps a pending Priest blessing replaceable until the night resolves", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "PRSWAP",
      mode: "werewolves_classic",
      playerCount: 7,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: {
        priest: 1,
        blacksmith: 1,
        vampire_hunter: 1,
        witch: 1,
        ordinary_villager: 2,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, room, 7, "priest-swap");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const priest = roles.find((item) => item.role === "priest");
    const targets = roles.filter((item) => item.role === "ordinary_villager").slice(0, 2);

    const firstAck = priest?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    const capabilities = priest?.client.waitForMessage("night_action_capabilities") as Promise<{
      capabilities: NightActionCapabilities;
    }>;
    priest?.client.send("submitNightAction", {
      action: { kind: "priest_bless", targetUserId: targets[0]?.userId },
    });

    await expect(firstAck).resolves.toBeTruthy();
    await expect(capabilities).resolves.toMatchObject({
      capabilities: {
        availableKinds: expect.arrayContaining(["priest_bless"]),
        usedFlags: expect.not.objectContaining({ priest_bless: expect.anything() }),
      },
    });

    const replacementAck = priest?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    priest?.client.send("submitNightAction", {
      action: { kind: "priest_bless", targetUserId: targets[1]?.userId },
    });
    await expect(replacementAck).resolves.toBeTruthy();

    clients[0]?.client.send("narratorAdvance", {});
    await room.waitForNextPatch(20);

    const privatePlayers = (room as unknown as {
      privatePlayers: Map<string, PrivatePlayerState>;
    }).privatePlayers;
    expect(privatePlayers.get(targets[0]?.userId ?? "")?.priestBlessed).not.toBe(true);
    expect(privatePlayers.get(targets[1]?.userId ?? "")?.priestBlessed).toBe(true);
  });

  it("keeps the public seating order stable after a fresh reconnect", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "PRDREC",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: { ordinary_villager: 5, werewolf: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "order-reconnect");
    await startGameAndCollectRoles(clients);
    const originalOrder = [...room.state.players.values()].map((player) => player.userId);
    const returning = clients[2];

    returning?.client.leave();
    await delay(40);
    await connectWithRetry(colyseus, room, {
      code: room.state.code,
      userId: returning?.userId ?? "",
      displayName: returning?.displayName ?? "",
    });

    expect([...room.state.players.values()].map((player) => player.userId)).toEqual(originalOrder);
  });

  it("promotes a connected successor who can resume a paused game", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "HPSTPA",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: { ordinary_villager: 5, werewolf: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "host-pause");
    await startGameAndCollectRoles(clients);
    clients[0]?.client.send("narratorPause");
    await waitForCondition(
      () => room.state.phase === "paused",
      "The room did not pause before host succession was tested.",
    );
    expect(room.state.phase).toBe("paused");

    clients[0]?.client.leave();
    await delay(50);
    expect(findPublicPlayer(room, clients[1]?.userId)?.host).toBe(true);

    clients[1]?.client.send("narratorAdvance", {});
    for (let attempt = 0; attempt < 20 && room.state.phase === "paused"; attempt += 1) {
      await room.waitForNextPatch(25).catch(() => delay(25));
    }
    expect(room.state.phase).toBe("role_reveal");
  });

  it("restores a host when the first active player reconnects to a hostless room", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "HPSTRE",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: { ordinary_villager: 5, werewolf: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "host-reconnect");
    await startGameAndCollectRoles(clients);
    clients[0]?.client.send("narratorPause");
    await waitForCondition(
      () => room.state.phase === "paused",
      "The room did not pause before host restoration was tested.",
    );

    for (const player of room.state.players.values()) {
      if (!player.host) {
        player.connected = false;
      }
    }
    clients[0]?.client.leave();
    await delay(50);
    expect([...room.state.players.values()].some((player) => player.host)).toBe(false);

    const returning = clients[1];
    const reconnected = await connectWithRetry(colyseus, room, {
      code: room.state.code,
      userId: returning?.userId ?? "",
      displayName: returning?.displayName ?? "",
    });
    await delay(25);
    expect(findPublicPlayer(room, returning?.userId)?.host).toBe(true);

    reconnected.send("narratorAdvance", {});
    for (let attempt = 0; attempt < 20 && room.state.phase === "paused"; attempt += 1) {
      await room.waitForNextPatch(25).catch(() => delay(25));
    }
    expect(room.state.phase).toBe("role_reveal");
  });

  it("preserves the synchronized vote tally while voting is paused and resumed", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "VPTPAU",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: { ordinary_villager: 5, werewolf: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "vote-pause");
    await startGameAndCollectRoles(clients);
    await advanceToPhase(clients[0]?.client, room, "voting");

    clients[1]?.client.send("submitVote", { targetUserId: clients[2]?.userId });
    for (let attempt = 0; attempt < 20 && room.state.voteTally.length === 0; attempt += 1) {
      await room.waitForNextPatch(25).catch(() => delay(10));
    }
    const beforePause = [...room.state.voteTally].map((item) => item.toJSON());
    expect(beforePause).toHaveLength(1);

    clients[0]?.client.send("narratorPause");
    await waitForCondition(
      () => room.state.phase === "paused",
      "The room did not pause while preserving the vote tally.",
    );
    expect(room.state.phase).toBe("paused");
    expect([...room.state.voteTally].map((item) => item.toJSON())).toEqual(beforePause);

    clients[0]?.client.send("narratorAdvance", {});
    await waitForCondition(
      () => room.state.phase === "voting",
      "The room did not resume voting while preserving the vote tally.",
    );
    expect(room.state.phase).toBe("voting");
    expect([...room.state.voteTally].map((item) => item.toJSON())).toEqual(beforePause);
  });

  it("keeps spent Witch healing private while refreshing the capability payload", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "WCHJDE",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: { witch: 1, ordinary_villager: 4, werewolf: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "witch-hidden");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const witch = roles.find((item) => item.role === "witch");
    const wolf = roles.find((item) => item.role === "werewolf");
    const firstVictim = roles.find((item) => item.role === "ordinary_villager");
    const secondVictim = roles.find(
      (item) => item.role === "ordinary_villager" && item.userId !== firstVictim?.userId,
    );

    wolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: firstVictim?.userId },
    });
    await room.waitForNextPatch(20).catch(() => undefined);
    witch?.client.send("submitNightAction", {
      action: { kind: "witch_heal", targetUserId: firstVictim?.userId },
    });
    await room.waitForNextPatch(20).catch(() => undefined);
    clients[0]?.client.send("narratorAdvance", {});
    await advanceToPhase(clients[0]?.client, room, "night");

    const victimMessage = witch?.client.waitForMessage("system", 180) as Promise<{ messageBg: string }>;
    const capabilities = witch?.client.waitForMessage("night_action_capabilities") as Promise<{
      capabilities: NightActionCapabilities;
    }>;
    wolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: secondVictim?.userId },
    });

    await expect(capabilities).resolves.toMatchObject({
      capabilities: {
        usedFlags: {
          witch_heal: expect.objectContaining({ reasonBg: "Лечебната отвара вече е използвана." }),
        },
      },
    });
    await expect(victimMessage).rejects.toThrow("timed out");
  });

  it("refreshes Witch capabilities after the faction changes its victim", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "WCHGAP",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: { witch: 1, ordinary_villager: 4, werewolf: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "witch-change");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const witch = roles.find((item) => item.role === "witch");
    const wolf = roles.find((item) => item.role === "werewolf");
    const firstVictim = roles.find((item) => item.role === "ordinary_villager");
    const secondVictim = roles.find(
      (item) => item.role === "ordinary_villager" && item.userId !== firstVictim?.userId,
    );

    wolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: firstVictim?.userId },
    });
    await room.waitForNextPatch(20).catch(() => undefined);
    const healAck = witch?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    witch?.client.send("submitNightAction", {
      action: { kind: "witch_heal", targetUserId: firstVictim?.userId },
    });
    await healAck;
    await delay(30);

    const changedVictimMessage = witch?.client.waitForMessage("system") as Promise<{ messageBg: string }>;
    const refreshedCapabilities = witch?.client.waitForMessage("night_action_capabilities") as Promise<{
      capabilities: NightActionCapabilities;
    }>;
    wolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: secondVictim?.userId },
    });

    await expect(changedVictimMessage).resolves.toMatchObject({
      messageBg: "Жертвата на фракцията се промени. Избери отново дали да използваш лечебната отвара.",
    });
    await expect(refreshedCapabilities).resolves.toMatchObject({
      capabilities: expect.objectContaining({
        availableKinds: expect.arrayContaining(["witch_heal"]),
        allowedTargetIdsByKind: {
          witch_heal: [secondVictim?.userId],
        },
        usedFlags: expect.not.objectContaining({ witch_heal: expect.anything() }),
      }),
    });
  });

  it("keeps a Witch heal queued while another hostile faction still targets that player", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "WCHMUL",
      mode: "werewolves_classic",
      playerCount: 10,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: { witch: 1, ordinary_villager: 3, werewolf: 3, vampire: 3 },
    });
    const clients = await connectPlayers(colyseus, room, 10, "witch-multiple-factions");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const witch = roles.find((item) => item.role === "witch");
    const wolves = roles.filter((item) => item.role === "werewolf");
    const vampires = roles.filter((item) => item.role === "vampire");
    const villagers = roles.filter((item) => item.role === "ordinary_villager");
    const wolfVictim = villagers[0];
    const vampireVictim = villagers[1];
    const replacementWolfVictim = villagers[2];

    for (const [actors, target] of [
      [wolves, wolfVictim],
      [vampires, vampireVictim],
    ] as const) {
      for (const actor of actors) {
        const ack = actor.client.waitForMessage("night_action_ack") as Promise<unknown>;
        actor.client.send("submitNightAction", {
          action: { kind: "faction_kill", targetUserId: target?.userId },
        });
        await ack;
      }
    }

    const healAck = witch?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    witch?.client.send("submitNightAction", {
      action: { kind: "witch_heal", targetUserId: vampireVictim?.userId },
    });
    await healAck;

    for (const wolf of wolves) {
      const replacementAck = wolf.client.waitForMessage("night_action_ack") as Promise<unknown>;
      wolf.client.send("submitNightAction", {
        action: { kind: "faction_kill", targetUserId: replacementWolfVictim?.userId },
      });
      await replacementAck;
    }

    const pendingNightActions = (room as unknown as {
      pendingNightActions: Map<string, Array<{ action: { kind: string; targetUserId?: string } }>>;
    }).pendingNightActions;
    expect(pendingNightActions.get(witch?.userId ?? "")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: expect.objectContaining({
          kind: "witch_heal",
          targetUserId: vampireVictim?.userId,
        }),
      }),
    ]));
  });

  it("clears a queued Witch heal when faction consensus disappears", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "WCHSPL",
      mode: "werewolves_classic",
      playerCount: 7,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: { witch: 1, ordinary_villager: 4, werewolf: 2 },
    });
    const clients = await connectPlayers(colyseus, room, 7, "witch-split-vote");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const witch = roles.find((item) => item.role === "witch");
    const wolves = roles.filter((item) => item.role === "werewolf");
    const villagers = roles.filter((item) => item.role === "ordinary_villager");
    const firstVictim = villagers[0];
    const splitVictim = villagers[1];

    for (const wolf of wolves) {
      const ack = wolf.client.waitForMessage("night_action_ack") as Promise<unknown>;
      wolf.client.send("submitNightAction", {
        action: { kind: "faction_kill", targetUserId: firstVictim?.userId },
      });
      await ack;
    }

    const healAck = witch?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    witch?.client.send("submitNightAction", {
      action: { kind: "witch_heal", targetUserId: firstVictim?.userId },
    });
    await healAck;

    const changedVictimMessage = witch?.client.waitForMessage("system") as Promise<{ messageBg: string }>;
    const splitAck = wolves[0]?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    wolves[0]?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: splitVictim?.userId },
    });
    await splitAck;

    await expect(changedVictimMessage).resolves.toMatchObject({
      messageBg: "Жертвата на фракцията се промени. Избери отново дали да използваш лечебната отвара.",
    });
    const pendingNightActions = (room as unknown as {
      pendingNightActions: Map<string, Array<{ action: { kind: string } }>>;
    }).pendingNightActions;
    expect(pendingNightActions.get(witch?.userId ?? "") ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ action: expect.objectContaining({ kind: "witch_heal" }) }),
    ]));
  });

  it("announces a faction victim again after an A-B-A target cycle", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "WCHABA",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: { witch: 1, ordinary_villager: 4, werewolf: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "witch-target-cycle");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const witch = roles.find((item) => item.role === "witch");
    const wolf = roles.find((item) => item.role === "werewolf");
    const villagers = roles.filter((item) => item.role === "ordinary_villager");

    for (const target of [villagers[0], villagers[1], villagers[0]]) {
      const announcement = witch?.client.waitForMessage("system") as Promise<{ messageBg: string }>;
      const ack = wolf?.client.waitForMessage("night_action_ack") as Promise<unknown>;
      wolf?.client.send("submitNightAction", {
        action: { kind: "faction_kill", targetUserId: target?.userId },
      });
      await ack;
      await expect(announcement).resolves.toMatchObject({
        messageBg: `${target?.displayName} е нарочен за смърт тази нощ.`,
      });
    }
  });
});
