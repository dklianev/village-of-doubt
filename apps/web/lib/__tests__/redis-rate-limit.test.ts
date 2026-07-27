import { describe, expect, it, vi } from "vitest";
import {
  createBetterAuthRateLimitStorage,
  createRedisRateLimitBackend,
  RedisUnavailableError,
} from "../redis-rate-limit";
import type { SharedRateLimitBackend } from "../rate-limit";

describe("createRedisRateLimitBackend", () => {
  it("използва атомарен Redis прозорец и връща оставащото време", async () => {
    const evalCommand = vi.fn(async (
      _script: string,
      _options: { keys: string[]; arguments: string[] },
    ) => [3, 4_250]);
    const backend = createRedisRateLimitBackend({
      client: { eval: evalCommand },
      namespace: "feedback",
    });

    await expect(backend.consume({
      key: "source-key",
      limit: 2,
      windowMs: 5_000,
      now: 100,
    })).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 5,
    });
    expect(evalCommand).toHaveBeenCalledOnce();
    expect(evalCommand.mock.calls[0]?.[1]).toMatchObject({
      keys: [expect.stringMatching(/^wm:rate:feedback:/)],
      arguments: ["5000"],
    });
  });

  it("деградира към bounded memory limiter при Redis грешка", async () => {
    const onError = vi.fn();
    const backend = createRedisRateLimitBackend({
      client: {
        eval: vi.fn(async () => {
          throw new RedisUnavailableError("redis unavailable");
        }),
      },
      namespace: "report",
      onError,
    });

    await expect(backend.consume({
      key: "source-key",
      limit: 1,
      windowMs: 1_000,
      now: 0,
    })).resolves.toEqual({ allowed: true });
    await expect(backend.consume({
      key: "source-key",
      limit: 1,
      windowMs: 1_000,
      now: 1,
    })).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
    expect(onError).toHaveBeenCalledOnce();
  });

  it("не прикрива Redis конфигурационна грешка като outage", async () => {
    const backend = createRedisRateLimitBackend({
      client: { eval: vi.fn(async () => { throw new Error("NOAUTH"); }) },
      namespace: "report",
      onError: vi.fn(),
    });

    await expect(backend.consume({
      key: "source-key",
      limit: 1,
      windowMs: 1_000,
      now: 0,
    })).rejects.toThrow("NOAUTH");
  });

  it("не прикрива невалиден Redis protocol отговор като outage", async () => {
    const backend = createRedisRateLimitBackend({
      client: { eval: vi.fn(async () => ["invalid"]) },
      namespace: "report",
      onError: vi.fn(),
    });

    await expect(backend.consume({
      key: "source-key",
      limit: 1,
      windowMs: 1_000,
      now: 0,
    })).rejects.toThrow("невалиден rate-limit отговор");
  });
});

describe("createBetterAuthRateLimitStorage", () => {
  it("превежда Better Auth секундите към shared backend милисекунди", async () => {
    const backend: SharedRateLimitBackend = {
      consume: vi.fn(async () => ({
        allowed: false,
        retryAfterSeconds: 9,
      })),
    };
    const storage = createBetterAuthRateLimitStorage(backend);

    await expect(storage.consume?.("sign-in", { window: 60, max: 10 })).resolves.toEqual({
      allowed: false,
      retryAfter: 9,
    });
    expect(backend.consume).toHaveBeenCalledWith({
      key: "sign-in",
      limit: 10,
      windowMs: 60_000,
      now: expect.any(Number),
    });
  });
});
