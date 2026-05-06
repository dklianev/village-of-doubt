import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { Room as ClientRoom } from "@colyseus/sdk";
import { createGameToken } from "@werewolf/shared/server";
import appConfig from "../app.config.js";
import type { GameRoom } from "../rooms/GameRoom.js";
import type { GameState } from "../rooms/schemas/GameState.js";

const GAME_TOKEN_SECRET = "test-secret-that-is-long-enough";

describe("GameRoom security boundaries", () => {
  let colyseus: ColyseusTestServer;
  let previousAllowDevAuth: string | undefined;
  let previousGameTokenSecret: string | undefined;
  let previousNodeEnv: string | undefined;

  beforeEach(async () => {
    previousAllowDevAuth = process.env.ALLOW_DEV_AUTH;
    previousGameTokenSecret = process.env.GAME_TOKEN_SECRET;
    previousNodeEnv = process.env.NODE_ENV;
    process.env.GAME_TOKEN_SECRET = GAME_TOKEN_SECRET;
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.NODE_ENV = "test";
    colyseus = await boot(appConfig, 2678);
  });

  afterEach(async () => {
    await colyseus?.cleanup();
    await colyseus?.shutdown();
    restoreEnvValue("ALLOW_DEV_AUTH", previousAllowDevAuth);
    restoreEnvValue("GAME_TOKEN_SECRET", previousGameTokenSecret);
    restoreEnvValue("NODE_ENV", previousNodeEnv);
  });

  it("keeps role data out of the synchronized public state", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "SEC001",
      mode: "werewolves_classic",
      playerCount: 8,
    });

    const clients = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        colyseus.connectTo(serverRoom, {
          code: "SEC001",
          userId: `user-${index + 1}`,
          displayName: `Играч ${index + 1}`,
        }),
      ),
    );

    const privateRoleMessages = clients.map((client) => waitForPrivateRole(client));
    clients[0]?.send("startGame", {});
    await Promise.all(privateRoleMessages);
    await serverRoom.waitForNextPatch();

    const state = clients[1]?.state as GameState;
    expect(state.phase).toBe("role_reveal");

    for (const player of state.players.values()) {
      expect("role" in player).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(player, "role")).toBe(false);
      // revealedRole must be an empty string for living players — never leak the secret role.
      expect(player.revealedRole).toBe("");
    }
  });

  it("rejects a signed game token created for another room code", async () => {
    process.env.ALLOW_DEV_AUTH = "false";

    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "GOOD01",
      mode: "werewolves_classic",
      playerCount: 8,
    });
    const wrongRoomToken = createGameToken({
      userId: "user-1",
      displayName: "Играч 1",
      roomCode: "OTHER1",
      secret: GAME_TOKEN_SECRET,
    });

    await expect(
      colyseus.connectTo(serverRoom, {
        code: "GOOD01",
        token: wrongRoomToken,
      }),
    ).rejects.toThrow();
  });

  it("requires full narrator consent and sends all roles only to the full narrator", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "NARR01",
      mode: "mafia_free",
      playerCount: 4,
      narratorMode: "full_human",
    });

    const clients = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        colyseus.connectTo(serverRoom, {
          code: "NARR01",
          userId: `narr-user-${index + 1}`,
          displayName: `Играч ${index + 1}`,
        }),
      ),
    );

    const blockedStart = clients[0]?.waitForMessage("safe_error") as Promise<{ messageBg: string }>;
    clients[0]?.send("startGame", {});
    await expect(blockedStart).resolves.toMatchObject({
      messageBg: "Всички играчи трябва да приемат предупреждението за Пълен Разказвач.",
    });

    for (const client of clients) {
      client.send("acceptFullNarrator", {});
    }
    await delay(50);

    const narratorSnapshot = clients[0]?.waitForMessage("narrator_role_snapshot") as Promise<{
      roles: Array<{ userId: string; role: string; roleNameBg: string }>;
    }>;
    const privateRoleMessages = clients.slice(1).map((client) => waitForPrivateRole(client));
    clients[0]?.send("startGame", {});

    await Promise.all(privateRoleMessages);
    await expect(narratorSnapshot).resolves.toMatchObject({
      roles: expect.arrayContaining([
        expect.objectContaining({ userId: "narr-user-2" }),
        expect.objectContaining({ userId: "narr-user-3" }),
        expect.objectContaining({ userId: "narr-user-4" }),
        expect.objectContaining({ userId: "narr-user-5" }),
      ]),
    });
  });
});

function waitForPrivateRole(client: ClientRoom<GameRoom, GameState>) {
  return client.waitForMessage("private_role") as Promise<{ role: string; roleNameBg: string }>;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
