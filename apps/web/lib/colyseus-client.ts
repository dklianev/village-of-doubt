import { Client } from "@colyseus/sdk/Client";
import { NoneSerializer } from "@colyseus/sdk/serializer/NoneSerializer";
import { SchemaSerializer } from "@colyseus/sdk/serializer/SchemaSerializer";
import { registerSerializer } from "@colyseus/sdk/serializer/Serializer";

registerSerializer("schema", SchemaSerializer);
registerSerializer("none", NoneSerializer);

export const GAME_ROOM_NAME = "game";

export function createGameClient() {
  return new Client(process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "ws://localhost:2567");
}
