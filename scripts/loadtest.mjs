import { createRequire } from "node:module";
import path from "node:path";

// @colyseus/loadtest provides the load-testing package/CLI, while this script
// uses the already-installed 0.17 SDK peer from the game-server test stack so it
// speaks the same protocol as the Colyseus 0.17 server.
const rootRequire = createRequire(import.meta.url);
const testingEntry = rootRequire.resolve("@colyseus/testing", { paths: [path.resolve("apps/game-server")] });
const sdkRequire = createRequire(testingEntry);
const { Client } = sdkRequire("@colyseus/sdk");

const TARGET = process.env.LOAD_TARGET ?? "ws://localhost:2567";
const NUM_CLIENTS = Number(process.env.LOAD_CLIENTS ?? 50);
const ROOM_NAME = "game";
const clients = [];
const stats = {
  connected: 0,
  errors: 0,
  startTime: Date.now(),
};

for (let index = 0; index < NUM_CLIENTS; index += 1) {
  const client = new Client(TARGET);
  try {
    const room = await client.joinOrCreate(ROOM_NAME, {
      code: `LOAD${String(index).padStart(3, "0")}`,
      userId: `load-${index}`,
      displayName: `Тест ${index}`,
    });

    room.onMessage("*", () => {});
    room.onLeave(() => {
      stats.connected -= 1;
    });

    clients.push({ client, room });
    stats.connected += 1;
  } catch (error) {
    stats.errors += 1;
    console.error(`Клиент ${index} не се свърза: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`Свързани: ${stats.connected}/${NUM_CLIENTS}, грешки: ${stats.errors}`);
console.log(`Време за подготовка: ${Date.now() - stats.startTime}ms`);

setTimeout(async () => {
  console.log("Спирам load test...");
  await Promise.allSettled(clients.map(({ room }) => room.leave()));
  process.exit(stats.errors > NUM_CLIENTS * 0.1 ? 1 : 0);
}, 30_000);
