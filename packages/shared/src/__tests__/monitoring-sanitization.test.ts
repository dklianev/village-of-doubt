import { describe, expect, it } from "vitest";
import {
  safeMonitoringErrorMetadata,
  sanitizeMonitoringEvent,
} from "../monitoring-sanitization.js";

describe("monitoring sanitization", () => {
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
