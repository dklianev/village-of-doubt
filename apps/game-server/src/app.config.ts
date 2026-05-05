import { monitor } from "@colyseus/monitor";
import defineConfig from "@colyseus/tools";
import cors from "cors";
import { GameRoom, getGameRuntimeStats } from "./rooms/GameRoom.js";

export default defineConfig({
  initializeGameServer(gameServer) {
    gameServer.define("game", GameRoom).filterBy(["code"]);
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

    app.get("/stats", (_req, res) => {
      res.json({
        ok: true,
        ...getGameRuntimeStats(),
      });
    });

    if (process.env.NODE_ENV !== "production") {
      app.use("/monitor", monitor());
    }
  },
});

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
