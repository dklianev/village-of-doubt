import { describe, expect, it, vi } from "vitest";
import { RedisUnavailableError } from "../redis-rate-limit";
import { createRuntimeRedisEvalClient } from "../runtime-rate-limit";

describe("createRuntimeRedisEvalClient", () => {
  it("отказва веднага, без да чака Redis connect promise", async () => {
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
