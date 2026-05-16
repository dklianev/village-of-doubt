import type { Room as ClientRoom } from "@colyseus/sdk";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { RoleCode } from "@werewolf/shared";
import type { GameRoom } from "../rooms/GameRoom.js";
import type { GameState } from "../rooms/schemas/GameState.js";

export interface JoinedClient {
  client: ClientRoom<GameRoom, GameState>;
  userId: string;
  displayName: string;
}

export interface RoleClient extends JoinedClient {
  role: RoleCode;
  roleNameBg: string;
}

export async function connectPlayers(
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
      client: await connectWithRetry(colyseus, room, {
        code: room.state.code,
        userId,
        displayName,
      }),
    });
  }
  return clients;
}

export async function connectWithRetry(
  colyseus: ColyseusTestServer,
  room: GameRoom,
  options: { code: string; userId: string; displayName: string; spectator?: boolean },
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

export async function startGameAndCollectRoles(clients: JoinedClient[]): Promise<RoleClient[]> {
  const rolePromises = clients.map(async (client) => ({
    ...client,
    ...((await waitForPrivateRole(client.client)) as { role: RoleCode; roleNameBg: string }),
  }));
  clients[0]?.client.send("startGame", {});
  return Promise.all(rolePromises);
}

export function waitForPrivateRole(client: ClientRoom<GameRoom, GameState>) {
  return client.waitForMessage("private_role") as Promise<{ role: RoleCode; roleNameBg: string }>;
}

export async function advanceToPhase(client: ClientRoom<GameRoom, GameState> | undefined, room: GameRoom, phase: string) {
  for (let index = 0; index < 20 && room.state.phase !== phase; index += 1) {
    client?.send("narratorAdvance", {});
    await room.waitForNextPatch(25).catch(() => undefined);
  }
}

export async function advanceToFirstNight(client: ClientRoom<GameRoom, GameState> | undefined, room: GameRoom) {
  await advanceToPhase(client, room, "first_night");
}

export async function advanceToVoting(client: ClientRoom<GameRoom, GameState> | undefined, room: GameRoom) {
  await advanceToPhase(client, room, "voting");
}

export function findPublicPlayer(room: GameRoom, userId: string | undefined) {
  return [...room.state.players.values()].find((player) => player.userId === userId);
}

export function publicEvents(room: GameRoom) {
  return [...room.state.publicEvents.values()].map((event) => event.messageBg);
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function restoreEnvValue(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
