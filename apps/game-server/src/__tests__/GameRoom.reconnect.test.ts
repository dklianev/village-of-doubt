import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import appConfig from "../app.config.js";
import type { GameRoom } from "../rooms/GameRoom.js";
import type { GameState } from "../rooms/schemas/GameState.js";
import {
  advanceToFirstNight,
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
      code: "RECON1",
      mode: "werewolves_classic",
      playerCount: 8,
      tempoProfile: "manual",
    });
    const clients = await connectPlayers(colyseus, serverRoom, 8, "reconnect");
    const roleClients = await startGameAndCollectRoles(clients);
    const werewolf = roleClients.find((client) => client.role === "werewolf");
    const target = roleClients.find((client) => client.userId !== werewolf?.userId);

    expect(werewolf).toBeTruthy();
    expect(target).toBeTruthy();

    await advanceToFirstNight(clients[0]?.client, serverRoom);
    werewolf?.client.leave();
    await delay(40);

    const reconnected = await connectWithRetry(colyseus, serverRoom, {
      code: serverRoom.state.code,
      userId: werewolf?.userId ?? "",
      displayName: werewolf?.displayName ?? "",
    });
    const privateRole = await waitForPrivateRole(reconnected);

    expect(privateRole.role).toBe(werewolf?.role);
    expect(publicEvents(serverRoom).some((message) => message.includes("се върна в стаята"))).toBe(true);

    const reconnectedState = reconnected.state as GameState;
    for (const player of reconnectedState.players.values()) {
      expect(Object.prototype.hasOwnProperty.call(player, "role")).toBe(false);
    }

    const publicWerewolf = findPublicPlayer(serverRoom, werewolf?.userId);
    expect(publicWerewolf?.connected).toBe(true);

    reconnected.send("submitNightAction", {
      action: { kind: "faction_kill", targetUserId: target?.userId },
    });
    await serverRoom.waitForNextPatch(25).catch(() => undefined);
    expect(findPublicPlayer(serverRoom, werewolf?.userId)?.actedThisPhase).toBe(true);
  });
});
