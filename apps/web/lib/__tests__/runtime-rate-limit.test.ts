import { describe, expect, it, vi } from "vitest";
import { RedisUnavailableError } from "../redis-rate-limit";
import {
  createRuntimeRedisReadinessProbe,
  createRuntimeRedisPublisher,
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
    let abortCount = 0;
    const client = createRuntimeRedisEvalClient(() => ({
      isReady: true,
      eval: vi.fn(() => new Promise(() => {})),
      withAbortSignal(signal: AbortSignal) {
        return {
          isReady: true,
          eval: vi.fn(() => new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              abortCount += 1;
              reject(signal.reason);
            }, { once: true });
          })),
        };
      },
    }), 250);
    const result = client.eval("return 1", {
      keys: [],
      arguments: [],
    });
    const assertion = expect(result).rejects.toBeInstanceOf(RedisUnavailableError);

    await vi.advanceTimersByTimeAsync(250);
    await assertion;
    expect(abortCount).toBe(1);
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

  it("третира Redis OOM като временна недостъпност, не като 500 грешка", async () => {
    const client = createRuntimeRedisEvalClient(() => ({
      isReady: true,
      eval: vi.fn(async () => {
        throw new Error("OOM command not allowed when used memory > 'maxmemory'");
      }),
    }));

    await expect(client.eval("return 1", {
      keys: [],
      arguments: [],
    })).rejects.toBeInstanceOf(RedisUnavailableError);
  });
});

describe("createRuntimeRedisReadinessProbe", () => {
  it("изчаква свързването и изисква успешен EVAL write/read/delete цикъл", async () => {
    let ready = false;
    const evalCommand = vi.fn(async () => "ready");
    const probe = createRuntimeRedisReadinessProbe(
      () => ({ isReady: ready, eval: evalCommand }),
      250,
      async () => {
        ready = true;
      },
    );

    await expect(probe()).resolves.toBe(true);
    expect(evalCommand).toHaveBeenCalledOnce();
    expect(evalCommand).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('SET'"),
      expect.objectContaining({
        keys: [expect.stringMatching(/^wm:health:web:/)],
        arguments: ["ready", "5000"],
      }),
    );
  });

  it("връща false при timeout без да издава Redis грешката", async () => {
    vi.useFakeTimers();
    const probe = createRuntimeRedisReadinessProbe(
      () => ({
        isReady: true,
        eval: vi.fn(() => new Promise<string>(() => {})),
      }),
      250,
    );
    const result = probe();

    await vi.advanceTimersByTimeAsync(250);
    await expect(result).resolves.toBe(false);
    vi.useRealTimers();
  });

  it("връща false, когато Redis ACL отказва EVAL", async () => {
    const probe = createRuntimeRedisReadinessProbe(() => ({
      isReady: true,
      eval: vi.fn(async () => {
        throw new Error("NOPERM this user has no permissions to run the 'eval' command");
      }),
    }));

    await expect(probe()).resolves.toBe(false);
  });
});

describe("createRuntimeRedisPublisher", () => {
  it("публикува само след готова Redis връзка", async () => {
    let ready = false;
    const publish = vi.fn(async () => 2);
    const publisher = createRuntimeRedisPublisher(
      () => ({ isReady: ready, publish }),
      250,
      async () => { ready = true; },
    );

    await expect(publisher("security", "payload")).resolves.toBe(2);
    expect(publish).toHaveBeenCalledWith("security", "payload");
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

  it("can intentionally use memory fallback for low-risk production intake", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REDIS_URL", "");
    const backend = getRuntimeRateLimitBackend("missing-production-redis-memory", {
      outageMode: "memory",
    });

    await expect(backend.consume({
      key: "source-1",
      limit: 5,
      windowMs: 60_000,
      now: 1_000,
    })).resolves.toEqual({ allowed: true });

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
