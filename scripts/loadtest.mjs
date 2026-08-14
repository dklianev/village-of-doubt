import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { findHostClient } from "./loadtest-clients.mjs";
import { assertLoadThresholds } from "./loadtest-metrics.mjs";

const rootRequire = createRequire(import.meta.url);
const gameServerRequire = createRequire(path.resolve("apps/game-server/package.json"));
const sharedEntry = gameServerRequire.resolve("@werewolf/shared");
const sharedServerEntry = gameServerRequire.resolve("@werewolf/shared/server");
const { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } = await import(pathToFileURL(sharedEntry).href);
const { createGameToken } = await import(pathToFileURL(sharedServerEntry).href);
const testingEntry = rootRequire.resolve("@colyseus/testing", { paths: [path.resolve("apps/game-server")] });
const sdkRequire = createRequire(testingEntry);
const { Client } = sdkRequire("@colyseus/sdk");

const NUM_CLIENTS = readPositiveInteger("LOAD_CLIENTS", 30);
const ROOM_SIZE = readPositiveInteger("LOAD_ROOM_SIZE", 10);
const HOLD_MS = readPositiveInteger("LOAD_HOLD_MS", 10_000);
const port = readPositiveInteger("LOAD_PORT", 3667);
const JOIN_P95_MS = readPositiveInteger("LOAD_JOIN_P95_MS", 3_000);
const MAX_RSS_BYTES = readPositiveInteger("LOAD_MAX_RSS_MB", 512) * 1024 * 1024;
const MAX_EVENT_LOOP_UTILIZATION = readRatio("LOAD_MAX_EVENT_LOOP_UTILIZATION", 0.95);
const STATS_INTERVAL_MS = readPositiveInteger("LOAD_STATS_INTERVAL_MS", 250);
const GAME_TOKEN_SECRET = process.env.GAME_TOKEN_SECRET ?? "load-test-secret-that-is-long-enough-for-local-runs";
const externalTarget = process.env.LOAD_TARGET;
const target = externalTarget ?? `ws://127.0.0.1:${port}`;
const statsUrl = process.env.LOAD_STATS_URL ?? (externalTarget
  ? undefined
  : toHttpUrl(target, "/operations/stats"));
const databaseUrl = !externalTarget ? process.env.DATABASE_URL : undefined;
const runId = `${Date.now().toString(36)}-${process.pid.toString(36)}`;
const clients = [];
const joinLatenciesMs = [];
let groups = [];
let gameProcess;
let gameProcessStderr = "";
let shuttingDown = false;
let clientsLeft = false;
let statsSampler;

try {
  if (!statsUrl) {
    throw new Error("LOAD_STATS_URL is required for an external target because runtime metrics are not public.");
  }
  if (databaseUrl) {
    assertLocalTestDatabase(databaseUrl);
  }
  if (!externalTarget) {
    gameProcess = startGameServer(port);
    await waitForHealth(`http://127.0.0.1:${port}/health/ready`);
  }

  statsSampler = startStatsSampler(statsUrl, STATS_INTERVAL_MS);
  groups = createGroups(NUM_CLIENTS, ROOM_SIZE);
  await Promise.all(groups.flatMap((group) => group.playerIndexes.map((index) => joinPlayer(group, index))));
  assertNoFailures();

  for (const group of groups) {
    await waitForPlayerCount(group);
    for (const client of group.clients) {
      client.room.send("ready", { ready: true });
    }
    await waitFor(() => group.clients.every(({ room }) => Array.from(room.state?.players?.values?.() ?? []).every((player) => player.ready)), `room ${group.code} to accept readiness`);
    const hostClient = findHostClient(group.clients);
    if (!hostClient) {
      throw new Error(`Room ${group.code} has no synchronized host client.`);
    }
    hostClient.room.send("startGame");
  }
  await Promise.all(groups.map(waitForGameStart));
  await delay(HOLD_MS);
  assertNoFailures();
  if (databaseUrl) {
    await assertPersistence(databaseUrl, groups.map((group) => group.code));
  }
  const statsSamples = await statsSampler.stop();
  statsSampler = undefined;
  const metrics = assertLoadThresholds({ joinLatenciesMs, statsSamples }, {
    joinP95Ms: JOIN_P95_MS,
    eventLoopUtilization: MAX_EVENT_LOOP_UTILIZATION,
    rssBytes: MAX_RSS_BYTES,
  });
  shuttingDown = true;
  await Promise.allSettled(clients.map(({ room }) => room.leave()));
  clientsLeft = true;
  await delay(500);
  await stopGameServer(gameProcess);
  gameProcess = undefined;
  assertNoFailures();
  console.log(
    `Load test passed: ${NUM_CLIENTS} clients across ${groups.length} shared rooms; ` +
    `0 failures, join p95 ${metrics.joinP95Ms.toFixed(1)}ms, sustained event loop ${(metrics.sustainedEventLoopUtilization * 100).toFixed(1)}%, ` +
    `max RSS ${(metrics.maxRssBytes / 1024 / 1024).toFixed(1)}MiB${databaseUrl ? ", persistence verified" : ""}.`,
  );
} finally {
  shuttingDown = true;
  await statsSampler?.stop().catch(() => {});
  if (!clientsLeft) {
    await Promise.allSettled(clients.map(({ room }) => room.leave()));
  }
  await stopGameServer(gameProcess);
  if (databaseUrl && groups.length > 0) {
    await cleanupPersistence(databaseUrl, groups.map((group) => group.code), clients.map((client) => client.userId));
  }
}

