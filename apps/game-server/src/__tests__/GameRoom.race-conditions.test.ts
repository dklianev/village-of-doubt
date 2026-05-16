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

describe("GameRoom race-condition contracts", () => {
  let colyseus: ColyseusTestServer;
  let previousAllowDevAuth: string | undefined;
  let previousNodeEnv: string | undefined;

  beforeEach(async () => {
    previousAllowDevAuth = process.env.ALLOW_DEV_AUTH;
    previousNodeEnv = process.env.NODE_ENV;
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "test";
    colyseus = await boot(appConfig, 2683);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
    await colyseus?.shutdown();
    restoreEnvValue("ALLOW_DEV_AUTH", previousAllowDevAuth);
    restoreEnvValue("NODE_ENV", previousNodeEnv);
  });

  it("resolves concurrent faction submissions deterministically to one death", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "RACE01",
      mode: "werewolves_classic",
      playerCount: 6,
      tempoProfile: "manual",
      roles: {
        ordinary_villager: 4,
        werewolf: 2,
      },
    });
    const clients = await connectPlayers(colyseus, serverRoom, 6, "race");
    const roleClients = await startGameAndCollectRoles(clients);
    const wolves = roleClients.filter((client) => client.role === "werewolf");
    const target = roleClients.find((client) => client.role === "ordinary_villager");

    expect(wolves).toHaveLength(2);
    expect(target).toBeTruthy();

    await advanceToFirstNight(clients[0]?.client, serverRoom);
    wolves[0]?.client.send("submitNightAction", { action: { kind: "faction_kill", targetUserId: target?.userId } });
    wolves[1]?.client.send("submitNightAction", { action: { kind: "faction_kill", targetUserId: target?.userId } });
    clients[0]?.client.send("narratorAdvance", {});
    await serverRoom.waitForNextPatch(25).catch(() => undefined);

    const deadPlayers = [...serverRoom.state.players.values()].filter((player) => player.playing && !player.alive);
    expect(deadPlayers.map((player) => player.userId)).toEqual([target?.userId]);
    expect(findPublicPlayer(serverRoom, target?.userId)?.alive).toBe(false);
  });
});
