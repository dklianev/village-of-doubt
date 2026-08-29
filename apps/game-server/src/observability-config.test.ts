import { describe, expect, it } from "vitest";
import { createGameServerSentryOptions } from "./observability-config.js";

describe("createGameServerSentryOptions", () => {
  it("sanitizes private room identifiers before game events leave the process", () => {
    const options = createGameServerSentryOptions({
      NODE_ENV: "production",
      SENTRY_DSN: "https://server@example.invalid/1",
      RELEASE_VERSION: "release-2026-08-27.1",
    });

    expect(options).toMatchObject({
      dsn: "https://server@example.invalid/1",
      environment: "production",
      release: "release-2026-08-27.1",
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      beforeSend: expect.any(Function),
      beforeBreadcrumb: expect.any(Function),
    });

    expect(options?.beforeSend({
      message: "[GameRoom WOLF42] failed token=private-token",
      extra: { roomCode: "WOLF42", harmless: "ok" },
    })).toMatchObject({
      message: "[GameRoom [ПРЕМАХНАТО]] failed token=[ПРЕМАХНАТО]",
      extra: { roomCode: "[ПРЕМАХНАТО]", harmless: "ok" },
    });
  });

  it("removes Drizzle SQL and bound private values in the final Sentry hook", () => {
    const options = createGameServerSentryOptions({
      NODE_ENV: "production",
      SENTRY_DSN: "https://server@example.invalid/1",
    });
    const rawError = [
      "Failed query: insert into game_events (actor_id, payload) values ($1, $2)",
      'params: player-17,{"role":"seer","message":"private words","token":"session-token","email":"night@example.com"}',
    ].join("\n");

    const event = options?.beforeSend({
      exception: {
        values: [{ type: "DrizzleQueryError", value: rawError }],
      },
      extra: {
        query: "insert into game_events (actor_id, payload) values ($1, $2)",
        params: ["player-17", "session-token", "night@example.com"],
      },
    });

    expect(event).toMatchObject({
      exception: {
        values: [{
          type: "DrizzleQueryError",
          value: "Database operation failed; details=[ПРЕМАХНАТО]",
        }],
      },
      extra: {
        query: "[ПРЕМАХНАТО]",
        params: "[ПРЕМАХНАТО]",
      },
    });
    const serialized = JSON.stringify(event);
    for (const sensitiveValue of [
      "insert into game_events",
      "player-17",
      "seer",
      "private words",
      "session-token",
      "night@example.com",
    ]) {
      expect(serialized).not.toContain(sensitiveValue);
    }
  });

  it("does not initialize without a server DSN", () => {
    expect(createGameServerSentryOptions({ NODE_ENV: "production" })).toBeUndefined();
  });
});
