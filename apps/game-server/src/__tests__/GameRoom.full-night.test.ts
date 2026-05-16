import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../app.config.js";
import type { GameRoom } from "../rooms/GameRoom.js";
import {
  advanceToFirstNight,
  advanceToPhase,
  connectPlayers,
  findPublicPlayer,
  restoreEnvValue,
  startGameAndCollectRoles,
} from "./helpers.js";

describe("GameRoom full-night launch smoke", () => {
  let colyseus: ColyseusTestServer;
  let previousAllowDevAuth: string | undefined;
  let previousNodeEnv: string | undefined;

  beforeEach(async () => {
    previousAllowDevAuth = process.env.ALLOW_DEV_AUTH;
    previousNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "test";
    colyseus = await boot(appConfig, 2681);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
    await colyseus?.shutdown();
    restoreEnvValue("ALLOW_DEV_AUTH", previousAllowDevAuth);
    restoreEnvValue("NODE_ENV", previousNodeEnv);
  });

  it("runs from lobby through night result, vote and game over", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "FULL01",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: {
        ordinary_villager: 5,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "full-night");
    const roleClients = await startGameAndCollectRoles(clients);
    const werewolf = roleClients.find((client) => client.role === "werewolf");
    const victim = roleClients.find((client) => client.role === "ordinary_villager");

    expect(werewolf).toBeTruthy();
    expect(victim).toBeTruthy();

    await advanceToFirstNight(clients[0]?.client, serverRoom);
    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: victim?.userId },
    });
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(25).catch(() => undefined);

    expect(findPublicPlayer(serverRoom, victim?.userId)?.alive).toBe(false);
    await advanceToPhase(clients[0]?.client, serverRoom, "voting");

    for (const client of roleClients.filter((item) => item.userId !== werewolf?.userId && findPublicPlayer(serverRoom, item.userId)?.alive)) {
      client.client.send("submitVote", { targetUserId: werewolf?.userId });
    }
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(25).catch(() => undefined);
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(25).catch(() => undefined);

    expect(serverRoom.state.phase).toBe("game_over");
    expect(serverRoom.state.winnerTeam).toBe("village");
  });

  it("resolves Hunter revenge before declaring werewolves winner at parity", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "HREV01",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: {
        ordinary_villager: 2,
        hunter: 1,
        werewolf: 3,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "hunter-revenge");
    const roleClients = await startGameAndCollectRoles(clients);
    const hunter = roleClients.find((client) => client.role === "hunter");
    const wolves = roleClients.filter((client) => client.role === "werewolf");
    const revengeTarget = wolves[0];

    expect(hunter).toBeTruthy();
    expect(wolves).toHaveLength(3);
    expect(revengeTarget).toBeTruthy();

    await advanceToFirstNight(clients[0]?.client, serverRoom);
    for (const wolf of wolves) {
      wolf.client.send("submitNightAction", {
        action: { kind: "faction_kill", targetUserId: hunter?.userId },
      });
    }
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(25).catch(() => undefined);

    expect(serverRoom.state.phase).toBe("hunter_revenge");
    expect(findPublicPlayer(serverRoom, hunter?.userId)?.alive).toBe(false);

    hunter?.client.send("submitHunterRevenge", { targetUserId: revengeTarget?.userId });
    await serverRoom.waitForNextPatch(25).catch(() => undefined);
    expect(findPublicPlayer(serverRoom, revengeTarget?.userId)?.alive).toBe(false);
    expect(serverRoom.state.phase).toBe("resolution");

    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(25).catch(() => undefined);

    expect(serverRoom.state.phase).toBe("game_over");
    expect(serverRoom.state.winnerTeam).toBe("werewolves");
    expect(serverRoom.state.winnerReasonBg).toBe("Върколаците са равни или повече от живите селяни.");
  });
});
