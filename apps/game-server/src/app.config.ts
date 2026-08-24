import { monitor } from "@colyseus/monitor";
import { createDatabase, isGameSessionRevokedDurably } from "@werewolf/database";
import defineConfig from "@colyseus/tools";
import {
  GAME_SESSION_REVOCATION_CHANNEL,
  parseGameSessionRevocationMessage,
  resolveRedisUrl,
  verifyRoomPreviewCredential,
} from "@werewolf/shared/server";
import cors from "cors";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createClient, type RedisClientType } from "redis";
import { deployDrain } from "./operations/deploy-drain.js";
import { persistenceReadiness } from "./operations/persistence-readiness.js";
import { authenticateGameJoin, GameRoom, getGameRuntimeStats, getGameTokenSecret } from "./rooms/GameRoom.js";
import { PlayerPresenceManager } from "./rooms/player-presence-manager.js";
import {
  createRedisPlayerSecurityStore,
  type RedisPlayerSecurityClient,
} from "./rooms/player-security-store.js";
import { ROOM_CODE_REGEX, normalizeRoomCodeInput, type JoinRoomOptions } from "@werewolf/shared";

const redisUrl = resolveGameServerRedisUrl(process.env);
const colyseusRedisUrl = resolveColyseusRedisUrl(process.env);
const redisRuntime = redisUrl && colyseusRedisUrl
  ? await createRedisScaling(redisUrl, colyseusRedisUrl)
  : undefined;
const redisScaling = redisRuntime
  ? {
      driver: redisRuntime.driver,
      presence: redisRuntime.presence,
    }
  : {};
const publicAddress = process.env.COLYSEUS_PUBLIC_ADDRESS?.trim();

interface GameServerRedisEnvironment {
  NODE_ENV?: string;
  REDIS_URL?: string;
  REDIS_PASSWORD_FILE?: string;
  COLYSEUS_REDIS_URL?: string;
  COLYSEUS_REDIS_PASSWORD_FILE?: string;
}

export function resolveGameServerRedisUrl(environment: GameServerRedisEnvironment) {
  if (environment.NODE_ENV !== "production") {
    return undefined;
  }
  if (!environment.REDIS_URL) {
    throw new Error("REDIS_URL е задължителен за production game-server.");
  }
  const parsedUrl = new URL(environment.REDIS_URL);
  if (!parsedUrl.password && !environment.REDIS_PASSWORD_FILE) {
    throw new Error("Production Redis изисква автентикация.");
  }
  return resolveRedisUrl(environment.REDIS_URL, environment.REDIS_PASSWORD_FILE);
}

export function resolveColyseusRedisUrl(environment: GameServerRedisEnvironment) {
  if (environment.NODE_ENV !== "production") {
    return undefined;
  }
  if (!environment.COLYSEUS_REDIS_URL) {
    throw new Error("COLYSEUS_REDIS_URL е задължителен за production game-server.");
  }
  const parsedUrl = new URL(environment.COLYSEUS_REDIS_URL);
  if (!parsedUrl.password && !environment.COLYSEUS_REDIS_PASSWORD_FILE) {
    throw new Error("Production Colyseus Redis изисква автентикация.");
  }
  return resolveRedisUrl(
    environment.COLYSEUS_REDIS_URL,
    environment.COLYSEUS_REDIS_PASSWORD_FILE,
  );
}

export async function closeGameServerRedisRuntime() {
  if (!redisRuntime) {
    return;
  }
  clearInterval(redisRuntime.revocationReconcileTimer);
  if (redisRuntime.revocationSubscriber.isOpen) {
    await redisRuntime.revocationSubscriber.quit();
  }
  if (redisRuntime.securityClient.isOpen) {
    await redisRuntime.securityClient.quit();
  }
}

export default defineConfig({
  options: {
    ...redisScaling,
    ...(publicAddress ? { publicAddress } : {}),
  },

  initializeGameServer(gameServer) {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      const database = createDatabase(databaseUrl);
      PlayerPresenceManager.configureDurableSessionRevocationCheck(
        (userId, tokenIssuedAtMs) => isGameSessionRevokedDurably(database, userId, tokenIssuedAtMs),
      );
    }
    gameServer.define("game", OperationalGameRoom).filterBy(["code"]);
    deployDrain.configure({
      getActiveRooms: () => getGameRuntimeStats().activeRooms,
      stopMatchmaking: () => {},
    });
  },

  initializeExpress(app) {
    app.use(cors({ credentials: true, origin: resolveGameServerCorsOrigin(process.env) }));

    app.get("/health", (_req, res) => {
      res.json({
        ok: true,
        service: "werewolf-game-server",
        time: new Date().toISOString(),
      });
    });

    app.get("/health/ready", createReadinessHandler());

    app.post("/operations/drain", createLocalDrainHandler());

    app.get("/operations/stats", createLocalStatsHandler());

    app.get("/rooms/:code/preview", createInternalRoomPreviewHandler());

    if (process.env.NODE_ENV !== "production") {
      app.use("/monitor", monitor());
    }
  },
});

