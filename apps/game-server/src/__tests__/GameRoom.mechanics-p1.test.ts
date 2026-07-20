import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../app.config.js";
import { getGameRuntimeStats, type GameRoom } from "../rooms/GameRoom.js";
import type { PrivatePlayerState } from "../rooms/game-room-runtime.js";
import type { SubmittedNightAction } from "../game-logic/night-resolver.js";
import {
  advanceToFirstNight,
  connectPlayers,
  delay,
  findPublicPlayer,
  restoreEnvValue,
  startGameAndCollectRoles,
} from "./helpers.js";

type RoomMechanics = {
  privatePlayers: Map<string, PrivatePlayerState>;
  pendingNightActions: Map<string, SubmittedNightAction[]>;
};

describe("GameRoom P1 authoritative mechanics", () => {
  let colyseus: ColyseusTestServer;
  let previousAllowDevAuth: string | undefined;
  let previousNodeEnv: string | undefined;

  beforeAll(async () => {
    previousAllowDevAuth = process.env.ALLOW_DEV_AUTH;
    previousNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "test";
    colyseus = await boot(appConfig, 2686);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await colyseus.cleanup();
  });

  afterAll(async () => {
    await colyseus.shutdown();
    restoreEnvValue("ALLOW_DEV_AUTH", previousAllowDevAuth);
    restoreEnvValue("NODE_ENV", previousNodeEnv);
  });

  it("rejects incompatible role dependencies while creating the authoritative room", async () => {
    const activeRoomsBefore = getGameRuntimeStats().activeRooms;
    await expect(colyseus.createRoom<GameRoom>("game", {
      code: "HARDCP",
      mode: "werewolves_classic",
      playerCount: 8,
      roles: { ordinary_villager: 4, werewolf: 2, red_riding_hood: 1, seer: 1 },
    })).rejects.toThrow("Червена шапчица може да се включи само ако Ловецът също е в играта.");
    expect(getGameRuntimeStats().activeRooms).toBe(activeRoomsBefore);
  });

  it("accepts Witch healing only for the current faction consensus victim", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "WHAUTH",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: { ordinary_villager: 2, werewolf: 2, seer: 1, witch: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "witch-authority");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const witch = roles.find((item) => item.role === "witch");
    const wolves = roles.filter((item) => item.role === "werewolf");
    const victim = roles.find((item) => item.role === "ordinary_villager");
    const mechanics = room as unknown as RoomMechanics;

    const firstVoteAck = wolves[0]?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    wolves[0]?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: victim?.userId },
    });
    await firstVoteAck;

    const rejected = Promise.race([
      witch?.client.waitForMessage("safe_error", 500).then((payload) => ({ type: "error", payload })),
      witch?.client.waitForMessage("night_action_ack", 500).then((payload) => ({ type: "ack", payload })),
    ]);
    witch?.client.send("submitNightAction", {
      action: { kind: "witch_heal", targetUserId: victim?.userId },
    });

    await expect(rejected).resolves.toMatchObject({
      type: "error",
      payload: { messageBg: "Вещицата може да лекува само текущата жертва на вражеска фракция." },
    });
    expect(mechanics.privatePlayers.get(witch?.userId ?? "")?.witchHealUsed).toBe(false);
    expect(mechanics.pendingNightActions.get(witch?.userId ?? "") ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ action: expect.objectContaining({ kind: "witch_heal" }) }),
    ]));

    const secondVoteAck = wolves[1]?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    wolves[1]?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: victim?.userId },
    });
    await secondVoteAck;

    const healAck = witch?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    witch?.client.send("submitNightAction", {
      action: { kind: "witch_heal", targetUserId: victim?.userId },
    });
    await expect(healAck).resolves.toBeTruthy();
  });

  it.each([
    { role: "lawyer" as const, special: "lawyer_cover" as const },
    { role: "informant" as const, special: "check_role" as const },
  ])("retains $role special action together with its faction-kill vote", async ({ role, special }) => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: role === "lawyer" ? "LAWDU2" : "NFFDU2",
      mode: "mafia_free",
      playerCount: 4,
      tempoProfile: "manual",
      firstNightKill: true,
      roles: { civilian: 1, commissioner: 1, mafioso: 1, [role]: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 4, `${role}-dual`);
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const actor = roles.find((item) => item.role === role);
    const specialTarget = roles.find((item) => item.role === (role === "lawyer" ? "mafioso" : "civilian"));
    const victim = roles.find((item) => item.role === "commissioner");

    const specialAck = actor?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    actor?.client.send("submitNightAction", {
      action: { kind: special, targetUserId: specialTarget?.userId },
    });
    await specialAck;
    const killAck = actor?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    actor?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: victim?.userId },
    });
    await killAck;

    const kinds = ((room as unknown as RoomMechanics).pendingNightActions.get(actor?.userId ?? "") ?? [])
      .map((submission) => submission.action.kind);
    expect(kinds).toEqual(expect.arrayContaining([special, "faction_kill"]));
  });

  it("keeps a partial Don choice when skip finalizes the rest of the night", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "DNFN22",
      mode: "mafia_free",
      playerCount: 4,
      tempoProfile: "manual",
      roles: { civilian: 1, commissioner: 1, mafioso: 1, don: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 4, "don-finalize");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const don = roles.find((item) => item.role === "don");
    const commissioner = roles.find((item) => item.role === "commissioner");

    for (const action of [
      { kind: "check_commissioner" as const, targetUserId: commissioner?.userId ?? "" },
      { kind: "skip" as const },
    ]) {
      const ack = don?.client.waitForMessage("night_action_ack") as Promise<unknown>;
      don?.client.send("submitNightAction", { action });
      await ack;
    }

    const kinds = ((room as unknown as RoomMechanics).pendingNightActions.get(don?.userId ?? "") ?? [])
      .map((submission) => submission.action.kind);
    expect(kinds).toEqual(expect.arrayContaining(["check_commissioner", "skip"]));
  });

  it("keeps a partial Witch choice when skip finalizes the unused potion", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "WTCFN2",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: { ordinary_villager: 3, werewolf: 1, seer: 1, witch: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "witch-finalize");
    const roles = await startGameAndCollectRoles(clients);
    await advanceToFirstNight(clients[0]?.client, room);
    const witch = roles.find((item) => item.role === "witch");
    const poisonTarget = roles.find((item) => item.role === "ordinary_villager");

    for (const action of [
      { kind: "witch_poison" as const, targetUserId: poisonTarget?.userId ?? "" },
      { kind: "skip" as const },
    ]) {
      const ack = witch?.client.waitForMessage("night_action_ack") as Promise<unknown>;
      witch?.client.send("submitNightAction", { action });
      await ack;
    }

    const kinds = ((room as unknown as RoomMechanics).pendingNightActions.get(witch?.userId ?? "") ?? [])
      .map((submission) => submission.action.kind);
    expect(kinds).toEqual(expect.arrayContaining(["witch_poison", "skip"]));
  });

  it("reconciles a lobby-selected public Mayor with a distinct secret Mayor card", async () => {
    const room = await colyseus.createRoom<GameRoom>("game", {
      code: "MAYNE2",
      mode: "werewolves_classic",
      playerCount: 6,
      mayorMode: "public_vote",
      tempoProfile: "manual",
      roles: { mayor: 1, ordinary_villager: 4, werewolf: 1 },
    });
    const clients = await connectPlayers(colyseus, room, 6, "mayor-one");
    const selectedMayor = clients[0];
    selectedMayor?.client.send("setMayor", { targetUserId: selectedMayor.userId });
    await room.waitForNextPatch(25).catch(() => delay(25));

    const randomSpy = vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation((array) => {
      new Uint32Array(array.buffer, array.byteOffset, Math.floor(array.byteLength / 4)).fill(0);
      return array;
    });
    const roles = await startGameAndCollectRoles(clients);
    randomSpy.mockRestore();
    const cardMayor = roles.find((item) => item.role === "mayor");
    expect(cardMayor?.userId).toBe(selectedMayor?.userId);

    const mechanics = room as unknown as RoomMechanics;
    const mechanicalMayorIds = new Set<string>();
    for (const player of room.state.players.values()) {
      if (player.mayor) {
        mechanicalMayorIds.add(player.userId);
      }
    }
    for (const player of mechanics.privatePlayers.values()) {
      if (player.isMayor) {
        mechanicalMayorIds.add(player.userId);
      }
    }

    expect([...mechanicalMayorIds]).toEqual([selectedMayor?.userId]);
    expect([...room.state.players.values()].filter((player) => player.mayor)).toHaveLength(1);
    expect(findPublicPlayer(room, selectedMayor?.userId)?.mayor).toBe(true);
  });
});
