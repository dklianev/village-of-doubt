import { Client } from "@colyseus/sdk";

export const GAME_ROOM_NAME = "game";

export function createGameClient() {
  return new Client(process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "ws://localhost:2567");
}