export function createInternalRoomPreviewHandler(
  getRoomPreview = (code: string) => GameRoom.getRoomPreview(code),
) {
  return (req: Request, res: Response) => {
    const code = normalizeRoomCodeInput(String(req.params.code ?? ""));
    const credential = String(req.header("x-werewolf-room-preview") ?? "");
    if (
      !ROOM_CODE_REGEX.test(code)
      || !verifyRoomPreviewCredential(code, credential, getGameTokenSecret())
    ) {
      res.status(404).json({ status: "missing" });
      return;
    }

    const preview = getRoomPreview(code);
    if (!preview) {
      res.status(404).json({ status: "missing" });
      return;
    }

    res.json(preview);
  };
}

async function createRedisScaling(securityRedisUrl: string, colyseusRedisUrl: string) {
  const [{ RedisDriver }, { RedisPresence }] = await Promise.all([
    import("@colyseus/redis-driver"),
    import("@colyseus/redis-presence"),
  ]);
  const securityClient = await connectSecurityRedisClient(securityRedisUrl);
  const revocationSubscriber = securityClient.duplicate();
  await revocationSubscriber.connect();
  await revocationSubscriber.subscribe(GAME_SESSION_REVOCATION_CHANNEL, (message) => {
    handleGameSessionRevocationMessage(message);
  });
  let reconciliationRunning = false;
  const revocationReconcileTimer = setInterval(() => {
    if (reconciliationRunning) return;
    reconciliationRunning = true;
    void GameRoom.reconcileRevokedConnections()
      .catch((error) => {
        console.error("[game-server] Redis session revocation reconcile failed.", error);
      })
      .finally(() => {
        reconciliationRunning = false;
      });
  }, 30_000);
  revocationReconcileTimer.unref();
  PlayerPresenceManager.configureSecurityStore(
    createRedisPlayerSecurityStore(
      createDeadlineBoundSecurityRedisClient(securityClient as unknown as AbortableSecurityRedisClient),
    ),
  );

  return {
    driver: new RedisDriver(colyseusRedisUrl),
    presence: new RedisPresence(colyseusRedisUrl),
    securityClient,
    revocationSubscriber,
    revocationReconcileTimer,
  };
}

export function handleGameSessionRevocationMessage(
  message: string,
  revoke: (userId: string) => number = (userId) => GameRoom.revokeUserConnections(userId),
) {
  const event = parseGameSessionRevocationMessage(message);
  if (!event) {
    return false;
  }
  revoke(event.userId);
  return true;
}

async function connectSecurityRedisClient(redisUrl: string): Promise<RedisClientType> {
  let hasConnected = false;
  let lastErrorReportAt = Number.NEGATIVE_INFINITY;
  const client = createClient({
    url: redisUrl,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 1_500,
      reconnectStrategy(retries) {
        if (!hasConnected && retries >= 3) {
          return new Error("Redis не е достъпен при стартиране.");
        }
        return Math.min(100 * 2 ** Math.min(retries, 5), 3_000);
      },
    },
  });
  client.on("error", (error) => {
    const now = Date.now();
    if (now - lastErrorReportAt >= 60_000) {
      lastErrorReportAt = now;
      console.error("[game-server] Redis security store е недостъпен.", error);
    }
  });
  await client.connect();
  hasConnected = true;
  return client;
}

export class OperationalGameRoom extends GameRoom {
  static override async onAuth(_token: string, options: JoinRoomOptions) {
    return authenticateGameJoin(options, {
      consumeNonce: true,
      enforceJoinRateLimit: true,
    });
  }

  override onCreate(options: Parameters<GameRoom["onCreate"]>[0]) {
    if (deployDrain.isDraining()) {
      throw new Error("Сървърът се подготвя за обновяване. Нова стая не може да бъде създадена.");
    }
    if (!persistenceReadiness.isReady()) {
      throw new Error("Историята на игрите временно не е достъпна. Нова стая не може да бъде създадена.");
    }
    super.onCreate(options);
  }
}

function createOperatorStats() {
  const runtime = getGameRuntimeStats();
  const drain = deployDrain.status();
  return {
    ok: true,
    activeRooms: runtime.activeRooms,
    connectedPlayers: runtime.connectedPlayers,
    draining: drain.draining,
    drainStartedAt: drain.drainStartedAt,
  };
}

export function createLocalDrainHandler() {
  return (req: Request, res: Response) => {
    if (!isLoopbackAddress(req.socket.remoteAddress)) {
      res.status(404).json({ ok: false });
      return;
    }
    res.json({ ok: true, ...deployDrain.begin() });
  };
}