function createGroups(count, roomSize) {
  const groups = [];
  for (let first = 0; first < count; first += roomSize) {
    const playerIndexes = Array.from({ length: Math.min(roomSize, count - first) }, (_, offset) => first + offset);
    groups.push({ code: loadRoomCode(groups.length), playerIndexes, clients: [], failures: [] });
  }
  return groups;
}

async function joinPlayer(group, index) {
  const userId = `load-${runId}-${index}`;
  const token = createGameToken({
    userId,
    displayName: `Тест ${index}`,
    roomCode: group.code,
    secret: GAME_TOKEN_SECRET,
  });
  const client = new Client(target);
  const startedAt = performance.now();
  try {
    const room = await client.joinOrCreate("game", {
      code: group.code,
      token,
      mode: "werewolves_classic",
      playerCount: group.playerIndexes.length,
      maxPlayers: group.playerIndexes.length,
      tempoProfile: "fast_online",
    });
    room.onMessage("*", () => {});
    room.onError((code, message) => group.failures.push(`room error for ${userId}: ${code} ${message}`));
    room.onLeave((code) => {
      if (!shuttingDown) {
        group.failures.push(`unexpected leave for ${userId}: ${code}`);
      }
    });
    const connected = { room, userId };
    joinLatenciesMs.push(performance.now() - startedAt);
    group.clients.push(connected);
    clients.push(connected);
  } catch (error) {
    group.failures.push(`join failed for ${userId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function waitForPlayerCount(group) {
  await waitFor(() => group.clients.length === group.playerIndexes.length && group.clients.every(({ room }) => room.state?.players?.size === group.playerIndexes.length), `room ${group.code} to synchronize ${group.playerIndexes.length} players`);
}

async function waitForGameStart(group) {
  await waitFor(() => group.clients.every(({ room }) => room.state?.phase !== "lobby"), `room ${group.code} to start`);
}

function assertNoFailures() {
  const joinedFailures = clients.length === NUM_CLIENTS ? [] : [`connected ${clients.length}/${NUM_CLIENTS} clients`];
  const groupFailures = groups.flatMap((group) => group.failures);
  const processFailures = /\[game-persistence\]|unhandled|uncaught/i.test(gameProcessStderr)
    ? ["game server emitted a persistence or unhandled runtime error"]
    : [];
  if (joinedFailures.length > 0 || groupFailures.length > 0 || processFailures.length > 0) {
    throw new Error(`Load test requires zero failures:\n${[
      ...joinedFailures,
      ...groupFailures,
      ...processFailures,
    ].join("\n")}`);
  }
}

function startGameServer(gamePort) {
  const child = spawn(process.execPath, ["apps/game-server/dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      GAME_SERVER_PORT: String(gamePort),
      GAME_TOKEN_SECRET,
      BETTER_AUTH_URL: `http://127.0.0.1:${gamePort}`,
      CORS_ORIGIN: `http://127.0.0.1:${gamePort}`,
      GAME_DRAIN_TIMEOUT_MS: "5000",
    },
    stdio: ["ignore", "inherit", "pipe"],
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    gameProcessStderr = `${gameProcessStderr}${chunk}`.slice(-1_000_000);
    process.stderr.write(chunk);
  });
  return child;
}

