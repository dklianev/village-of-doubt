import * as Sentry from "@sentry/nextjs";

const instrumentationGlobal = globalThis as typeof globalThis & {
  __werewolfDatabaseMaintenanceTimer?: ReturnType<typeof setInterval> | null;
};

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    if (instrumentationGlobal.__werewolfDatabaseMaintenanceTimer === undefined) {
      const { startDatabaseMaintenanceLoop } = await import("@/lib/database-maintenance");
      instrumentationGlobal.__werewolfDatabaseMaintenanceTimer =
        await startDatabaseMaintenanceLoop();
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
