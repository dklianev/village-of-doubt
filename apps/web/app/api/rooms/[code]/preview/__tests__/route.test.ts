import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoomPreviewHandler, GET } from "../route";

const context = { params: Promise.resolve({ code: "ABC234" }) };

describe("GET /api/rooms/[code]/preview", () => {
  beforeEach(() => {
    vi.stubEnv("GAME_SERVER_HTTP_URL", "http://game.local");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns missing only when the upstream room is absent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const response = await GET(new Request("http://web.local/api/rooms/ABC234/preview"), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ status: "missing" });
  });

  it.each([
    ["server error", () => Promise.resolve(new Response(null, { status: 500 }))],
    ["network failure", () => Promise.reject(new Error("offline"))],
    ["invalid payload", () => Promise.resolve(Response.json({ status: "lobby" }))],
  ])("returns a retryable unavailable response for %s", async (_name, responseFactory) => {
    vi.stubGlobal("fetch", vi.fn(responseFactory));

    const response = await GET(new Request("http://web.local/api/rooms/ABC234/preview"), context);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("retry-after")).toBe("3");
    await expect(response.json()).resolves.toEqual({ status: "unavailable" });
  });

  it("redacts player identities when no active session is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          code: "ABC234",
          status: "lobby",
          playerCount: 2,
          capacity: 8,
          family: "werewolves",
          hostName: "Борил",
          players: [{ displayName: "Борил", connected: true, ready: true, host: true }],
        }),
      ),
    );

    const response = await GET(new Request("http://web.local/api/rooms/ABC234/preview"), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      code: "ABC234",
      status: "lobby",
      playerCount: 2,
      hostName: null,
      players: [],
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://game.local/rooms/ABC234/preview",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("keeps the bounded player preview for an authenticated viewer", async () => {
    const handler = createRoomPreviewHandler({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
      getSession: vi.fn().mockResolvedValue({ user: { id: "viewer-1" } }),
      fetcher: vi.fn().mockResolvedValue(Response.json({
        code: "ABC234",
        status: "lobby",
        playerCount: 2,
        capacity: 8,
        family: "werewolves",
        hostName: "Борил",
        players: [{ displayName: "Борил", connected: true, ready: true, host: true }],
      })),
    });

    const response = await handler(new Request("http://web.local/api/rooms/ABC234/preview"), context);

    await expect(response.json()).resolves.toMatchObject({
      hostName: "Борил",
      players: [{ displayName: "Борил", host: true }],
    });
  });

  it("rate-limits room enumeration before hitting the game server", async () => {
    const fetcher = vi.fn();
    const handler = createRoomPreviewHandler({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 17 }),
      getSession: vi.fn(),
      fetcher,
    });

    const response = await handler(new Request("http://web.local/api/rooms/ABC234/preview"), context);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    expect(fetcher).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "Твърде много проверки на стаи. Опитай отново след малко.",
    });
  });
});
