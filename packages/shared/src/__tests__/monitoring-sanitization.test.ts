import { describe, expect, it } from "vitest";
import {
  safeMonitoringErrorMetadata,
  sanitizeMonitoringEvent,
  sanitizeMonitoringSpan,
  sanitizeMonitoringUrl,
} from "../monitoring-sanitization.js";

describe("monitoring sanitization", () => {
  it.each(["/play/PRIVATE42", "/lobby/PRIVATE42", "/join/PRIVATE42", "/mafia/join/PRIVATE42", "/werewolf/join/PRIVATE42", "/api/rooms/PRIVATE42/preview", "/rooms/PRIVATE42/preview"])("removes invite identity from %s", (path) => {
    const sanitized = sanitizeMonitoringUrl(`${path}?token=private-token#private-fragment`);
    expect(sanitized).not.toContain("PRIVATE42");
    expect(sanitized).not.toContain("private-token");
    expect(sanitized).not.toContain("private-fragment");
    expect(sanitized).toContain("[code]");
  });

  it("sanitizes nested trace attributes and SQL span names without dropping measurements", () => {
    const event = sanitizeMonitoringEvent({
      type: "transaction",
      transaction: "GET /mafia/join/PRIVATE42?token=private-token",
      contexts: { trace: { data: { "url.path": "/lobby/PRIVATE42", "url.query": "private-token", duration: 12 } } },
      spans: [
        { op: "db.postgresql", description: "select * from users where email='private@example.invalid'", data: { "db.statement": "private-sql", "db.params": ["private-value"], rows: 1 } },
        { op: "http.client", description: "GET https://example.invalid/api/rooms/PRIVATE42/preview?token=private-token", data: { "http.target": "/play/PRIVATE42?token=private-token", "url.full": "https://example.invalid/lobby/PRIVATE42?token=private-token", "http.status_code": 200 } },
      ],
    });
    for (const secret of ["PRIVATE42", "private-token", "private@example.invalid", "private-sql", "private-value"]) {
      expect(JSON.stringify(event)).not.toContain(secret);
    }
    expect(event.contexts.trace.data.duration).toBe(12);
    expect(event.spans[1]?.data["http.status_code"]).toBe(200);
    expect(sanitizeMonitoringSpan({ name: "select private-sql", attributes: { "sentry.op": "db.query", "db.statement": "private-sql" } }).name).toBe("[ПРЕМАХНАТО]");
  });

  it("drops SQL and bound values from Drizzle query errors", () => {
    const rawError = [
      "Failed query: insert into game_events (actor_id, payload) values ($1, $2)",
      'params: player-17,{"role":"seer","message":"private words","token":"session-token","email":"night@example.com"}',
    ].join("\n");

    const event = sanitizeMonitoringEvent({
      message: rawError,
      exception: {
        values: [{
          type: "DrizzleQueryError",
          value: rawError,
          stacktrace: {
            frames: [{
              vars: {
                query: "insert into game_events (actor_id, payload) values ($1, $2)",
                params: [
                  "player-17",
                  {
                    role: "seer",
                    message: "private words",
                    token: "session-token",
                    email: "night@example.com",
                  },
                ],
              },
            }],
          },
        }],
      },
      extra: {
        query: "insert into game_events (actor_id, payload) values ($1, $2)",
        params: ["player-17", "session-token", "night@example.com"],
      },
    });

    expect(event.message).toBe("Database operation failed; details=[ПРЕМАХНАТО]");
    expect(event.exception.values[0]).toMatchObject({
      type: "DrizzleQueryError",
      value: "Database operation failed; details=[ПРЕМАХНАТО]",
      stacktrace: {
        frames: [{
          vars: {
            query: "[ПРЕМАХНАТО]",
            params: "[ПРЕМАХНАТО]",
          },
        }],
      },
    });
    expect(event.extra).toEqual({
      query: "[ПРЕМАХНАТО]",
      params: "[ПРЕМАХНАТО]",
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

  it("projects operational log metadata without messages, queries or parameters", () => {
    const metadata = safeMonitoringErrorMetadata({
      name: "PostgresError",
      code: "23505",
      status: 503,
      message: "duplicate email night@example.com",
      query: "select * from users where email = $1",
      params: ["night@example.com"],
    });

    expect(metadata).toEqual({
      name: "PostgresError",
      code: "23505",
      status: 503,
    });
    expect(JSON.stringify(metadata)).not.toContain("night@example.com");
    expect(JSON.stringify(metadata)).not.toContain("select * from users");
  });

  it("rejects attacker-controlled error metadata", () => {
    expect(safeMonitoringErrorMetadata({
      name: "Error token=secret",
      code: "token=secret",
      status: 9_999,
    })).toEqual({
      name: "UnknownError",
      code: "UNKNOWN",
      status: null,
    });
  });
});
