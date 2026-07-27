import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as proxyModule from "../../proxy";

describe("proxy rate-limit guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("използва bounded store и освобождава изтеклите buckets", () => {
    const factory = (proxyModule as Record<string, unknown>).createProxyRateLimitGuard;
    expect(factory).toBeTypeOf("function");
    if (typeof factory !== "function") {
      return;
    }

    const guard = factory({ maxEntries: 2, windowMs: 100 }) as {
      check: (key: string, limit: number, now?: number) => unknown;
      entryCount: () => number;
    };
    guard.check("first", 2, 0);
    guard.check("second", 2, 0);
    guard.check("third", 2, 1);
    expect(guard.entryCount()).toBeLessThanOrEqual(2);

    guard.check("fresh", 2, 200);
    expect(guard.entryCount()).toBe(1);
  });

  it("пази 30-играчова група зад общ NAT, но спира прекомерния burst", async () => {
    vi.stubEnv("NODE_ENV", "production");
    let response: Response | undefined;

    for (let attempt = 0; attempt < 120; attempt += 1) {
      response = await proxyModule.proxy(new NextRequest("https://example.test/api/game-token", {
        headers: {
          cookie: "better-auth.session_token=forged",
          "x-forwarded-for": "203.0.113.77",
        },
      }));
    }

    expect(response?.status).toBe(200);
    response = await proxyModule.proxy(new NextRequest("https://example.test/api/game-token", {
      headers: {
        cookie: "better-auth.session_token=forged",
        "x-forwarded-for": "203.0.113.77",
      },
    }));

    expect(response?.status).toBe(429);
  });
});
