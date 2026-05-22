import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import type { Room as ClientRoom } from "@colyseus/sdk";
import { createGameToken } from "@werewolf/shared/server";
import appConfig from "../app.config.js";
import type { GameRoom } from "../rooms/GameRoom.js";
import type { GameState } from "../rooms/schemas/GameState.js";

const GAME_TOKEN_SECRET = "test-secret-that-is-long-enough-32-chars";

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

    const clients = await connectPlayers(colyseus, serverRoom, 8, "user");

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

  it("rejects replayed signed game tokens", async () => {
    process.env.ALLOW_DEV_AUTH = "false";

    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "TOK001",
      mode: "werewolves_classic",
      playerCount: 8,
    });
    const token = createGameToken({
      userId: "token-user-1",
      displayName: "Играч с токен",
      roomCode: "TOK001",
      secret: GAME_TOKEN_SECRET,
    });

    await colyseus.connectTo(serverRoom, { code: "TOK001", token });
    await expect(colyseus.connectTo(serverRoom, { code: "TOK001", token })).rejects.toThrow();
  });

  it("rate-limits rapid join attempts from the same user", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "RATE01",
      mode: "werewolves_classic",
      playerCount: 8,
    });
    const auth = { userId: "rate-user-1", displayName: "Митко" };
    const options = { code: "RATE01" };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      serverRoom.onJoin(fakeClient(`rate-session-${attempt}`), options, auth);
    }

    const blockedClient = fakeClient("rate-session-blocked");
    serverRoom.onJoin(blockedClient, options, auth);

    expect(blockedClient.send).toHaveBeenCalledWith(
      "safe_error",
      expect.objectContaining({
        messageBg: "Твърде много опити за вход. Изчакай малко.",
      }),
    );
    expect(blockedClient.leave).toHaveBeenCalledWith(4029);
  });

  it("replaces manual-only roles unless the room uses full human narrator", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "MAN001",
      mode: "werewolves_classic",
      playerCount: 8,
      narratorMode: "automatic",
      rolePreset: "manual",
      roles: {
        ordinary_villager: 4,
        werewolf: 2,
        stray_cat: 1,
        guard_dog: 1,
      },
    });

    const roleCounts = new Map([...serverRoom.state.roleCounts.values()].map((role) => [role.role, role.count]));
    expect(roleCounts.get("stray_cat")).toBeUndefined();
    expect(roleCounts.get("guard_dog")).toBeUndefined();
    expect(roleCounts.get("ordinary_villager")).toBe(6);
  });

  it("requires full narrator consent and sends all roles only to the full narrator", async () => {
    const serverRoom = await colyseus.createRoom<GameRoom>("game", {
      code: "NARR01",
      mode: "mafia_free",
      playerCount: 4,
      narratorMode: "full_human",
    });

    const clients = await connectPlayers(colyseus, serverRoom, 5, "narr-user");

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

async function connectPlayers(
  colyseus: ColyseusTestServer,
  room: GameRoom,
  count: number,
  prefix: string,
): Promise<Array<ClientRoom<GameRoom, GameState>>> {
  const clients: Array<ClientRoom<GameRoom, GameState>> = [];
  for (let index = 0; index < count; index += 1) {
    clients.push(
      await connectWithRetry(colyseus, room, {
        code: room.state.code,
        userId: `${prefix}-${index + 1}`,
        displayName: `Играч ${index + 1}`,
      }),
    );
  }
  return clients;
}

async function connectWithRetry(
  colyseus: ColyseusTestServer,
  room: GameRoom,
  options: { code: string; userId: string; displayName: string },
): Promise<ClientRoom<GameRoom, GameState>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await colyseus.connectTo(room, options);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("fetch failed")) {
        throw error;
      }
      await delay(25 * (attempt + 1));
    }
  }
  throw lastError;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fakeClient(sessionId: string) {
  return {
    sessionId,
    send: vi.fn(),
    leave: vi.fn(),
    userData: undefined,
  } as unknown as Parameters<GameRoom["onJoin"]>[0];
}

function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
