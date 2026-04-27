import { Client } from "@colyseus/sdk";
import { env } from "./env";

export const GAME_ROOM_NAME = "game";

export function createGameClient() {
  return new Client(env.NEXT_PUBLIC_GAME_SERVER_URL);
}
