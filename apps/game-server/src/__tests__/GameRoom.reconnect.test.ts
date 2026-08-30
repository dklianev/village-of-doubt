import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { NightActionCapabilities, PrivateCheckResult, PrivateFactionRoster } from "@werewolf/shared";
import appConfig from "../app.config.js";
import type { GameRoom } from "../rooms/GameRoom.js";
import type { GameState } from "../rooms/schemas/GameState.js";
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
  waitForPrivateRole,
} from "./helpers.js";

describe("GameRoom reconnect resilience", () => {
  let colyseus: ColyseusTestServer;
  let previousAllowDevAuth: string | undefined;
  let previousNodeEnv: string | undefined;

  beforeEach(async () => {
    previousAllowDevAuth = process.env.ALLOW_DEV_AUTH;
    previousNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "test";
    colyseus = await boot(appConfig, 2680);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
    await colyseus?.shutdown();
    restoreEnvValue("ALLOW_DEV_AUTH", previousAllowDevAuth);
    restoreEnvValue("NODE_ENV", previousNodeEnv);
  });

  it("restores a disconnected player's private role without leaking it publicly", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "RECPN3",
      mode: "werewolves_classic",
      playerCount: 8,
      tempoProfile: "manual",
      roles: {
        ordinary_villager: 6,
        werewolf: 2,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 8, "reconnect");
    const roleClients = await startGameAndCollectRoles(clients);
    const werewolf = roleClients.find((client) => client.role === "werewolf");
    const werewolfAlly = roleClients.find((client) => client.role === "werewolf" && client.userId !== werewolf?.userId);
    const target = roleClients.find((client) => client.role === "ordinary_villager");

    expect(werewolf).toBeTruthy();
    expect(target).toBeTruthy();

    const initialCapabilities = werewolf?.client.waitForMessage("night_action_capabilities") as Promise<{
      capabilities: NightActionCapabilities;
    }>;
    await advanceToFirstNight(clients[0]?.client, serverRoom);
    await expect(initialCapabilities).resolves.toMatchObject({
      capabilities: expect.objectContaining({
        availableKinds: expect.arrayContaining(["faction_kill"]),
      }),
    });
    werewolf?.client.leave();
    await delay(40);

    const reconnected = await connectWithRetry(colyseus, serverRoom, {
      code: serverRoom.state.code,
      userId: werewolf?.userId ?? "",
      displayName: werewolf?.displayName ?? "",
    });
    const privateRolePromise = waitForPrivateRole(reconnected);
    const capabilitiesPromise = reconnected.waitForMessage("night_action_capabilities") as Promise<{
      capabilities: NightActionCapabilities;
    }>;
    const rosterPromise = reconnected.waitForMessage("private_faction_roster") as Promise<PrivateFactionRoster>;
    const syncResult = await reconnected.request("syncPrivateState");
    expect(syncResult).toEqual({ synchronized: true });
    const privateRole = await privateRolePromise;
    const capabilities = await capabilitiesPromise;
    const roster = await rosterPromise;

    expect(privateRole.role).toBe(werewolf?.role);
    expect(capabilities.capabilities.availableKinds).toContain("faction_kill");
    expect(capabilities.capabilities.disallowedTargetsByKind.faction_kill).toContainEqual({
      id: werewolfAlly?.userId,
      reasonBg: "Не можеш да избереш свой съотборник.",
    });
    expect(roster).toMatchObject({
      faction: "werewolves",
      members: [{ userId: werewolfAlly?.userId, displayName: werewolfAlly?.displayName }],
    });
    expect(publicEvents(serverRoom).some((message) => message.includes("се върна в стаята"))).toBe(true);

    const reconnectedState = reconnected.state as GameState;
    for (const player of reconnectedState.players.values()) {
      expect(Object.prototype.hasOwnProperty.call(player, "role")).toBe(false);
    }

    const publicWerewolf = findPublicPlayer(serverRoom, werewolf?.userId);
    expect(publicWerewolf?.connected).toBe(true);

    const actionAck = reconnected.waitForMessage("night_action_ack") as Promise<unknown>;
    reconnected.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: target?.userId },
    });
    await actionAck;
    expect(findPublicPlayer(serverRoom, werewolf?.userId)?.actedThisPhase).toBe(false);
  });

  it("replays the Priest's retained private blessing after reconnect", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "REBLSS",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: {
        priest: 1,
        blacksmith: 1,
        vampire_hunter: 1,
        witch: 1,
        ordinary_villager: 1,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "blessing-reconnect");
    const roleClients = await startGameAndCollectRoles(clients);
    const priest = roleClients.find((client) => client.role === "priest");
    const target = roleClients.find((client) => client.role === "ordinary_villager");
    expect(priest && target).toBeTruthy();

    await advanceToFirstNight(clients[0]?.client, serverRoom);
    const firstBlessing = target?.client.waitForMessage("private_blessing") as Promise<{
      targetUserId: string;
      targetName: string;
    }>;
    const ack = priest?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    priest?.client.send("submitNightAction", { action: { kind: "priest_bless", targetUserId: target?.userId } });
    await ack;
    clients[0]?.client.send("narratorAdvance", {});
    await expect(firstBlessing).resolves.toMatchObject({ targetUserId: target?.userId });

    target?.client.leave();
    await delay(40);
    const reconnected = await connectWithRetry(colyseus, serverRoom, {
      code: serverRoom.state.code,
      userId: target?.userId ?? "",
      displayName: target?.displayName ?? "",
    });
    const replayedBlessing = reconnected.waitForMessage("private_blessing") as Promise<{
      targetUserId: string;
      targetName: string;
    }>;
    await reconnected.request("syncPrivateState");

    await expect(replayedBlessing).resolves.toMatchObject({
      targetUserId: target?.userId,
      targetName: target?.displayName,
    });
    for (const player of (reconnected.state as GameState).players.values()) {
      expect("priestBlessed" in (player as unknown as Record<string, unknown>)).toBe(false);
    }
  });

  it("replays a Priest-only blessed-target capability after reconnect without public leakage", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "PRCAP3",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: {
        priest: 1,
        blacksmith: 1,
        vampire_hunter: 1,
        witch: 1,
        ordinary_villager: 1,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "priest-cap-reconnect");
    const roleClients = await startGameAndCollectRoles(clients);
    const reconnectingPriest = roleClients.find((client) => client.role === "priest");
    const target = roleClients.find((client) => client.role === "ordinary_villager");
    expect(reconnectingPriest && target).toBeTruthy();

    await advanceToFirstNight(clients[0]?.client, serverRoom);
    const privatePlayers = (serverRoom as unknown as {
      privatePlayers: Map<string, { priestBlessed?: boolean }>;
    }).privatePlayers;
    const privateTarget = target ? privatePlayers.get(target.userId) : undefined;
    expect(privateTarget).toBeTruthy();
    if (privateTarget) {
      privateTarget.priestBlessed = true;
    }

    reconnectingPriest?.client.leave();
    await delay(40);
    const reconnected = await connectWithRetry(colyseus, serverRoom, {
      code: serverRoom.state.code,
      userId: reconnectingPriest?.userId ?? "",
      displayName: reconnectingPriest?.displayName ?? "",
    });
    const capabilitiesPromise = reconnected.waitForMessage("night_action_capabilities") as Promise<{
      capabilities: NightActionCapabilities;
    }>;
    await reconnected.request("syncPrivateState");
    const capabilities = await capabilitiesPromise;

    expect(capabilities.capabilities.availableKinds).toContain("priest_bless");
    expect(capabilities.capabilities.disallowedTargetsByKind.priest_bless).toContainEqual({
      id: target?.userId,
      reasonBg: "Този играч вече е благословен.",
    });
    for (const player of (reconnected.state as GameState).players.values()) {
      expect("priestBlessed" in (player as unknown as Record<string, unknown>)).toBe(false);
    }
  });

  it("replays the Witch's current private heal target after reconnect", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "WTCAP3",
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
    const clients = await connectPlayers(colyseus, serverRoom, 6, "witch-cap-reconnect");
    const roleClients = await startGameAndCollectRoles(clients);
    const witch = roleClients.find((client) => client.role === "witch");
    const werewolf = roleClients.find((client) => client.role === "werewolf");
    const victim = roleClients.find((client) => client.role === "ordinary_villager");
    expect(witch && werewolf && victim).toBeTruthy();

    await advanceToFirstNight(clients[0]?.client, serverRoom);
    const refreshedCapabilities = witch?.client.waitForMessage("night_action_capabilities") as Promise<{
      capabilities: NightActionCapabilities;
    }>;
    const actionAck = werewolf?.client.waitForMessage("night_action_ack") as Promise<unknown>;
    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: victim?.userId },
    });
    await actionAck;
    await expect(refreshedCapabilities).resolves.toMatchObject({
      capabilities: expect.objectContaining({
        allowedTargetIdsByKind: {
          witch_heal: [victim?.userId],
        },
      }),
    });

    witch?.client.leave();
    await delay(40);
    const reconnected = await connectWithRetry(colyseus, serverRoom, {
      code: serverRoom.state.code,
      userId: witch?.userId ?? "",
      displayName: witch?.displayName ?? "",
    });
    const replayedCapabilitiesPromise = reconnected.waitForMessage("night_action_capabilities") as Promise<{
      capabilities: NightActionCapabilities;
    }>;
    await reconnected.request("syncPrivateState");
    const replayedCapabilities = await replayedCapabilitiesPromise;

    expect(replayedCapabilities.capabilities.allowedTargetIdsByKind?.witch_heal).toEqual([victim?.userId]);
    expect("nightActionCapabilities" in (reconnected.state as unknown as Record<string, unknown>)).toBe(false);
    for (const player of (reconnected.state as GameState).players.values()) {
      expect("nightActionCapabilities" in (player as unknown as Record<string, unknown>)).toBe(false);
    }
  });

  it("replays the viewer's latest private investigation result after reconnect", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "RCHCK3",
      mode: "mafia_free",
      playerCount: 6,
      tempoProfile: "manual",
      firstNightKill: false,
      roles: {
        commissioner: 1,
        mafioso: 1,
        civilian: 4,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "check-reconnect");
    const roleClients = await startGameAndCollectRoles(clients);
    const commissioner = roleClients.find((client) => client.role === "commissioner");
    const target = roleClients.find((client) => client.role === "mafioso");
    expect(commissioner && target).toBeTruthy();

    await advanceToFirstNight(clients[0]?.client, serverRoom);
    const initialResult = commissioner?.client.waitForMessage("private_check_result") as Promise<PrivateCheckResult>;
    commissioner?.client.send("submitNightAction", {
      action: { kind: "check_alignment", targetUserId: target?.userId },
    });
    clients[0]?.client.send("narratorAdvance", {});
    await expect(initialResult).resolves.toMatchObject({ targetUserId: target?.userId, isEvil: true });

    commissioner?.client.leave();
    await delay(40);
    const reconnected = await connectWithRetry(colyseus, serverRoom, {
      code: serverRoom.state.code,
      userId: commissioner?.userId ?? "",
      displayName: commissioner?.displayName ?? "",
    });
    const replayedResult = reconnected.waitForMessage("private_check_result") as Promise<PrivateCheckResult>;
    await reconnected.request("syncPrivateState");

    await expect(replayedResult).resolves.toMatchObject({ targetUserId: target?.userId, isEvil: true });
    expect("privateCheckResult" in (reconnected.state as unknown as Record<string, unknown>)).toBe(false);
  });

  it("resends night-action capabilities after a paused night resumes", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "PACAPR",
      mode: "werewolves_classic",
      playerCount: 8,
      tempoProfile: "manual",
      roles: {
        ordinary_villager: 6,
        werewolf: 2,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 8, "pause-capability");
    const roleClients = await startGameAndCollectRoles(clients);
    const reconnectingWolf = roleClients.find(
      (item) => item.role === "werewolf" && item.userId !== clients[0]?.userId,
    );
    expect(reconnectingWolf).toBeTruthy();

    await advanceToFirstNight(clients[0]?.client, serverRoom);
    clients[0]?.client.send("narratorPause", {});
    await serverRoom.waitForNextPatch(25).catch(() => undefined);
    expect(serverRoom.state.phase).toBe("paused");

    reconnectingWolf?.client.leave();
    await delay(40);
    const reconnected = await connectWithRetry(colyseus, serverRoom, {
      code: serverRoom.state.code,
      userId: reconnectingWolf?.userId ?? "",
      displayName: reconnectingWolf?.displayName ?? "",
    });
    const capabilitiesAfterResume = reconnected.waitForMessage("night_action_capabilities") as Promise<{
      capabilities: NightActionCapabilities;
    }>;

    clients[0]?.client.send("narratorAdvance", {});

    await expect(capabilitiesAfterResume).resolves.toMatchObject({
      capabilities: {
        availableKinds: expect.arrayContaining(["faction_kill"]),
      },
    });
    expect(serverRoom.state.phase).toBe("first_night");
  });
});
