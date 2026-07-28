import { describe, expect, it, vi } from "vitest";
import { RedisUnavailableError } from "../redis-rate-limit";
import {
  createRuntimeRedisReadinessProbe,
  createRuntimeRedisEvalClient,
  getRuntimeRateLimitBackend,
  resolveRuntimeRedisUrl,
} from "../runtime-rate-limit";

describe("createRuntimeRedisEvalClient", () => {
  it("отказва веднага, когато няма активна Redis връзка", async () => {
    const evalCommand = vi.fn();
    const client = createRuntimeRedisEvalClient(() => ({
      isReady: false,
      eval: evalCommand,
    }));

    await expect(client.eval("return 1", {
      keys: [],
      arguments: [],
    })).rejects.toBeInstanceOf(RedisUnavailableError);
    expect(evalCommand).not.toHaveBeenCalled();
  });

  it("изчаква текущото свързване преди първата Redis команда", async () => {
    let ready = false;
    const evalCommand = vi.fn(async () => 1);
    const client = createRuntimeRedisEvalClient(
      () => ({
        isReady: ready,
        eval: evalCommand,
      }),
      250,
      async () => {
        ready = true;
      },
    );

    await expect(client.eval("return 1", {
      keys: [],
      arguments: [],
    })).resolves.toBe(1);
    expect(evalCommand).toHaveBeenCalledOnce();
  });

  it("прекъсва бавна команда в ограничения срок", async () => {
    vi.useFakeTimers();
    const client = createRuntimeRedisEvalClient(() => ({
      isReady: true,
      eval: vi.fn(() => new Promise(() => {})),
    }), 250);
    const result = client.eval("return 1", {
      keys: [],
      arguments: [],
    });
    const assertion = expect(result).rejects.toBeInstanceOf(RedisUnavailableError);

    await vi.advanceTimersByTimeAsync(250);
    await assertion;
    vi.useRealTimers();
  });

  it("не прикрива Redis ACL грешки", async () => {
    const client = createRuntimeRedisEvalClient(() => ({
      isReady: true,
      eval: vi.fn(async () => {
        throw new Error("NOAUTH Authentication required");
      }),
    }));

    await expect(client.eval("return 1", {
      keys: [],
      arguments: [],
    })).rejects.toThrow("NOAUTH");
  });
});

describe("createRuntimeRedisReadinessProbe", () => {
  it("изчаква свързването и изисква PONG", async () => {
    let ready = false;
    const ping = vi.fn(async () => "PONG");
    const probe = createRuntimeRedisReadinessProbe(
      () => ({ isReady: ready, ping }),
      250,
      async () => {
        ready = true;
      },
    );

    await expect(probe()).resolves.toBe(true);
    expect(ping).toHaveBeenCalledOnce();
  });

  it("връща false при timeout без да издава Redis грешката", async () => {
    vi.useFakeTimers();
    const probe = createRuntimeRedisReadinessProbe(
      () => ({
        isReady: true,
        ping: vi.fn(() => new Promise<string>(() => {})),
      }),
      250,
    );
    const result = probe();

    await vi.advanceTimersByTimeAsync(250);
    await expect(result).resolves.toBe(false);
    vi.useRealTimers();
  });
});

describe("getRuntimeRateLimitBackend", () => {
  it("fails closed in production when Redis is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REDIS_URL", "");
    const backend = getRuntimeRateLimitBackend("missing-production-redis");

    await expect(backend.consume({
      key: "user-1",
      limit: 5,
      windowMs: 60_000,
      now: 1_000,
    })).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 5,
    });

    vi.unstubAllEnvs();
  });
});

describe("resolveRuntimeRedisUrl", () => {
  it("rejects unauthenticated production Redis", () => {
    expect(() => resolveRuntimeRedisUrl(
      "redis://redis:6379",
      undefined,
      "production",
    )).toThrow("автентикация");
  });

  it("accepts managed Redis credentials embedded in the URL", () => {
    expect(resolveRuntimeRedisUrl(
      "rediss://default:secret@redis.example.com:6380",
      undefined,
      "production",
    )).toBe("rediss://default:secret@redis.example.com:6380");
  });
});
