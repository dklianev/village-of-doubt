import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { Room as ClientRoom } from "@colyseus/sdk";
import type { RoleCode } from "@werewolf/shared";
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

  beforeAll(async () => {
    process.env.ALLOW_DEV_AUTH = "true";
    colyseus = await boot(appConfig, 2679);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
  });

  afterAll(async () => {
    await colyseus?.shutdown();
    delete process.env.ALLOW_DEV_AUTH;
  });

  it("rejects impossible manual role counts before any role is revealed", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "BADROL",
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
      code: "CUPID1",
      mode: "mafia_free",
      playerCount: 4,
      roles: {
        cupid: 1,
        civilian: 2,
        mafioso: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "cupid");
    const roleClients = await startGameAndCollectRoles(clients);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();

    const cupid = roleClients.find((item) => item.role === "cupid");
    const lovers = roleClients.filter((item) => item.userId !== cupid?.userId).slice(0, 2);
    expect(cupid).toBeTruthy();
    expect(lovers).toHaveLength(2);

    const firstLoverMessage = lovers[0]?.client.waitForMessage("private_lovers") as Promise<{ loverUserId: string }>;
    const secondLoverMessage = lovers[1]?.client.waitForMessage("private_lovers") as Promise<{ loverUserId: string }>;
    cupid?.client.send("submitNightAction", {
      action: {
        kind: "cupid_link",
        firstUserId: lovers[0]?.userId,
        secondUserId: lovers[1]?.userId,
      },
    });

    await expect(firstLoverMessage).resolves.toMatchObject({ loverUserId: lovers[1]?.userId });
    await expect(secondLoverMessage).resolves.toMatchObject({ loverUserId: lovers[0]?.userId });
  });

  it("prevents Witch from reusing the same consumable", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "WITCH1",
      mode: "mafia_free",
      playerCount: 4,
      roles: {
        witch: 1,
        civilian: 2,
        mafioso: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "witch");
    const roleClients = await startGameAndCollectRoles(clients);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();

    const witch = roleClients.find((item) => item.role === "witch");
    const targets = roleClients.filter((item) => item.userId !== witch?.userId);
    expect(witch).toBeTruthy();

    witch?.client.send("submitNightAction", {
      action: { kind: "witch_poison", targetUserId: targets[0]?.userId },
    });
    const error = witch?.client.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    witch?.client.send("submitNightAction", {
      action: { kind: "witch_poison", targetUserId: targets[1]?.userId },
    });

    await expect(error).resolves.toMatchObject({
      messageBg: "Вещицата вече е използвала отровата си.",
    });
  });

  it("lets the Priest give one persistent blessing that blocks a night death", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "PRIEST",
      mode: "mafia_free",
      playerCount: 4,
      roles: {
        priest: 1,
        ordinary_villager: 1,
        werewolf: 1,
        vampire: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "priest");
    const roleClients = await startGameAndCollectRoles(clients);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();

    const priest = roleClients.find((item) => item.role === "priest");
    const vampire = roleClients.find((item) => item.role === "vampire");
    const blessed = roleClients.find((item) => item.role === "ordinary_villager");
    expect(priest).toBeTruthy();
    expect(vampire).toBeTruthy();
    expect(blessed).toBeTruthy();

    const blessingMessage = blessed?.client.waitForMessage("private_blessing") as Promise<{ targetUserId: string }>;
    priest?.client.send("submitNightAction", {
      action: { kind: "priest_bless", targetUserId: blessed?.userId },
    });
    await expect(blessingMessage).resolves.toMatchObject({ targetUserId: blessed?.userId });

    vampire?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: blessed?.userId },
    });
    const savedMessage = blessed?.client.waitForMessage("system") as Promise<{ messageBg: string }>;
    clients[0]?.client.send("narratorAdvance", {});
    await expect(savedMessage).resolves.toMatchObject({
      messageBg: expect.stringContaining("Благословията те спаси"),
    });
    await serverRoom.waitForNextPatch(20);

    const blessedState = [...serverRoom.state.players.values()].find((player) => player.userId === blessed?.userId);
    expect(blessedState?.alive).toBe(true);
    expect([...serverRoom.state.publicEvents.values()].some((event) => event.messageBg.includes("Благословия спря"))).toBe(true);
  });

  it("lets the Thief steal a role once and turns the target into an ordinary villager", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "THIEF1",
      mode: "mafia_free",
      playerCount: 4,
      roles: {
        thief: 1,
        werewolf: 1,
        ordinary_villager: 1,
        seer: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "thief");
    const roleClients = await startGameAndCollectRoles(clients);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();

    const thief = roleClients.find((item) => item.role === "thief");
    const werewolf = roleClients.find((item) => item.role === "werewolf");
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

    const rejectedWerewolfAction = werewolf?.client.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: clients[0]?.userId },
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

  it("lets the Healer protect themselves", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "HEAL01",
      mode: "mafia_free",
      playerCount: 4,
      roles: {
        healer: 1,
        ordinary_villager: 2,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "healer");
    const roleClients = await startGameAndCollectRoles(clients);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();

    const healer = roleClients.find((item) => item.role === "healer");
    const werewolf = roleClients.find((item) => item.role === "werewolf");
    expect(healer).toBeTruthy();
    expect(werewolf).toBeTruthy();

    healer?.client.send("submitNightAction", {
      action: { kind: "healer_protect", targetUserId: healer?.userId },
    });
    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: healer?.userId },
    });
    const ignoredAdvanceError = clients[0]?.client.waitForMessage("safe_error", 200).catch(() => undefined);
    clients[0]?.client.send("narratorAdvance", {});
    await ignoredAdvanceError;
    await serverRoom.waitForNextPatch(20);

    const healerState = [...serverRoom.state.players.values()].find((player) => player.userId === healer?.userId);
    expect(healerState?.alive).toBe(true);
  });

  it("enters hunter revenge when the Hunter dies at night", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "HUNT01",
      mode: "mafia_free",
      playerCount: 4,
      roles: {
        hunter: 1,
        civilian: 2,
        mafioso: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "hunter");
    const roleClients = await startGameAndCollectRoles(clients);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch();

    const hunter = roleClients.find((item) => item.role === "hunter");
    const mafioso = roleClients.find((item) => item.role === "mafioso");
    const revengeTarget = roleClients.find((item) => item.role === "civilian");
    expect(hunter).toBeTruthy();
    expect(mafioso).toBeTruthy();
    expect(revengeTarget).toBeTruthy();

    mafioso?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: hunter?.userId },
    });
    await serverRoom.waitForNextPatch(20);
    expect(serverRoom.state.phase).toBe("hunter_revenge");

    hunter?.client.send("submitHunterRevenge", { targetUserId: revengeTarget?.userId });
    await serverRoom.waitForNextPatch(20);
    const targetState = [...serverRoom.state.players.values()].find((player) => player.userId === revengeTarget?.userId);
    expect(targetState?.alive).toBe(false);
  });

  it("records a Jester personal win when the village votes them out", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "JESTER",
      mode: "mafia_free",
      playerCount: 4,
      roles: {
        jester: 1,
        ordinary_villager: 2,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 4, "jester");
    const roleClients = await startGameAndCollectRoles(clients);
    const jester = roleClients.find((item) => item.role === "jester");
    expect(jester).toBeTruthy();

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
  });
});

async function connectPlayers(
  colyseus: ColyseusTestServer,
  room: GameRoom,
  count: number,
  prefix: string,
): Promise<JoinedClient[]> {
  return Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const userId = `${prefix}-${index + 1}`;
      return {
        userId,
        displayName: `Играч ${index + 1}`,
        client: await colyseus.connectTo(room, {
          code: room.state.code,
          userId,
          displayName: `Играч ${index + 1}`,
        }),
      };
    }),
  );
}

async function startGameAndCollectRoles(clients: JoinedClient[]): Promise<RoleClient[]> {
  const rolePromises = clients.map(async (client) => ({
    ...client,
    ...((await waitForPrivateRole(client.client)) as { role: RoleCode; roleNameBg: string }),
  }));
  clients[0]?.client.send("startGame", {});
  return Promise.all(rolePromises);
}

function waitForPrivateRole(client: ClientRoom<GameRoom, GameState>) {
  return client.waitForMessage("private_role") as Promise<{ role: RoleCode; roleNameBg: string }>;
}
