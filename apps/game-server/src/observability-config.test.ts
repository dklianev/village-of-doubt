import { describe, expect, it } from "vitest";
import { NodeClient } from "@sentry/node";
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
      beforeSendTransaction: expect.any(Function),
      beforeSendSpan: expect.any(Function),
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

  it("scrubs a real SDK transaction envelope before transport", async () => {
    const options = createGameServerSentryOptions({ NODE_ENV: "production", SENTRY_DSN: "https://public@example.invalid/1" })!;
    const envelopes: unknown[] = [];
    const client = new NodeClient({
      ...options,
      integrations: [],
      transport: () => ({
        send: async (envelope) => { envelopes.push(envelope); return { statusCode: 200 }; },
        flush: async () => true,
      }),
    });
    try {
      const now = Date.now() / 1000;
      client.captureEvent({
        type: "transaction", transaction: "GET /play/PRIVATE42", start_timestamp: now - 1, timestamp: now,
        user: { id: "private-user" },
        request: { url: "https://example.invalid/lobby/PRIVATE42?token=private-token" },
        contexts: { trace: { trace_id: "a".repeat(32), span_id: "b".repeat(16), data: { "http.target": "/mafia/join/PRIVATE42?token=private-token" } } },
        spans: [{ trace_id: "a".repeat(32), span_id: "c".repeat(16), start_timestamp: now - 0.5, timestamp: now, op: "db.postgresql", description: "select * from users where email='private@example.invalid'", data: { "db.statement": "private-sql", "db.params": ["private-bound-value"] } }],
      });
      expect(await client.flush(1000)).toBe(true);
      expect(envelopes).toHaveLength(1);
      const serialized = JSON.stringify(envelopes);
      for (const secret of ["PRIVATE42", "private-token", "private-user", "private@example.invalid", "private-sql", "private-bound-value"]) expect(serialized).not.toContain(secret);
      expect(serialized).toContain("db.postgresql");
      expect(serialized).toContain("/play/[code]");
    } finally { await client.close(1000); }
  });
});
