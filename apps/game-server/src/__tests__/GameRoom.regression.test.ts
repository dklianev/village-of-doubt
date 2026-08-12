import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { Room as ClientRoom } from "@colyseus/sdk";
import type { NightActionCapabilities, RoleCode } from "@werewolf/shared";
import appConfig from "../app.config.js";
import type { GameRoom } from "../rooms/GameRoom.js";
import type { GameState } from "../rooms/schemas/GameState.js";

interface JoinedClient {
  client: ClientRoom<GameRoom, GameState>;
  userId: string;
  displayName: string;
}

interface RoleClient extends JoinedClient {
  role: RoleCode;
}

describe("GameRoom gameplay regressions", () => {
  let colyseus: ColyseusTestServer;
  let previousAllowDevAuth: string | undefined;
  let previousNodeEnv: string | undefined;

  beforeAll(async () => {
    previousAllowDevAuth = process.env.ALLOW_DEV_AUTH;
    previousNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "test";
    colyseus = await boot(appConfig, 2679);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
  });

  afterAll(async () => {
    await colyseus?.shutdown();
    restoreEnvValue("ALLOW_DEV_AUTH", previousAllowDevAuth);
    restoreEnvValue("NODE_ENV", previousNodeEnv);
  });

  it("rejects impossible manual role counts before any role is revealed", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "BADRPL",
      mode: "mafia_free",
      playerCount: 4,
      roles: {
        civilian: 2,
        mafioso: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "bad-role");

    const error = clients[0]?.client.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    clients[0]?.client.send("startGame", {});

    await expect(error).resolves.toMatchObject({
      messageBg: "Броят роли (3) не съвпада с броя играчи (4).",
    });
    expect(serverRoom.state.phase).toBe("lobby");
  });

  it("preserves public room visibility when the game starts", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "PUBVJS",
      mode: "werewolves_classic",
      playerCount: 6,
      roomVisibility: "public",
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "public-visibility");

    await startGameAndCollectRoles(clients);

    expect((serverRoom as unknown as { config: { roomVisibility: string } }).config.roomVisibility)
      .toBe("public");
  });

  it("delivers faction chat only to the matching faction", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "MAFCHT",
      mode: "mafia_free",
      playerCount: 4,
      roles: {
        civilian: 1,
        commissioner: 1,
        mafioso: 1,
        don: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "mafia-chat");
    const roleClients = await startGameAndCollectRoles(clients);
    const mafia = roleClients.filter((item) => item.role === "mafioso" || item.role === "don");
    const village = roleClients.find((item) => item.role === "civilian" || item.role === "commissioner");

    expect(mafia).toHaveLength(2);
    expect(village).toBeTruthy();

    const senderMessage = mafia[0]?.client.waitForMessage("private_chat") as Promise<{ channel: string; message: string }>;
    const recipientMessage = mafia[1]?.client.waitForMessage("private_chat") as Promise<{ channel: string; message: string }>;
    const villageMessage = village?.client.waitForMessage("private_chat", 150) as Promise<unknown>;
    mafia[0]?.client.send("sendChat", { channel: "mafia", message: "Тайна нощна уговорка" });

    await expect(senderMessage).resolves.toMatchObject({
      channel: "mafia",
      message: "Тайна нощна уговорка",
    });
    await expect(recipientMessage).resolves.toMatchObject({
      channel: "mafia",
      message: "Тайна нощна уговорка",
    });
    await expect(villageMessage).rejects.toThrow("timed out");
  });

  it("lets Cupid link two lovers through private events only", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "CUPJD3",
      mode: "werewolves_classic",
      playerCount: 6,
      roles: {
        cupid: 1,
        ordinary_villager: 4,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "cupid");
    const roleClients = await startGameAndCollectRoles(clients);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();

    const cupid = roleClients.find((item) => item.role === "cupid");
    const lovers = roleClients.filter((item) => item.userId !== cupid?.userId).slice(0, 2);
    expect(cupid).toBeTruthy();
    expect(lovers).toHaveLength(2);

    const firstLoverMessage = lovers[0]?.client.waitForMessage("private_lovers") as Promise<{ loverUserId: string }>;
    const secondLoverMessage = lovers[1]?.client.waitForMessage("private_lovers") as Promise<{ loverUserId: string }>;
    const cupidAck = cupid?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    cupid?.client.send("submitNightAction", {
      action: {
        kind: "cupid_link",
        firstUserId: lovers[0]?.userId,
        secondUserId: lovers[1]?.userId,
      },
    });
    await cupidAck;
    clients[0]?.client.send("narratorAdvance", {});

    await expect(firstLoverMessage).resolves.toMatchObject({ loverUserId: lovers[1]?.userId });
    await expect(secondLoverMessage).resolves.toMatchObject({ loverUserId: lovers[0]?.userId });
    expect([...serverRoom.state.publicEvents.values()].some((event) => event.messageBg.includes("избра Влюбените"))).toBe(false);
  });

  it("lets the Witch replace a pending poison target before resolution", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "WJTCH3",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: {
        witch: 1,
        seer: 1,
        ordinary_villager: 3,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "witch");
    const roleClients = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, serverRoom);

    const witch = roleClients.find((item) => item.role === "witch");
    const targets = roleClients.filter((item) => item.userId !== witch?.userId);
    expect(witch).toBeTruthy();

    const firstAck = witch?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    witch?.client.send("submitNightAction", {
      action: { kind: "witch_poison", targetUserId: targets[0]?.userId },
    });
    await expect(firstAck).resolves.toBeTruthy();

    const replacementAck = witch?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    witch?.client.send("submitNightAction", {
      action: { kind: "witch_poison", targetUserId: targets[1]?.userId },
    });
    await expect(replacementAck).resolves.toBeTruthy();

    clients[0]?.client.send("narratorAdvance", {});
    await waitForCondition(
      () => findPublicPlayer(serverRoom, targets[1]?.userId)?.alive === false,
      "Witch replacement poison did not resolve against the latest target.",
    );

    expect(findPublicPlayer(serverRoom, targets[0]?.userId)?.alive).toBe(true);
    expect(findPublicPlayer(serverRoom, targets[1]?.userId)?.alive).toBe(false);
  });

  it("lets the Witch use both potions in the same night", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "WJTCH2",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: {
        witch: 1,
        ordinary_villager: 4,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "witch-both");
    const roleClients = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, serverRoom);

    const witch = roleClients.find((item) => item.role === "witch");
    const werewolf = roleClients.find((item) => item.role === "werewolf");
    const savedTarget = roleClients.find((item) => item.role === "ordinary_villager");
    const poisonedTarget = roleClients.find((item) => item.role === "ordinary_villager" && item.userId !== savedTarget?.userId);
    expect(witch).toBeTruthy();
    expect(werewolf).toBeTruthy();
    expect(savedTarget).toBeTruthy();
    expect(poisonedTarget).toBeTruthy();

    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: savedTarget?.userId },
    });
    await serverRoom.waitForNextPatch(20);
    witch?.client.send("submitNightAction", {
      action: { kind: "witch_heal", targetUserId: savedTarget?.userId },
    });
    await serverRoom.waitForNextPatch(20);
    witch?.client.send("submitNightAction", {
      action: { kind: "witch_poison", targetUserId: poisonedTarget?.userId },
    });
    await serverRoom.waitForNextPatch(20);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);

    expect(findPublicPlayer(serverRoom, savedTarget?.userId)?.alive).toBe(true);
    expect(findPublicPlayer(serverRoom, poisonedTarget?.userId)?.alive).toBe(false);
  });

  it("refreshes Witch capabilities after a faction victim is announced", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "WCAP23",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: {
        witch: 1,
        ordinary_villager: 4,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "witch-cap");
    const roleClients = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, serverRoom);

    const witch = roleClients.find((item) => item.role === "witch");
    const werewolf = roleClients.find((item) => item.role === "werewolf");
    const savedTarget = roleClients.find((item) => item.role === "ordinary_villager");
    expect(witch).toBeTruthy();
    expect(werewolf).toBeTruthy();
    expect(savedTarget).toBeTruthy();

    await drainNightActionCapabilities(witch?.client);

    const refreshedCapabilities = waitForNightActionCapabilitiesMatching(
      witch?.client,
      (capabilities) => capabilities.availableKinds.includes("witch_heal"),
    );
    const factionAck = werewolf?.client.waitForMessage("night_action_ack") as Promise<{ phase: string }>;
    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: savedTarget?.userId },
    });

    await expect(factionAck).resolves.toMatchObject({ phase: "first_night" });
    await expect(refreshedCapabilities).resolves.toMatchObject({
      availableKinds: expect.arrayContaining(["witch_heal"]),
      usedFlags: expect.not.objectContaining({ witch_heal: expect.anything() }),
    });

    const healAck = witch?.client.waitForMessage("night_action_ack") as Promise<{ phase: string }>;
    witch?.client.send("submitNightAction", {
      action: { kind: "witch_heal", targetUserId: savedTarget?.userId },
    });
    await expect(healAck).resolves.toMatchObject({ phase: "first_night" });
  });

  it("lets the Priest give one persistent blessing that blocks a night death", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "PRJEST",
      mode: "werewolves_classic",
      playerCount: 6,
      firstNightKill: true,
      roles: {
        priest: 1,
        blacksmith: 1,
        vampire_hunter: 1,
        witch: 1,
        ordinary_villager: 1,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "priest");
    const roleClients = await startGameAndCollectRoles(clients);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();

    const priest = roleClients.find((item) => item.role === "priest");
    const werewolf = roleClients.find((item) => item.role === "werewolf");
    const blessed = roleClients.find((item) => item.role === "ordinary_villager");
    expect(priest).toBeTruthy();
    expect(werewolf).toBeTruthy();
    expect(blessed).toBeTruthy();

    priest?.client.send("submitNightAction", {
      action: { kind: "priest_bless", targetUserId: blessed?.userId },
    });
    await serverRoom.waitForNextPatch(20);

    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: blessed?.userId },
    });
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);

    const blessedState = [...serverRoom.state.players.values()].find((player) => player.userId === blessed?.userId);
    expect(blessedState?.alive).toBe(true);
    expect([...serverRoom.state.publicEvents.values()].some((event) => event.messageBg.includes("Благословия спря"))).toBe(true);
  });

  it("lets the automatic narrator run the Thief role swap", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "THJEF3",
      mode: "werewolves_classic",
      playerCount: 6,
      firstNightKill: true,
      roles: {
        thief: 1,
        werewolf: 1,
        ordinary_villager: 3,
        seer: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "thief");
    const roleClients = await startGameAndCollectRoles(clients);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();

    const thief = roleClients.find((item) => item.role === "thief");
    const werewolf = roleClients.find((item) => item.role === "werewolf");
    const villager = roleClients.find((item) => item.role === "ordinary_villager");
    expect(thief).toBeTruthy();
    expect(werewolf).toBeTruthy();

    const thiefRoleUpdate = thief?.client.waitForMessage("private_role") as Promise<{ role: RoleCode }>;
    const targetRoleUpdate = werewolf?.client.waitForMessage("private_role") as Promise<{ role: RoleCode }>;
    const targetSystem = werewolf?.client.waitForMessage("system") as Promise<{ messageBg: string }>;
    thief?.client.send("submitNightAction", {
      action: { kind: "thief_steal", targetUserId: werewolf?.userId },
    });
    await expect(thiefRoleUpdate).resolves.toMatchObject({ role: "werewolf" });
    await expect(targetRoleUpdate).resolves.toMatchObject({ role: "ordinary_villager" });
    await expect(targetSystem).resolves.toMatchObject({
      messageBg: "Крадецът взе картата ти. Вече си Обикновен селянин.",
    });

    const firstNightActionAck = thief?.client.waitForMessage("night_action_ack") as Promise<{ phase: string }>;
    thief?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: villager?.userId },
    });
    await expect(firstNightActionAck).resolves.toMatchObject({ phase: "first_night" });
    clients[0]?.client.send("narratorAdvance", {});

    await advanceToPhase(clients[0]?.client, serverRoom, "night");
    const rejectedWerewolfAction = werewolf?.client.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: villager?.userId },
    });
    await expect(rejectedWerewolfAction).resolves.toMatchObject({
      messageBg: "Тази роля няма право на това нощно действие.",
    });

    const thiefChat = thief?.client.waitForMessage("private_chat") as Promise<{ channel: string }>;
    const oldWerewolfChat = werewolf?.client.waitForMessage("private_chat", 150) as Promise<unknown>;
    thief?.client.send("sendChat", { channel: "werewolves", message: "Новият вълк съм аз." });

    await expect(thiefChat).resolves.toMatchObject({ channel: "werewolves" });
    await expect(oldWerewolfChat).rejects.toThrow("timed out");
  });

  it("rejects Healer self-protection", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "HEAL23",
      mode: "werewolves_classic",
      playerCount: 6,
      roles: {
        healer: 1,
        ordinary_villager: 4,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "healer");
    const roleClients = await startGameAndCollectRoles(clients);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();

    const healer = roleClients.find((item) => item.role === "healer");
    const werewolf = roleClients.find((item) => item.role === "werewolf");
    expect(healer).toBeTruthy();
    expect(werewolf).toBeTruthy();

    const error = healer?.client.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    healer?.client.send("submitNightAction", {
      action: { kind: "healer_protect", targetUserId: healer?.userId },
    });
    await expect(error).resolves.toMatchObject({
      messageBg: "Лечителят не може да лекува себе си.",
    });

    const savedTarget = roleClients.find((item) => item.role === "ordinary_villager");
    expect(savedTarget).toBeTruthy();
    healer?.client.send("submitNightAction", {
      action: { kind: "healer_protect", targetUserId: savedTarget?.userId },
    });
    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: savedTarget?.userId },
    });
    const ignoredAdvanceError = clients[0]?.client.waitForMessage("safe_error", 200).catch(() => undefined);
    clients[0]?.client.send("narratorAdvance", {});
    await ignoredAdvanceError;
    await serverRoom.waitForNextPatch(20);

    const savedState = [...serverRoom.state.players.values()].find((player) => player.userId === savedTarget?.userId);
    expect(savedState?.alive).toBe(true);
  });

  it("keeps the Healer repeat-target guard tied to the last resolved night", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "HEAL22",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: {
        healer: 1,
        ordinary_villager: 4,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "healer-repeat");
    const roleClients = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, serverRoom);

    const healer = roleClients.find((item) => item.role === "healer");
    const werewolf = roleClients.find((item) => item.role === "werewolf");
    const firstTarget = roleClients.find((item) => item.role === "ordinary_villager");
    const alternateTarget = roleClients.find(
      (item) => item.role === "ordinary_villager" && item.userId !== firstTarget?.userId,
    );
    expect(healer).toBeTruthy();
    expect(werewolf).toBeTruthy();
    expect(firstTarget).toBeTruthy();
    expect(alternateTarget).toBeTruthy();

    healer?.client.send("submitNightAction", {
      action: { kind: "healer_protect", targetUserId: firstTarget?.userId },
    });
    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: firstTarget?.userId },
    });
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20).catch(() => undefined);
    expect(findPublicPlayer(serverRoom, firstTarget?.userId)?.alive).toBe(true);

    await advanceToPhase(clients[0]?.client, serverRoom, "night");

    const alternateAck = healer?.client.waitForMessage("night_action_ack") as Promise<{ phase: string }>;
    healer?.client.send("submitNightAction", {
      action: { kind: "healer_protect", targetUserId: alternateTarget?.userId },
    });
    await expect(alternateAck).resolves.toMatchObject({ phase: "night" });

    const repeatError = healer?.client.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    healer?.client.send("submitNightAction", {
      action: { kind: "healer_protect", targetUserId: firstTarget?.userId },
    });

    await expect(repeatError).resolves.toMatchObject({
      messageBg: "Лечителят не може да лекува същия играч две нощи поред.",
    });
  });

  it("enters hunter revenge when the Hunter dies at night", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "HUNT23",
      mode: "werewolves_classic",
      playerCount: 6,
      firstNightKill: true,
      roles: {
        hunter: 1,
        ordinary_villager: 4,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "hunter");
    const roleClients = await startGameAndCollectRoles(clients);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();

    const hunter = roleClients.find((item) => item.role === "hunter");
    const werewolf = roleClients.find((item) => item.role === "werewolf");
    const revengeTarget = roleClients.find((item) => item.role === "ordinary_villager");
    expect(hunter).toBeTruthy();
    expect(werewolf).toBeTruthy();
    expect(revengeTarget).toBeTruthy();

    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: hunter?.userId },
    });
    await serverRoom.waitForNextPatch(20);
    expect(serverRoom.state.phase).toBe("hunter_revenge");

    const revengeAck = hunter?.client.waitForMessage("hunter_revenge_ack") as Promise<{ targetUserId: string }>;
    hunter?.client.send("submitHunterRevenge", { targetUserId: revengeTarget?.userId });
    await expect(revengeAck).resolves.toMatchObject({ targetUserId: revengeTarget?.userId });
    await serverRoom.waitForNextPatch(20);
    const targetState = [...serverRoom.state.players.values()].find((player) => player.userId === revengeTarget?.userId);
    expect(targetState?.alive).toBe(false);
  });

  it("records a Jester personal win when the village votes them out", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "JESTER",
      mode: "mafia_free",
      playerCount: 6,
      roles: {
        jester: 1,
        civilian: 4,
        mafioso: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "jester");
    const roleClients = await startGameAndCollectRoles(clients);
    const jester = roleClients.find((item) => item.role === "jester");
    expect(jester).toBeTruthy();
    const unlockMessage = jester?.client.waitForMessage("achievements_unlocked");

    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();

    expect(serverRoom.state.phase).toBe("voting");
    for (const client of clients) {
      client.client.send("submitVote", { targetUserId: jester?.userId });
    }
    await serverRoom.waitForNextPatch(20);

    expect([...serverRoom.state.publicEvents.values()].some((event) => event.messageBg.includes("Шут"))).toBe(true);
    await expect(unlockMessage).resolves.toMatchObject({ achievementIds: ["jester_win"] });
    const win = (serverRoom as unknown as {
      evaluateWin: () => { personalWinnerPlayerIds: string[] };
    }).evaluateWin();
    expect(win.personalWinnerPlayerIds).toContain(jester?.userId);
  });

  it("rejects manual room configs with roles from another game family", async () => {
    await expect(
      colyseus.createRoom<GameRoom>("game", {
        code: "WRPNGF",
        mode: "mafia_free",
        playerCount: 4,
        roles: {
          civilian: 3,
          werewolf: 1,
        },
      }),
    ).rejects.toThrow("Тези роли не са налични за Мафия: Върколак.");
  });

  it("still asks for a Mayor successor when a Hunter Mayor revenge times out", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "MAYHUN",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: {
        hunter: 1,
        ordinary_villager: 4,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "mayor-hunter");
    const roleClients = await startGameAndCollectRoles(clients);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();

    const hunter = roleClients.find((item) => item.role === "hunter");
    const werewolf = roleClients.find((item) => item.role === "werewolf");
    expect(hunter).toBeTruthy();
    expect(werewolf).toBeTruthy();

    for (const player of serverRoom.state.players.values()) {
      player.mayor = player.userId === hunter?.userId;
    }

    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: hunter?.userId },
    });
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);
    expect(serverRoom.state.phase).toBe("hunter_revenge");

    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);
    expect(serverRoom.state.phase).toBe("mayor_successor");

    const successor = [...serverRoom.state.players.values()].find((player) => player.playing && player.alive);
    expect(successor).toBeTruthy();
    clients[0]?.client.send("setMayor", { targetUserId: successor?.userId });
    await serverRoom.waitForNextPatch(20);
    expect(serverRoom.state.phase).toBe("resolution");
  });

  it("marks the secret Mayor role and uses the double vote only as a tie-breaker", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "MAYVPT",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: {
        mayor: 1,
        ordinary_villager: 3,
        seer: 1,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "mayor-vote");
    const roleClients = await startGameAndCollectRoles(clients);
    const mayor = roleClients.find((item) => item.role === "mayor");
    expect(mayor).toBeTruthy();

    const mayorState = [...serverRoom.state.players.values()].find((player) => player.userId === mayor?.userId);
    expect(mayorState?.mayor).toBe(false);

    await advanceToVoting(clients[0]?.client, serverRoom);
    const targets = roleClients.filter((item) => item.userId !== mayor?.userId);
    const mayorTarget = targets[0];
    const majorityTarget = targets[1];
    const voters = targets.filter((item) => item.userId !== mayorTarget?.userId && item.userId !== majorityTarget?.userId);
    expect(mayorTarget).toBeTruthy();
    expect(majorityTarget).toBeTruthy();
    expect(voters.length).toBeGreaterThanOrEqual(2);

    mayor?.client.send("submitVote", { targetUserId: mayorTarget?.userId });
    await serverRoom.waitForNextPatch(20);
    voters[0]?.client.send("submitVote", { targetUserId: majorityTarget?.userId });
    await serverRoom.waitForNextPatch(20);
    voters[1]?.client.send("submitVote", { targetUserId: majorityTarget?.userId });
    await serverRoom.waitForNextPatch(20);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);

    const mayorTargetState = [...serverRoom.state.players.values()].find((player) => player.userId === mayorTarget?.userId);
    const majorityTargetState = [...serverRoom.state.players.values()].find((player) => player.userId === majorityTarget?.userId);
    expect(mayorTargetState?.alive).toBe(true);
    expect(majorityTargetState?.alive).toBe(false);
  });

  it("lets the Mayor resolve a tied vote", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "MAYTJE",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: {
        mayor: 1,
        ordinary_villager: 3,
        seer: 1,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "mayor-tie");
    const roleClients = await startGameAndCollectRoles(clients);
    const mayor = roleClients.find((item) => item.role === "mayor");
    const targets = roleClients.filter((item) => item.userId !== mayor?.userId);
    expect(mayor).toBeTruthy();
    expect(targets.length).toBeGreaterThanOrEqual(2);

    await advanceToVoting(clients[0]?.client, serverRoom);
    mayor?.client.send("submitVote", { targetUserId: targets[0]?.userId });
    await serverRoom.waitForNextPatch(20);
    targets[1]?.client.send("submitVote", { targetUserId: targets[1]?.userId });
    await serverRoom.waitForNextPatch(20);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);

    const mayorTargetState = [...serverRoom.state.players.values()].find((player) => player.userId === targets[0]?.userId);
    const otherTargetState = [...serverRoom.state.players.values()].find((player) => player.userId === targets[1]?.userId);
    expect(mayorTargetState?.alive).toBe(false);
    expect(otherTargetState?.alive).toBe(true);
  });

  it("keeps Червена шапчица and Готвач safe from faction attacks", async () => {
    const redRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "REDHD3",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: {
        red_riding_hood: 1,
        hunter: 1,
        ordinary_villager: 3,
        werewolf: 1,
      },
    });
    const redClients = await connectPlayers(colyseus, redRoom, 6, "red-hood");
    const redRoles = await startGameAndCollectRoles(redClients);
    await advanceToFirstNight(redClients[0]?.client, redRoom);

    const red = redRoles.find((item) => item.role === "red_riding_hood");
    const werewolf = redRoles.find((item) => item.role === "werewolf");
    expect(red).toBeTruthy();
    expect(werewolf).toBeTruthy();

    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: red?.userId },
    });
    redClients[0]?.client.send("narratorAdvance", {});
    await redRoom.waitForNextPatch(20);

    expect(findPublicPlayer(redRoom, red?.userId)?.alive).toBe(true);
    expect([...redRoom.state.publicEvents.values()].some((event) => event.messageBg.includes("Червената шапчица"))).toBe(true);

    const cookRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "CKKD33",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: {
        cook: 1,
        ordinary_villager: 4,
        vampire: 1,
      },
    });
    const cookClients = await connectPlayers(colyseus, cookRoom, 6, "cook");
    const cookRoles = await startGameAndCollectRoles(cookClients);
    await advanceToFirstNight(cookClients[0]?.client, cookRoom);

    const cook = cookRoles.find((item) => item.role === "cook");
    const vampire = cookRoles.find((item) => item.role === "vampire");
    expect(cook).toBeTruthy();
    expect(vampire).toBeTruthy();

    vampire?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: cook?.userId },
    });
    cookClients[0]?.client.send("narratorAdvance", {});
    await cookRoom.waitForNextPatch(20);

    expect(findPublicPlayer(cookRoom, cook?.userId)?.alive).toBe(true);
    expect([...cookRoom.state.publicEvents.values()].some((event) => event.messageBg.includes("Готвачът"))).toBe(false);
  });

  it("delays vampire bites until the end of the day", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "VAMPD3",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: {
        ordinary_villager: 5,
        vampire: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "vampire-delay");
    const roleClients = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, serverRoom);

    const vampire = roleClients.find((item) => item.role === "vampire");
    const target = roleClients.find((item) => item.role === "ordinary_villager");
    expect(vampire).toBeTruthy();
    expect(target).toBeTruthy();

    vampire?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: target?.userId },
    });
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);
    expect(serverRoom.state.phase).toBe("day_announcement");
    expect(findPublicPlayer(serverRoom, target?.userId)?.alive).toBe(true);

    await advanceToPhase(clients[0]?.client, serverRoom, "resolution");
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);
    expect(findPublicPlayer(serverRoom, target?.userId)?.alive).toBe(false);
  });

  it("resolves Blacksmith, Investigator, Stray Cat and Vampire Hunter advanced actions", async () => {
    const blacksmithRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "BLACK3",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: {
        blacksmith: 1,
        ordinary_villager: 4,
        werewolf: 1,
      },
    });
    const blacksmithClients = await connectPlayers(colyseus, blacksmithRoom, 6, "blacksmith");
    const blacksmithRoles = await startGameAndCollectRoles(blacksmithClients);
    await advanceToFirstNight(blacksmithClients[0]?.client, blacksmithRoom);
    const blacksmith = blacksmithRoles.find((item) => item.role === "blacksmith");
    const receiver = blacksmithRoles.find((item) => item.role === "ordinary_villager");
    const werewolf = blacksmithRoles.find((item) => item.role === "werewolf");
    blacksmith?.client.send("submitNightAction", {
      action: { kind: "blacksmith_sword", receiverUserId: receiver?.userId, targetUserId: werewolf?.userId },
    });
    blacksmithClients[0]?.client.send("narratorAdvance", {});
    await blacksmithRoom.waitForNextPatch(20);
    expect(findPublicPlayer(blacksmithRoom, werewolf?.userId)?.alive).toBe(false);

    await colyseus.cleanup();
    const investigatorRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "JNVST3",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: {
        investigator: 1,
        ordinary_villager: 4,
        werewolf: 1,
      },
    });
    const investigatorClients = await connectPlayers(colyseus, investigatorRoom, 6, "investigator");
    const investigatorRoles = await startGameAndCollectRoles(investigatorClients);
    await advanceToFirstNight(investigatorClients[0]?.client, investigatorRoom);
    const investigator = investigatorRoles.find((item) => item.role === "investigator");
    const investigatedWerewolf = investigatorRoles.find((item) => item.role === "werewolf");
    const checkMessage = investigator?.client.waitForMessage("private_check_result") as Promise<{ messageBg: string }>;
    investigator?.client.send("submitNightAction", {
      action: { kind: "investigator_check", targetUserId: investigatedWerewolf?.userId },
    });
    investigatorClients[0]?.client.send("narratorAdvance", {});
    await expect(checkMessage).resolves.toMatchObject({
      messageBg: expect.stringContaining("гореща"),
    });

    await colyseus.cleanup();
    const catRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "CAT223",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      narratorMode: "full_human",
      roles: {
        stray_cat: 1,
        ordinary_villager: 4,
        werewolf: 1,
      },
    });
    const catClients = await connectPlayers(colyseus, catRoom, 7, "stray-cat");
    const catRoles = await startFullHumanGameAndCollectRoles(catClients);
    await advanceToFirstNight(catClients[0]?.client, catRoom);
    const cat = catRoles.find((item) => item.role === "stray_cat");
    const catWerewolf = catRoles.find((item) => item.role === "werewolf");
    cat?.client.send("submitNightAction", {
      action: { kind: "stray_cat_choose", targetUserId: catWerewolf?.userId },
    });
    catClients[0]?.client.send("narratorAdvance", {});
    await catRoom.waitForNextPatch(20);
    expect(findPublicPlayer(catRoom, cat?.userId)?.alive).toBe(false);
    expect(findPublicPlayer(catRoom, catWerewolf?.userId)?.alive).toBe(false);

    await colyseus.cleanup();
    const hunterRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "VHUNT3",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: {
        vampire_hunter: 1,
        ordinary_villager: 4,
        werewolf: 1,
      },
    });
    const hunterClients = await connectPlayers(colyseus, hunterRoom, 6, "vampire-hunter");
    const hunterRoles = await startGameAndCollectRoles(hunterClients);
    await advanceToFirstNight(hunterClients[0]?.client, hunterRoom);
    const vampireHunter = hunterRoles.find((item) => item.role === "vampire_hunter");
    const innocent = hunterRoles.find((item) => item.role === "ordinary_villager");
    vampireHunter?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: innocent?.userId },
    });
    hunterClients[0]?.client.send("narratorAdvance", {});
    await hunterRoom.waitForNextPatch(20);
    await advanceToPhase(hunterClients[0]?.client, hunterRoom, "night");
    const disarmedError = vampireHunter?.client.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    vampireHunter?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: hunterRoles.find((item) => item.role === "werewolf")?.userId },
    });
    await expect(disarmedError).resolves.toMatchObject({
      messageBg: "Убиецът на вампири изгуби умението си до края на играта.",
    });
  });

  it("reports Insomniac neighbor activity without exposing roles", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "JNSPM3",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: {
        insomniac: 1,
        investigator: 1,
        blacksmith: 1,
        werewolf: 3,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "insomniac");
    const roleClients = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, serverRoom);

    const insomniac = roleClients.find((item) => item.role === "insomniac");
    expect(insomniac).toBeTruthy();
    const livingOrder = roleClients;
    const insomniacIndex = livingOrder.findIndex((item) => item.userId === insomniac?.userId);
    const neighbor = livingOrder[(insomniacIndex + 1) % livingOrder.length];
    const fallbackTarget = neighbor?.role === "werewolf"
      ? insomniac
      : livingOrder.find((item) => item.userId !== neighbor?.userId && item.userId !== insomniac?.userId);
    const result = insomniac?.client.waitForMessage("private_check_result") as Promise<{ messageBg: string; role?: RoleCode }>;
    submitSimpleAdvancedAction(neighbor, fallbackTarget, livingOrder);
    clients[0]?.client.send("narratorAdvance", {});
    const payload = await result;
    expect(payload).toMatchObject({
      messageBg: expect.stringContaining("двамата съседни"),
    });
    expect(payload).not.toHaveProperty("role");
  });

  it("reveals Drunk's real role on the second night", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "DRUNK3",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: {
        drunk: 1,
        ordinary_villager: 4,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "drunk");
    const roleClients = await startGameAndCollectRoles(clients);
    const drunk = roleClients.find((item) => item.role === "drunk");
    expect(drunk).toBeTruthy();

    await advanceToFirstNight(clients[0]?.client, serverRoom);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);
    const roleUpdate = drunk?.client.waitForMessage("private_role") as Promise<{ role: RoleCode }>;
    await advanceToPhase(clients[0]?.client, serverRoom, "night");
    await expect(roleUpdate).resolves.toMatchObject({ role: "ordinary_villager" });
  });

  it("lets Guard Dog block a public Mayor elimination", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "GDPG23",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      narratorMode: "full_human",
      mayorMode: "public_vote",
      roles: {
        mayor: 1,
        guard_dog: 1,
        ordinary_villager: 3,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 7, "guard-dog");
    const roleClients = await startFullHumanGameAndCollectRoles(clients);
    const mayor = roleClients.find((item) => item.role === "mayor");
    expect(mayor).toBeTruthy();
    await advanceToVoting(clients[0]?.client, serverRoom);

    for (const client of roleClients.filter((item) => item.userId !== mayor?.userId).slice(0, 3)) {
      client.client.send("submitVote", { targetUserId: mayor?.userId });
    }
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);

    expect(findPublicPlayer(serverRoom, mayor?.userId)?.alive).toBe(true);
    expect([...serverRoom.state.publicEvents.values()].some((event) => event.messageBg.includes("Кучето пазач"))).toBe(true);
  });

  it("blocks a Mafia night action with the Blocker", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "MBLPCK",
      mode: "mafia_free",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: {
        roleblocker: 1,
        vigilante: 1,
        commissioner: 1,
        civilian: 2,
        mafioso: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "mafia-block");
    const roleClients = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, serverRoom);

    const blocker = roleClients.find((item) => item.role === "roleblocker");
    const vigilante = roleClients.find((item) => item.role === "vigilante");
    const mafioso = roleClients.find((item) => item.role === "mafioso");
    expect(blocker && vigilante && mafioso).toBeTruthy();

    blocker?.client.send("submitNightAction", { action: { kind: "roleblock", targetUserId: vigilante?.userId } });
    vigilante?.client.send("submitNightAction", { action: { kind: "faction_kill", targetUserId: mafioso?.userId } });
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);

    expect(findPublicPlayer(serverRoom, mafioso?.userId)?.alive).toBe(true);
  });

  it("preserves an enabled first-night kill override when the game starts", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "FNKJLL",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: {
        ordinary_villager: 5,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "first-kill");
    const roleClients = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, serverRoom);
    const werewolf = roleClients.find((item) => item.role === "werewolf");
    const target = roleClients.find((item) => item.role === "ordinary_villager");
    const ack = werewolf?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    werewolf?.client.send("submitNightAction", { action: { kind: "faction_kill", targetUserId: target?.userId } });
    await ack;
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);

    expect(findPublicPlayer(serverRoom, target?.userId)?.alive).toBe(false);
  });

  it("lets the Lawyer make a Mafia target look clean", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "LAWYER",
      mode: "mafia_free",
      playerCount: 4,
      tempoProfile: "manual",
      roles: {
        lawyer: 1,
        commissioner: 1,
        civilian: 1,
        mafioso: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "lawyer");
    const roleClients = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, serverRoom);

    const lawyer = roleClients.find((item) => item.role === "lawyer");
    const commissioner = roleClients.find((item) => item.role === "commissioner");
    const mafioso = roleClients.find((item) => item.role === "mafioso");
    const result = commissioner?.client.waitForMessage("private_check_result") as Promise<{ isEvil: boolean; messageBg?: string }>;

    lawyer?.client.send("submitNightAction", { action: { kind: "lawyer_cover", targetUserId: mafioso?.userId } });
    await serverRoom.waitForNextPatch(20);
    commissioner?.client.send("submitNightAction", { action: { kind: "check_alignment", targetUserId: mafioso?.userId } });
    await serverRoom.waitForNextPatch(20);
    clients[0]?.client.send("narratorAdvance", {});

    await expect(result).resolves.toMatchObject({ isEvil: false });
  });

  it("makes the Bodyguard die instead of the protected Mafia target", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "BPDYGD",
      mode: "mafia_free",
      playerCount: 4,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: {
        bodyguard: 1,
        civilian: 2,
        mafioso: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "bodyguard");
    const roleClients = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, serverRoom);

    const bodyguard = roleClients.find((item) => item.role === "bodyguard");
    const civilian = roleClients.find((item) => item.role === "civilian");
    const mafioso = roleClients.find((item) => item.role === "mafioso");
    bodyguard?.client.send("submitNightAction", { action: { kind: "healer_protect", targetUserId: civilian?.userId } });
    await serverRoom.waitForNextPatch(20);
    mafioso?.client.send("submitNightAction", { action: { kind: "faction_kill", targetUserId: civilian?.userId } });
    await serverRoom.waitForNextPatch(20);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);

    expect(findPublicPlayer(serverRoom, civilian?.userId)?.alive).toBe(true);
    expect(findPublicPlayer(serverRoom, bodyguard?.userId)?.alive).toBe(false);
  });

  it("uses Mafia Mayor as the tie-breaker vote", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "MMAYPR",
      mode: "mafia_free",
      playerCount: 4,
      tempoProfile: "manual",
      roles: {
        mafia_mayor: 1,
        commissioner: 1,
        civilian: 1,
        mafioso: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "mafia-mayor");
    const roleClients = await startGameAndCollectRoles(clients);
    const mayor = roleClients.find((item) => item.role === "mafia_mayor");
    const mafioso = roleClients.find((item) => item.role === "mafioso");
    expect(findPublicPlayer(serverRoom, mayor?.userId)?.mayor).toBe(false);
    expect([...serverRoom.state.publicEvents.values()].some(
      (event) => event.messageBg.includes(`${mayor?.displayName} е Кмет`),
    )).toBe(false);

    await advanceToVoting(clients[0]?.client, serverRoom);
    mayor?.client.send("submitVote", { targetUserId: mafioso?.userId });
    mafioso?.client.send("submitVote", { targetUserId: mayor?.userId });
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);

    expect(findPublicPlayer(serverRoom, mafioso?.userId)?.alive).toBe(false);
  });

  it("honors the revote tie-breaker override after game start", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "REVPTE",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      tieBreaker: "revote",
      roles: {
        ordinary_villager: 5,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "revote");
    const roleClients = await startGameAndCollectRoles(clients);
    await advanceToVoting(clients[0]?.client, serverRoom);
    const first = roleClients[0];
    const second = roleClients[1];
    const voteAck = first?.client.waitForMessage("vote_ack") as Promise<{ targetUserId: string }>;
    first?.client.send("submitVote", { targetUserId: second?.userId });
    await expect(voteAck).resolves.toMatchObject({ targetUserId: second?.userId });
    await serverRoom.waitForNextPatch(20);
    second?.client.send("submitVote", { targetUserId: first?.userId });
    await serverRoom.waitForNextPatch(20);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);

    expect(serverRoom.state.phase).toBe("voting");
    expect([...serverRoom.state.players.values()].every((player) => !player.hasVoted)).toBe(true);
    expect(serverRoom.state.voteTally.length).toBe(0);
    expect([...serverRoom.state.revoteEligibleUserIds]).toEqual(
      expect.arrayContaining([first?.userId, second?.userId]),
    );
    expect([...serverRoom.state.publicEvents.values()].some((event) => event.messageBg.includes("Следва прегласуване"))).toBe(true);

    const outsideTie = roleClients[2];
    const rejectedVote = outsideTie?.client.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    outsideTie?.client.send("submitVote", { targetUserId: outsideTie.userId });
    await expect(rejectedVote).resolves.toMatchObject({
      messageBg: "При прегласуване може да избереш само играч от равенството.",
    });

    const acceptedRevote = first?.client.waitForMessage("vote_ack") as Promise<{ targetUserId: string }>;
    first?.client.send("submitVote", { targetUserId: second?.userId });
    await expect(acceptedRevote).resolves.toMatchObject({ targetUserId: second?.userId });
  });

  it("supports skip votes and absolute-majority no-elimination", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "SKJP23",
      mode: "mafia_free",
      playerCount: 4,
      tempoProfile: "manual",
      allowSkipVote: true,
      majorityMode: "absolute",
      roles: {
        commissioner: 1,
        civilian: 2,
        mafioso: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "skip-vote");
    const roleClients = await startGameAndCollectRoles(clients);
    const mafioso = roleClients.find((item) => item.role === "mafioso");
    await advanceToVoting(clients[0]?.client, serverRoom);

    roleClients[0]?.client.send("submitVote", { targetUserId: mafioso?.userId });
    roleClients[1]?.client.send("submitVote", { targetUserId: "skip" });
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(20);

    expect(findPublicPlayer(serverRoom, mafioso?.userId)?.alive).toBe(true);
    expect([...serverRoom.state.publicEvents.values()].some((event) => event.messageBg.includes("абсолютно мнозинство"))).toBe(true);
  });

  it("allows spectators to join a locked room without receiving a private role", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "SPEC23",
      mode: "mafia_free",
      playerCount: 4,
      tempoProfile: "manual",
      roles: {
        commissioner: 1,
        civilian: 2,
        mafioso: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "spectator-game");
    await startGameAndCollectRoles(clients);

    const spectator = await colyseus.connectTo(serverRoom, {
      code: serverRoom.state.code,
      userId: "spectator-1",
      displayName: "Наблюдател",
      spectator: true,
    });
    const roleMessage = spectator.waitForMessage("private_role", 150) as Promise<unknown>;
    const publicSpectator = findPublicPlayer(serverRoom, "spectator-1");

    expect(publicSpectator?.playing).toBe(false);
    expect(publicSpectator?.alive).toBe(false);
    await expect(roleMessage).rejects.toThrow("timed out");
  });

  it("keeps the room hostable when a spectator joins before players", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "SPECFJ",
      mode: "mafia_free",
      playerCount: 4,
      tempoProfile: "manual",
      roles: {
        commissioner: 1,
        civilian: 2,
        mafioso: 1,
      },
    });
    const spectator = await colyseus.connectTo(serverRoom, {
      code: serverRoom.state.code,
      userId: "spectator-first",
      displayName: "Първи наблюдател",
      spectator: true,
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "after-spectator");
    const host = findPublicPlayer(serverRoom, clients[0]?.userId);

    expect(findPublicPlayer(serverRoom, "spectator-first")?.host).toBe(false);
    expect(host?.host).toBe(true);
    expect(host?.playing).toBe(true);

    const spectatorRole = spectator.waitForMessage("private_role", 150) as Promise<unknown>;
    await startGameAndCollectRoles(clients);

    expect(serverRoom.state.phase).not.toBe("lobby");
    await expect(spectatorRole).rejects.toThrow("timed out");
  });

  it("promotes a lobby spectator to player without letting the old spectator session remove the slot", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "SPECPR",
      mode: "mafia_free",
      playerCount: 4,
      tempoProfile: "manual",
      roles: {
        commissioner: 1,
        civilian: 2,
        mafioso: 1,
      },
    });
    const spectator = await colyseus.connectTo(serverRoom, {
      code: serverRoom.state.code,
      userId: "spectator-promote",
      displayName: "Наблюдател играч",
      spectator: true,
    });
    const promotedClient = await colyseus.connectTo(serverRoom, {
      code: serverRoom.state.code,
      userId: "spectator-promote",
      displayName: "Наблюдател играч",
    });
    const promoted = findPublicPlayer(serverRoom, "spectator-promote");

    expect(promoted?.host).toBe(true);
    expect(promoted?.playing).toBe(true);

    spectator.leave();
    await serverRoom.waitForNextPatch(20).catch(() => undefined);
    expect(findPublicPlayer(serverRoom, "spectator-promote")?.playing).toBe(true);

    const otherClients = await connectPlayers(colyseus, serverRoom, 3, "promoted-spectator");
    await startGameAndCollectRoles([
      {
        client: promotedClient,
        userId: "spectator-promote",
        displayName: "Наблюдател играч",
      },
      ...otherClients,
    ]);

    expect(serverRoom.state.phase).not.toBe("lobby");
  });

  it("does not let a spectator block full-narrator consent", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "NRSP23",
      mode: "mafia_free",
      playerCount: 4,
      narratorMode: "full_human",
    });
    const clients = await connectPlayers(colyseus, serverRoom, 5, "narrator-player");
    const spectator = await colyseus.connectTo(serverRoom, {
      code: "NRSP23",
      userId: "narrator-spectator",
      displayName: "Наблюдател",
      spectator: true,
    });

    for (const client of clients) {
      client.client.send("acceptFullNarrator", {});
    }
    await delay(50);

    const roleMessages = clients.slice(1).map((client) => waitForPrivateRole(client.client));
    clients[0]?.client.send("startGame", {});
    await Promise.all(roleMessages);

    expect(serverRoom.state.phase).toBe("role_reveal");
    expect(findPublicPlayer(serverRoom, "narrator-spectator")?.playing).toBe(false);
  });

  it("rejects ready changes after the lobby", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "RDYP23",
      mode: "werewolves_classic",
      playerCount: 6,
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "ready-player");
    clients[1]?.client.send("ready", { ready: true });
    await delay(25);
    await startGameAndCollectRoles(clients);

    const error = clients[1]?.client.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    clients[1]?.client.send("ready", { ready: false });

    await expect(error).resolves.toMatchObject({
      messageBg: "Готовността се променя само преди старт.",
    });
    expect(findPublicPlayer(serverRoom, "ready-player-2")?.ready).toBe(true);
  });

  it("keeps full-narrator consent private to participants and idempotent", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "NRCN23",
      mode: "mafia_free",
      playerCount: 4,
      narratorMode: "full_human",
    });
    const clients = await connectPlayers(colyseus, serverRoom, 5, "consent-player");
    const spectator = await colyseus.connectTo(serverRoom, {
      code: "NRCN23",
      userId: "consent-spectator",
      displayName: "Наблюдател",
      spectator: true,
    });

    const spectatorError = spectator.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    spectator.send("acceptFullNarrator", {});
    await expect(spectatorError).resolves.toMatchObject({
      messageBg: "Само участник може да приеме предупреждението за Пълен Разказвач.",
    });

    clients[1]?.client.send("acceptFullNarrator", {});
    clients[1]?.client.send("acceptFullNarrator", {});
    await delay(50);
    const acceptanceEvents = [...serverRoom.state.publicEvents.values()].filter(
      (event) => event.messageBg.includes("прие предупреждението за Пълен Разказвач"),
    );
    expect(acceptanceEvents).toHaveLength(1);
  });
});

