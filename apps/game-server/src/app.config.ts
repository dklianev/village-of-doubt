import { monitor } from "@colyseus/monitor";
import defineConfig from "@colyseus/tools";
import cors from "cors";
import type { Request, Response } from "express";
import { performance } from "node:perf_hooks";
import { deployDrain } from "./operations/deploy-drain.js";
import { persistenceReadiness } from "./operations/persistence-readiness.js";
import { GameRoom, getGameRuntimeStats } from "./rooms/GameRoom.js";
import { ROOM_CODE_REGEX, normalizeRoomCodeInput } from "@werewolf/shared";

const redisScaling = process.env.NODE_ENV === "production" && process.env.REDIS_URL
  ? await createRedisScaling(process.env.REDIS_URL)
  : {};
const publicAddress = process.env.COLYSEUS_PUBLIC_ADDRESS?.trim();

export default defineConfig({
  options: {
    ...redisScaling,
    ...(publicAddress ? { publicAddress } : {}),
  },

  initializeGameServer(gameServer) {
    gameServer.define("game", OperationalGameRoom).filterBy(["code"]);
    deployDrain.configure({
      getActiveRooms: () => getGameRuntimeStats().activeRooms,
      stopMatchmaking: () => {},
    });
  },

  initializeExpress(app) {
    app.use(cors({ credentials: true, origin: getCorsOrigin() }));

    app.get("/health", (_req, res) => {
      res.json({
        ok: true,
        service: "werewolf-game-server",
        time: new Date().toISOString(),
      });
    });

    app.get("/health/ready", createReadinessHandler());

    app.get("/stats", (_req, res) => {
      res.json(createPublicStats());
    });

    app.post("/operations/drain", createLocalDrainHandler());

    app.get("/operations/stats", createLocalStatsHandler());

    app.get("/rooms/:code/preview", (req, res) => {
      const code = normalizeRoomCodeInput(String(req.params.code ?? ""));
      if (!ROOM_CODE_REGEX.test(code)) {
        res.status(404).json({ status: "missing" });
        return;
      }

      const preview = GameRoom.getRoomPreview(code);
      if (!preview) {
        res.status(404).json({ status: "missing" });
        return;
      }

      res.json(preview);
    });

    if (process.env.NODE_ENV !== "production") {
      app.use("/monitor", monitor());
    }
  },
});

async function createRedisScaling(redisUrl: string) {
  const [{ RedisDriver }, { RedisPresence }] = await Promise.all([
    import("@colyseus/redis-driver"),
    import("@colyseus/redis-presence"),
  ]);

  return {
    driver: new RedisDriver(redisUrl),
    presence: new RedisPresence(redisUrl),
  };
}

export class OperationalGameRoom extends GameRoom {
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

export function createPublicStats() {
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
    res.json({
      ...createPublicStats(),
      eventLoopUtilization: performance.eventLoopUtilization().utilization,
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
  probe: ReadinessProbe = () => persistenceReadiness.refresh(),
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

function getCorsOrigin() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const origins = (process.env.CORS_ORIGIN ?? process.env.BETTER_AUTH_URL ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (process.env.PUBLIC_WEB_DOMAIN) {
    origins.push(`https://${process.env.PUBLIC_WEB_DOMAIN}`);
  }

  const uniqueOrigins = [...new Set(origins)];
  if (uniqueOrigins.length === 0) {
    throw new Error("CORS_ORIGIN или BETTER_AUTH_URL трябва да е настроен в production.");
  }

  return uniqueOrigins;
}
