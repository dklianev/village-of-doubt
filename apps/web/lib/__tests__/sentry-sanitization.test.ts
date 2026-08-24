import { describe, expect, it } from "vitest";
import {
  sanitizeMonitoringBreadcrumb,
  sanitizeMonitoringEvent,
  sanitizeMonitoringUrl,
} from "@/lib/sentry-sanitization";

describe("Sentry sanitization", () => {
  it("drops query data and normalizes private route identifiers", () => {
    expect(sanitizeMonitoringUrl("https://senkite.com/play/WOLF42?token=secret#chat")).toBe(
      "https://senkite.com/play/[code]",
    );
    expect(sanitizeMonitoringUrl("/history/7b877d37-0000-5000-8000-123456789abc/replay?view=all")).toBe(
      "/history/[gameId]/replay",
    );
  });

  it("redacts secret-bearing fields from events and breadcrumbs", () => {
    const event = sanitizeMonitoringEvent({
      request: { url: "https://senkite.com/lobby/SECRET?token=value", headers: { authorization: "Bearer secret" } },
      extra: { roomCode: "SECRET", chatMessage: "private words", harmless: "ok" },
      user: { id: "private-user", email: "user@example.com" },
    });
    const breadcrumb = sanitizeMonitoringBreadcrumb({
      data: {
        url: "/play/SECRET?role=seer",
        from: "/lobby/OLDROOM?token=old",
        to: "/history/7b877d37-0000-5000-8000-123456789abc/replay?view=all",
        token: "secret",
        method: "GET",
      },
    });

    expect(event.request?.url).toBe("https://senkite.com/lobby/[code]");
    expect(event.request?.headers).toEqual({ authorization: "[ПРЕМАХНАТО]" });
    expect(event.extra).toEqual({ roomCode: "[ПРЕМАХНАТО]", chatMessage: "[ПРЕМАХНАТО]", harmless: "ok" });
    expect(event.user).toBeUndefined();
    expect(breadcrumb.data).toEqual({
      url: "/play/[code]",
      from: "/lobby/[code]",
      to: "/history/[gameId]/replay",
      token: "[ПРЕМАХНАТО]",
      method: "GET",
    });
  });

  it("scrubs query strings and secret-bearing exception messages", () => {
    const event = sanitizeMonitoringEvent({
      request: {
        url: "https://senkite.com/reset?token=url-secret",
        query_string: "token=query-secret&code=ROOM42",
      },
      message: "reset failed token=top-level-secret",
      exception: {
        values: [
          { type: "Error", value: "verify failed token=exception-secret" },
          { type: "Error", value: "GET https://senkite.com/play/ROOM42?token=url-secret" },
        ],
      },
      logentry: { message: "roomCode=ROOM42" },
      tags: { userId: "private-user", subsystem: "auth" },
    });

    expect(event.request).toMatchObject({
      url: "https://senkite.com/reset",
      query_string: undefined,
    });
    expect(event.message).toBe("reset failed token=[ПРЕМАХНАТО]");
    expect(event.exception?.values).toEqual([
      { type: "Error", value: "verify failed token=[ПРЕМАХНАТО]" },
      { type: "Error", value: "GET https://senkite.com/play/[code]" },
    ]);
    expect(event.logentry?.message).toBe("roomCode=[ПРЕМАХНАТО]");
    expect(event.tags).toEqual({ userId: "[ПРЕМАХНАТО]", subsystem: "auth" });
  });
});
