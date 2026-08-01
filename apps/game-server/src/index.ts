import { listen } from "@colyseus/tools";
import * as Sentry from "@sentry/node";
import { closeAllDatabases } from "@werewolf/database";
import appConfig from "./app.config.js";
import { deployDrain } from "./operations/deploy-drain.js";
import { persistenceReadiness } from "./operations/persistence-readiness.js";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.RELEASE_VERSION?.trim() || undefined,
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  });
}

await persistenceReadiness.refresh();
const server = await listen(appConfig, Number(process.env.GAME_SERVER_PORT ?? process.env.PORT ?? 2567));
const drainTimeoutMs = readPositiveInteger("GAME_DRAIN_TIMEOUT_MS", 120_000);
const drainPollIntervalMs = readPositiveInteger("GAME_DRAIN_POLL_INTERVAL_MS", 1_000);
const persistenceProbeIntervalMs = readPositiveInteger("PERSISTENCE_PROBE_INTERVAL_MS", 5_000);
const persistenceProbeTimer = setInterval(() => {
  void persistenceReadiness.refresh();
}, persistenceProbeIntervalMs);
persistenceProbeTimer.unref();

function beginDeployDrain() {
  const status = deployDrain.begin();
  console.info(`Game server drain started; matchmaking stopped with ${status.activeRooms} active room(s).`);
}

server.onBeforeShutdown(async () => {
  beginDeployDrain();
  const result = await deployDrain.waitForEmpty({
    timeoutMs: drainTimeoutMs,
    pollIntervalMs: drainPollIntervalMs,
  });

  if (result.timedOut) {
    console.warn(`Game server drain timed out after ${result.waitedMs}ms with ${result.activeRooms} active room(s); bounded shutdown continues.`);
    Sentry.captureMessage("Game server deploy drain timed out", {
      level: "warning",
      extra: result,
    });
    return;
  }

  console.info(`Game server drain completed after ${result.waitedMs}ms; no active rooms remain.`);
});

server.onShutdown(async () => {
  clearInterval(persistenceProbeTimer);
  await closeAllDatabases();
  console.info("Game server shutdown completed.");
});

function readPositiveInteger(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
