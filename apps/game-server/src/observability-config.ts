import {
  sanitizeMonitoringBreadcrumb,
  sanitizeMonitoringEvent,
} from "@werewolf/shared";

interface GameServerSentryEnvironment {
  NODE_ENV?: string;
  SENTRY_DSN?: string;
  RELEASE_VERSION?: string;
  [key: string]: string | undefined;
}

export function createGameServerSentryOptions(
  environment: GameServerSentryEnvironment = process.env,
) {
  const dsn = environment.SENTRY_DSN?.trim();
  if (!dsn) return undefined;

  return {
    dsn,
    environment: environment.NODE_ENV ?? "development",
    release: environment.RELEASE_VERSION?.trim() || undefined,
    sendDefaultPii: false,
    tracesSampleRate: environment.NODE_ENV === "production" ? 0.1 : 1,
    beforeSend: sanitizeMonitoringEvent,
    beforeBreadcrumb: sanitizeMonitoringBreadcrumb,
  };
}
