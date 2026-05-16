import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../app.config.js";
import type { GameRoom } from "../rooms/GameRoom.js";
import {
  advanceToFirstNight,
  connectPlayers,
  findPublicPlayer,
  restoreEnvValue,
  startGameAndCollectRoles,
} from "./helpers.js";

describe("GameRoom mayor succession", () => {
  let colyseus: ColyseusTestServer;
  let previousAllowDevAuth: string | undefined;
  let previousNodeEnv: string | undefined;

  beforeEach(async () => {
    previousAllowDevAuth = process.env.ALLOW_DEV_AUTH;
    previousNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "test";
    colyseus = await boot(appConfig, 2682);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
    await colyseus?.shutdown();
    restoreEnvValue("ALLOW_DEV_AUTH", previousAllowDevAuth);
    restoreEnvValue("NODE_ENV", previousNodeEnv);
  });

  it("asks for a successor when the current Mayor dies", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "MAYSUC",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: {
        hunter: 1,
        ordinary_villager: 4,
        werewolf: 1,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "mayor-succession");
    const roleClients = await startGameAndCollectRoles(clients);
    const mayor = roleClients.find((client) => client.role === "ordinary_villager");
    const werewolf = roleClients.find((client) => client.role === "werewolf");
    const successor = roleClients.find((client) => client.role === "ordinary_villager" && client.userId !== mayor?.userId);

    expect(mayor).toBeTruthy();
    expect(werewolf).toBeTruthy();
    expect(successor).toBeTruthy();

    const mayorState = findPublicPlayer(serverRoom, mayor?.userId);
    if (mayorState) {
      mayorState.mayor = true;
    }

    await advanceToFirstNight(clients[0]?.client, serverRoom);
    werewolf?.client.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: mayor?.userId },
    });
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(25).catch(() => undefined);

    expect(serverRoom.state.phase).toBe("mayor_successor");
    clients[0]?.client.send("setMayor", { targetUserId: successor?.userId });
    await serverRoom.waitForNextPatch(25).catch(() => undefined);
    expect(findPublicPlayer(serverRoom, successor?.userId)?.mayor).toBe(true);
  });
});
