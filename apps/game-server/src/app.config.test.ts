import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import {
  createDeadlineBoundSecurityRedisClient,
  createLocalStatsHandler,
  createReadinessHandler,
  probeSecurityRedisReady,
  resolveGameServerCorsOrigin,
  resolveGameServerRedisUrl,
} from "./app.config.js";

function makeResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

describe("game-server Redis startup guard", () => {
  it("refuses to start production without the shared Redis store", () => {
    expect(() => resolveGameServerRedisUrl({
      NODE_ENV: "production",
      REDIS_URL: undefined,
      REDIS_PASSWORD_FILE: undefined,
    })).toThrow("REDIS_URL");
  });

  it("refuses unauthenticated production Redis", () => {
    expect(() => resolveGameServerRedisUrl({
      NODE_ENV: "production",
      REDIS_URL: "redis://redis:6379",
      REDIS_PASSWORD_FILE: undefined,
    })).toThrow("автентикация");
  });

  it("accepts credentials embedded by a managed Redis provider", () => {
    expect(resolveGameServerRedisUrl({
      NODE_ENV: "production",
      REDIS_URL: "rediss://default:secret@redis.example.com:6380",
      REDIS_PASSWORD_FILE: undefined,
    })).toBe("rediss://default:secret@redis.example.com:6380");
  });

  it("keeps Redis optional outside production", () => {
    expect(resolveGameServerRedisUrl({
      NODE_ENV: "test",
      REDIS_URL: undefined,
      REDIS_PASSWORD_FILE: undefined,
    })).toBeUndefined();
  });

  it("aborts security-store commands that exceed their deadline", async () => {
    const client = {
      withAbortSignal(signal: AbortSignal) {
        return {
          set: () => new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          }),
          eval: () => new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          }),
        };
      },
    };
    const bounded = createDeadlineBoundSecurityRedisClient(client, 10);

    await expect(bounded.set("key", "1", {
      expiration: { type: "PX", value: 1_000 },
      condition: "NX",
    })).rejects.toThrow();
  });

  it("requires a successful Redis write/read/delete round trip for readiness", async () => {
    const healthy = {
      isReady: true,
      withAbortSignal: vi.fn(() => ({
        set: vi.fn(async () => "OK"),
        get: vi.fn(async () => "ready"),
        del: vi.fn(async () => 1),
      })),
    };
    const readOnly = {
      isReady: true,
      withAbortSignal: vi.fn(() => ({
        set: vi.fn(async () => null),
        get: vi.fn(async () => null),
        del: vi.fn(async () => 0),
      })),
    };

    await expect(probeSecurityRedisReady(healthy)).resolves.toBe(true);
    await expect(probeSecurityRedisReady(readOnly)).resolves.toBe(false);
  });
});

describe("game-server production CORS guard", () => {
  it.each([
    "*",
    "http://senkite.com",
    "https://user:secret@senkite.com",
    "https://senkite.com/path",
    "not-a-url",
  ])("refuses unsafe production origin %s", (origin) => {
    expect(() => resolveGameServerCorsOrigin({
      NODE_ENV: "production",
      CORS_ORIGIN: origin,
      BETTER_AUTH_URL: "https://senkite.com",
      PUBLIC_WEB_DOMAIN: "senkite.com",
    })).toThrow();
  });

  it("accepts one exact HTTPS application origin", () => {
    expect(resolveGameServerCorsOrigin({
      NODE_ENV: "production",
      CORS_ORIGIN: "https://senkite.com",
      BETTER_AUTH_URL: "https://senkite.com",
      PUBLIC_WEB_DOMAIN: "senkite.com",
    })).toEqual(["https://senkite.com"]);
  });
});

describe("game-server readiness handler", () => {
  it("returns 200 when persistence is ready", async () => {
    const response = makeResponse();

    await createReadinessHandler(async () => true)(
      {} as Request,
      response as unknown as Response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      ok: true,
      service: "werewolf-game-server",
      status: "ready",
    });
  });

  it("returns a non-sensitive 503 when persistence is unavailable", async () => {
    const response = makeResponse();

    await createReadinessHandler(async () => {
      throw new Error("postgres://user:secret@private-host/werewolf");
    })({} as Request, response as unknown as Response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      ok: false,
      service: "werewolf-game-server",
      status: "not_ready",
    });
    expect(JSON.stringify(response.json.mock.calls)).not.toContain("private-host");
    expect(JSON.stringify(response.json.mock.calls)).not.toContain("secret");
  });
});

describe("game-server operator handlers", () => {
  it("does not expose runtime memory metrics off loopback", () => {
    const response = makeResponse();

    createLocalStatsHandler()(
      { socket: { remoteAddress: "172.18.0.5" } } as unknown as Request,
      response as unknown as Response,
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ ok: false });
    expect(JSON.stringify(response.json.mock.calls)).not.toContain("rssBytes");
  });
});
