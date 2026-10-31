import { describe, expect, it } from "vitest";
import { BrowserClient, defaultStackParser } from "@sentry/browser";
import { createServerSentryOptions } from "../observability-config";

describe("createServerSentryOptions", () => {
  it("uses only the server DSN and attaches release and environment metadata", () => {
    expect(createServerSentryOptions({
      NODE_ENV: "production",
      SENTRY_DSN: "https://server@example.invalid/1",
      NEXT_PUBLIC_SENTRY_DSN: "https://client@example.invalid/2",
      RELEASE_VERSION: "release-2026-07-20.1",
    })).toEqual({
      dsn: "https://server@example.invalid/1",
      environment: "production",
      release: "release-2026-07-20.1",
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      beforeSend: expect.any(Function),
      beforeSendTransaction: expect.any(Function),
      beforeSendSpan: expect.any(Function),
      beforeBreadcrumb: expect.any(Function),
    });
  });

  it("does not initialize from the removed client DSN", () => {
    expect(createServerSentryOptions({
      NODE_ENV: "production",
      NEXT_PUBLIC_SENTRY_DSN: "https://client@example.invalid/2",
      RELEASE_VERSION: "release-2026-07-20.1",
    })).toBeUndefined();
  });

  it("scrubs web transaction envelopes instead of relying on the error-only hook", async () => {
    const options = createServerSentryOptions({ NODE_ENV: "production", SENTRY_DSN: "https://public@example.invalid/1" })!;
    const envelopes: unknown[] = [];
    const client = new BrowserClient({
      ...options, integrations: [], stackParser: defaultStackParser,
      transport: () => ({ send: async (envelope) => { envelopes.push(envelope); return { statusCode: 200 }; }, flush: async () => true }),
    });
    try {
      const now = Date.now() / 1000;
      client.captureEvent({ type: "transaction", transaction: "GET /lobby/PRIVATE42", start_timestamp: now - 1, timestamp: now,
        request: { url: "https://example.invalid/api/auth/verify-email?token=private-token" },
        contexts: { trace: { trace_id: "a".repeat(32), span_id: "b".repeat(16), data: { "url.full": "https://example.invalid/play/PRIVATE42?token=private-token" } } },
        spans: [{ trace_id: "a".repeat(32), span_id: "c".repeat(16), start_timestamp: now - 0.5, timestamp: now, op: "http.client", description: "GET /rooms/PRIVATE42/preview", data: { "http.url": "http://game:2567/rooms/PRIVATE42/preview?token=private-token" } }],
      });
      expect(await client.flush(1000)).toBe(true);
      expect(envelopes).toHaveLength(1);
      expect(JSON.stringify(envelopes)).not.toContain("PRIVATE42");
      expect(JSON.stringify(envelopes)).not.toContain("private-token");
      expect(JSON.stringify(envelopes)).toContain("/lobby/[code]");
    } finally { await client.close(1000); }
  });
});