async function connectPlayers(
  colyseus: ColyseusTestServer,
  room: GameRoom,
  count: number,
  prefix: string,
): Promise<JoinedClient[]> {
  const clients: JoinedClient[] = [];
  for (let index = 0; index < count; index += 1) {
    const userId = `${prefix}-${index + 1}`;
    const displayName = `Играч ${index + 1}`;
    clients.push({
      userId,
      displayName,
      client: await colyseus.connectTo(room, {
        code: room.state.code,
        userId,
        displayName,
      }),
    });
  }
  return clients;
}

async function startGameAndCollectRoles(clients: JoinedClient[]): Promise<RoleClient[]> {
  const rolePromises = clients.map(async (client) => ({
    ...client,
    ...((await waitForPrivateRole(client.client)) as { role: RoleCode; roleNameBg: string }),
  }));
  clients[0]?.client.send("startGame", {});
  return Promise.all(rolePromises);
}

async function startFullHumanGameAndCollectRoles(clients: JoinedClient[]): Promise<RoleClient[]> {
  for (const client of clients) {
    client.client.send("acceptFullNarrator", {});
  }
  await delay(50);

  const playingClients = clients.slice(1);
  const rolePromises = playingClients.map(async (client) => ({
    ...client,
    ...((await waitForPrivateRole(client.client)) as { role: RoleCode; roleNameBg: string }),
  }));
  clients[0]?.client.send("startGame", {});
  return Promise.all(rolePromises);
}

