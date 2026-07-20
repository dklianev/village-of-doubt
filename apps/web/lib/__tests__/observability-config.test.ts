import { describe, expect, it } from "vitest";
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
    });
  });

  it("does not initialize from the removed client DSN", () => {
    expect(createServerSentryOptions({
      NODE_ENV: "production",
      NEXT_PUBLIC_SENTRY_DSN: "https://client@example.invalid/2",
      RELEASE_VERSION: "release-2026-07-20.1",
    })).toBeUndefined();
  });
});