export function createLocalStatsHandler() {
  return (req: Request, res: Response) => {
    if (!isLoopbackAddress(req.socket.remoteAddress)) {
      res.status(404).json({ ok: false });
      return;
    }

    const memory = process.memoryUsage();
    const eventLoop = performance.eventLoopUtilization();
    res.json({
      ...createOperatorStats(),
      eventLoopActiveMs: eventLoop.active,
      eventLoopIdleMs: eventLoop.idle,
      eventLoopUtilization: eventLoop.utilization,
      rssBytes: memory.rss,
    });
  };
}

function isLoopbackAddress(address: string | undefined) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

/*
 * Deep readiness updates the cached gate used only when Colyseus must create a
 * new room. Existing room joins, reservations, reconnects, and sockets bypass
 * OperationalGameRoom.onCreate and continue while persistence is unavailable.
 */
type ReadinessProbe = () => Promise<boolean>;

export function createReadinessHandler(
  probe: ReadinessProbe = async () => {
    const persistenceReady = await persistenceReadiness.refresh();
    return persistenceReady && (
      !redisRuntime
      || await probeSecurityRedisReady(redisRuntime.securityClient as unknown as AbortableSecurityRedisClient)
    );
  },
) {
  return async (_req: Request, res: Response) => {
    let ready = false;
    try {
      ready = await probe();
    } catch {
      ready = false;
    }

    res.status(ready ? 200 : 503).json({
      ok: ready,
      service: "werewolf-game-server",
      status: ready ? "ready" : "not_ready",
    });
  };
}

interface AbortableSecurityRedisCommands extends RedisPlayerSecurityClient {
  get(key: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

interface AbortableSecurityRedisClient {
  isReady?: boolean;
  withAbortSignal(signal: AbortSignal): AbortableSecurityRedisCommands;
}

export function createDeadlineBoundSecurityRedisClient(
  client: AbortableSecurityRedisClient,
  timeoutMs = 750,
): RedisPlayerSecurityClient {
  return {
    set(key, value, options) {
      return client.withAbortSignal(AbortSignal.timeout(timeoutMs)).set(key, value, options);
    },
    eval(script, options) {
      return client.withAbortSignal(AbortSignal.timeout(timeoutMs)).eval(script, options);
    },
    get(key) {
      return client.withAbortSignal(AbortSignal.timeout(timeoutMs)).get(key);
    },
  };
}

export async function probeSecurityRedisReady(
  client: AbortableSecurityRedisClient,
  timeoutMs = 750,
) {
  if (client.isReady === false) {
    return false;
  }

  const key = `wm:health:security:${randomUUID()}`;
  const commands = client.withAbortSignal(AbortSignal.timeout(timeoutMs));
  try {
    const written = await commands.set(key, "ready", {
      expiration: { type: "PX", value: 5_000 },
      condition: "NX",
    });
    if (written !== "OK") {
      return false;
    }
    return await commands.get(key) === "ready";
  } catch {
    return false;
  } finally {
    await commands.del(key).catch(() => undefined);
  }
}

interface GameServerCorsEnvironment {
  NODE_ENV?: string;
  CORS_ORIGIN?: string;
  BETTER_AUTH_URL?: string;
  PUBLIC_WEB_DOMAIN?: string;
}

export function resolveGameServerCorsOrigin(environment: GameServerCorsEnvironment) {
  if (environment.NODE_ENV !== "production") {
    return true;
  }

  const origins = (environment.CORS_ORIGIN ?? environment.BETTER_AUTH_URL ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (environment.PUBLIC_WEB_DOMAIN) {
    origins.push(`https://${environment.PUBLIC_WEB_DOMAIN}`);
  }

  if (origins.length === 0) {
    throw new Error("CORS_ORIGIN или BETTER_AUTH_URL трябва да е настроен в production.");
  }

  const normalizedOrigins = origins.map((origin) => normalizeProductionOrigin(origin));
  const uniqueOrigins = [...new Set(normalizedOrigins)];
  if (uniqueOrigins.length !== 1) {
    throw new Error("Production CORS приема точно един application origin.");
  }

  if (environment.PUBLIC_WEB_DOMAIN && uniqueOrigins[0] !== `https://${environment.PUBLIC_WEB_DOMAIN}`) {
    throw new Error("Production CORS origin трябва да съвпада с PUBLIC_WEB_DOMAIN.");
  }

  return uniqueOrigins;
}

function normalizeProductionOrigin(value: string) {
  if (value === "*") {
    throw new Error("Wildcard CORS origin не е разрешен в production.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Production CORS origin трябва да е валиден HTTPS URL.");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Production CORS origin трябва да е точен HTTPS origin без път или credentials.");
  }

  return url.origin;
}