function waitForPrivateRole(client: ClientRoom<GameRoom, GameState>) {
  return client.waitForMessage("private_role") as Promise<{ role: RoleCode; roleNameBg: string }>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function advanceToVoting(client: ClientRoom<GameRoom, GameState> | undefined, room: GameRoom) {
  while (room.state.phase !== "voting") {
    client?.send("narratorAdvance", {});
    await room.waitForNextPatch(20);
  }
}

async function advanceToFirstNight(client: ClientRoom<GameRoom, GameState> | undefined, room: GameRoom) {
  while (room.state.phase !== "first_night") {
    client?.send("narratorAdvance", {});
    await room.waitForNextPatch(20);
  }
}

async function advanceToPhase(client: ClientRoom<GameRoom, GameState> | undefined, room: GameRoom, phase: string) {
  while (room.state.phase !== phase) {
    client?.send("narratorAdvance", {});
    await room.waitForNextPatch(20);
  }
}

async function drainNightActionCapabilities(client: ClientRoom<GameRoom, GameState> | undefined) {
  if (!client) {
    return;
  }

  while (true) {
    try {
      await client.waitForMessage("night_action_capabilities", 50);
    } catch {
      return;
    }
  }
}

async function waitForCondition(
  condition: () => boolean,
  message: string,
  timeoutMs = 3_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(message);
}

async function waitForNightActionCapabilitiesMatching(
  client: ClientRoom<GameRoom, GameState> | undefined,
  matches: (capabilities: NightActionCapabilities) => boolean,
) {
  if (!client) {
    throw new Error("Missing client for night action capabilities assertion.");
  }

  let lastCapabilities: NightActionCapabilities | undefined;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const message = await client.waitForMessage("night_action_capabilities", 300) as {
      capabilities: NightActionCapabilities;
    };
    lastCapabilities = message.capabilities;
    if (matches(message.capabilities)) {
      return message.capabilities;
    }
  }

  throw new Error(`No matching night action capabilities received. Last payload: ${JSON.stringify(lastCapabilities)}`);
}

function findPublicPlayer(room: GameRoom, userId: string | undefined) {
  return [...room.state.players.values()].find((player) => player.userId === userId);
}

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function submitSimpleAdvancedAction(
  actor: RoleClient | undefined,
  target: RoleClient | undefined,
  allPlayers: RoleClient[],
) {
  if (!actor || !target) {
    return;
  }
  if (actor.role === "investigator") {
    actor.client.send("submitNightAction", { action: { kind: "investigator_check", targetUserId: target.userId } });
    return;
  }
  if (actor.role === "blacksmith") {
    const receiver = allPlayers.find((item) => item.userId !== actor.userId && item.userId !== target.userId);
    actor.client.send("submitNightAction", {
      action: { kind: "blacksmith_sword", receiverUserId: receiver?.userId, targetUserId: target.userId },
    });
    return;
  }
  if (actor.role === "priest") {
    actor.client.send("submitNightAction", { action: { kind: "priest_bless", targetUserId: target.userId } });
    return;
  }
  actor.client.send("submitNightAction", { action: { kind: "faction_kill", targetUserId: target.userId } });
}
