import { listen } from "@colyseus/tools";
import * as Sentry from "@sentry/node";
import appConfig from "./app.config.js";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  });
}

await listen(appConfig, Number(process.env.GAME_SERVER_PORT ?? process.env.PORT ?? 2567));
