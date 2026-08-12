import { describe, expect, it, vi } from "vitest";
import * as intakeSecurity from "@/lib/intake-security";

const { createIntakeRateLimiter, requestRateLimitKey } = intakeSecurity;

describe("requestRateLimitKey", () => {
  it("uses the proxy-owned forwarded address instead of a spoofable real-IP header", () => {
    const first = new Request("https://example.invalid/api/report", {
      headers: { "x-forwarded-for": "203.0.113.8", "x-real-ip": "198.51.100.1" },
    });
    const second = new Request("https://example.invalid/api/report", {
      headers: { "x-forwarded-for": "203.0.113.8", "x-real-ip": "198.51.100.2" },
    });

    expect(requestRateLimitKey(first)).toBe(requestRateLimitKey(second));
  });

  it("събира заявки без proxy-owned адрес в един unknown bucket", () => {
    const first = new Request("https://example.invalid/api/report", {
      headers: { cookie: "session=first", "user-agent": "first-agent" },
    });
    const second = new Request("https://example.invalid/api/report", {
      headers: { cookie: "session=second", "user-agent": "second-agent" },
    });

    expect(requestRateLimitKey(first)).toBe(requestRateLimitKey(second));
  });

  it("събира IPv6 privacy адреси от една /64 мрежа в общ bucket", () => {
    const first = new Request("https://example.invalid/api/report", {
      headers: { "x-forwarded-for": "2001:db8:abcd:1234:1111:2222:3333:4444" },
    });
    const second = new Request("https://example.invalid/api/report", {
      headers: { "x-forwarded-for": "2001:db8:abcd:1234:aaaa:bbbb:cccc:dddd" },
    });

    expect(requestRateLimitKey(first)).toBe(requestRateLimitKey(second));
  });

  it("разделя съседни IPv6 /64 мрежи", () => {
    const first = new Request("https://example.invalid/api/report", {
      headers: { "x-forwarded-for": "2001:db8:abcd:1234::1" },
    });
    const second = new Request("https://example.invalid/api/report", {
      headers: { "x-forwarded-for": "2001:db8:abcd:1235::1" },
    });

    expect(requestRateLimitKey(first)).not.toBe(requestRateLimitKey(second));
  });

  it("не позволява malformed proxy стойности да създават нови buckets", () => {
    const first = new Request("https://example.invalid/api/report", {
      headers: { "x-forwarded-for": "attacker-controlled-one" },
    });
    const second = new Request("https://example.invalid/api/report", {
      headers: { "x-forwarded-for": "attacker-controlled-two" },
    });

    expect(requestRateLimitKey(first)).toBe(requestRateLimitKey(second));
  });
});

describe("createIntakeRateLimiter", () => {
  it("пази map-а под твърд лимит и почиства изтеклите записи", () => {
    const limiter = createIntakeRateLimiter({ limit: 2, windowMs: 100, maxEntries: 2 });

    limiter.check("first", 0);
    limiter.check("second", 0);
    limiter.check("third", 1);

    expect(limiter).toHaveProperty("entryCount");
    expect((limiter as typeof limiter & { entryCount: () => number }).entryCount()).toBeLessThanOrEqual(2);

    limiter.check("fresh", 200);
    expect((limiter as typeof limiter & { entryCount: () => number }).entryCount()).toBe(1);
  });

  it("има async adapter seam за атомарен shared backend", async () => {
    const factory = (intakeSecurity as Record<string, unknown>).createSharedIntakeRateLimiter;
    expect(factory).toBeTypeOf("function");
    if (typeof factory !== "function") {
      return;
    }

    const backend = {
      consume: vi.fn(async () => ({ allowed: false as const, retryAfterSeconds: 7 })),
    };
    const limiter = factory({ limit: 5, windowMs: 1_000 }, backend) as {
      check: (key: string, now?: number) => Promise<unknown>;
    };

    await expect(limiter.check("shared-key", 42)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 7,
    });
    expect(backend.consume).toHaveBeenCalledWith({
      key: "shared-key",
      limit: 5,
      windowMs: 1_000,
      now: 42,
    });
  });

  it("изгражда runtime limiter върху подадения shared backend", async () => {
    const factory = (intakeSecurity as Record<string, unknown>).createRuntimeIntakeRateLimiter;
    expect(factory).toBeTypeOf("function");
    if (typeof factory !== "function") {
      return;
    }

    const backend = {
      consume: vi.fn(async () => ({ allowed: true as const })),
    };
    const limiter = factory(
      { limit: 3, windowMs: 2_000 },
      "feedback",
      backend,
    ) as { check: (key: string, now?: number) => Promise<unknown> };

    await expect(limiter.check("source", 50)).resolves.toEqual({ allowed: true });
    expect(backend.consume).toHaveBeenCalledWith({
      key: "source",
      limit: 3,
      windowMs: 2_000,
      now: 50,
    });
  });

  it("не evict-ва активен blocked bucket и не reset-ва квотата при пълен store", () => {
    const limiter = createIntakeRateLimiter({ limit: 1, windowMs: 100, maxEntries: 1 });

    expect(limiter.check("blocked-user", 0)).toEqual({ allowed: true });
    expect(limiter.check("blocked-user", 1)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(limiter.check(`new-user-${attempt}`, 2 + attempt)).toMatchObject({ allowed: false });
      expect(limiter.entryCount()).toBe(1);
    }

    expect(limiter.check("blocked-user", 50)).toMatchObject({ allowed: false });
    expect(limiter.check("blocked-user", 100)).toEqual({ allowed: true });
  });
});