async function waitForHealth(url) {
  await waitFor(async () => {
    const response = await fetch(url).catch(() => undefined);
    return Boolean(response?.ok);
  }, "local game server readiness");
}

async function waitFor(predicate, label) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function stopGameServer(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(10_000).then(() => child.kill("SIGKILL")),
  ]);
}

function loadRoomCode(index) {
  const capacity = ROOM_CODE_ALPHABET.length ** ROOM_CODE_LENGTH;
  let value = (Date.now() + index) % capacity;
  let suffix = "";
  for (let position = 0; position < ROOM_CODE_LENGTH; position += 1) {
    suffix = ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length] + suffix;
    value = Math.floor(value / ROOM_CODE_ALPHABET.length);
  }
  return suffix;
}

function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} трябва да е положително цяло число.`);
  return value;
}

function readRatio(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new Error(`${name} трябва да е число над 0 и до 1.`);
  }
  return value;
}

function toHttpUrl(webSocketUrl, pathname) {
  const url = new URL(webSocketUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function startStatsSampler(url, intervalMs) {
  let running = true;
  const samples = [];
  const errors = [];
  const completed = (async () => {
    while (running) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const stats = await response.json();
        if (
          !Number.isFinite(stats.eventLoopActiveMs)
          || !Number.isFinite(stats.eventLoopIdleMs)
          || !Number.isFinite(stats.eventLoopUtilization)
          || !Number.isFinite(stats.rssBytes)
        ) {
          throw new Error("missing event-loop counters or rssBytes");
        }
        samples.push({
          eventLoopActiveMs: stats.eventLoopActiveMs,
          eventLoopIdleMs: stats.eventLoopIdleMs,
          eventLoopUtilization: stats.eventLoopUtilization,
          rssBytes: stats.rssBytes,
        });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
      if (running) {
        await delay(intervalMs);
      }
    }
  })();

  return {
    async stop() {
      running = false;
      await completed;
      if (errors.length > 0) {
        throw new Error(`Load stats sampling requires zero failures:\n${errors.join("\n")}`);
      }
      if (samples.length === 0) {
        throw new Error("Load stats sampling returned no measurements.");
      }
      return samples;
    },
  };
}

async function assertPersistence(url, roomCodes) {
  const { databaseModule, drizzleModule } = await loadDatabaseModules();
  const db = databaseModule.createDatabase(url);
  await waitFor(async () => {
    const rows = await db
      .select({ code: databaseModule.games.code })
      .from(databaseModule.games)
      .where(drizzleModule.inArray(databaseModule.games.code, roomCodes));
    return new Set(rows.map((row) => row.code)).size === roomCodes.length;
  }, `persistence for ${roomCodes.length} load rooms`);
}

async function cleanupPersistence(url, roomCodes, userIds) {
  const { databaseModule, drizzleModule } = await loadDatabaseModules();
  const db = databaseModule.createDatabase(url);
  try {
    await db.transaction(async (transaction) => {
      await transaction.delete(databaseModule.games).where(drizzleModule.inArray(databaseModule.games.code, roomCodes));
      if (userIds.length > 0) {
        await transaction.delete(databaseModule.user).where(drizzleModule.inArray(databaseModule.user.id, userIds));
      }
    });
  } finally {
    await databaseModule.closeDatabase(url);
  }
}

async function loadDatabaseModules() {
  const databaseRequire = createRequire(path.resolve("packages/database/package.json"));
  const databaseEntry = gameServerRequire.resolve("@werewolf/database");
  const drizzleEntry = databaseRequire.resolve("drizzle-orm");
  const [databaseModule, drizzleModule] = await Promise.all([
    import(pathToFileURL(databaseEntry).href),
    import(pathToFileURL(drizzleEntry).href),
  ]);
  return { databaseModule, drizzleModule };
}

function assertLocalTestDatabase(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL за load test не е валиден URL.");
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname) || !/(?:test|e2e)/i.test(databaseName)) {
    throw new Error("Load test persistence отказва non-local или non-test база.");
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
