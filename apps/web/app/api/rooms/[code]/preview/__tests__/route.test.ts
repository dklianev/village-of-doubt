import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyRoomPreviewCredential } from "@werewolf/shared/server";
import { createRoomPreviewHandler, GET } from "../route";

const context = { params: Promise.resolve({ code: "ABC234" }) };
const admission = {
  mode: "werewolves_classic", roomVisibility: "private", viewerMembership: "none",
  canJoinAsPlayer: true, canSpectate: true,
};

describe("GET /api/rooms/[code]/preview", () => {
  beforeEach(() => {
    vi.stubEnv("GAME_SERVER_HTTP_URL", "http://game.local");
    vi.stubEnv("GAME_TOKEN_SECRET", "test-secret-that-is-long-enough-32-chars");
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
          ...admission,
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
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          "X-Werewolf-Room-Preview": expect.any(String),
        }),
      }),
    );
  });

  it("keeps the bounded player preview for an authenticated viewer", async () => {
    const handler = createRoomPreviewHandler({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
      getSession: vi.fn().mockResolvedValue({ user: { id: "viewer-1" } }),
      fetcher: vi.fn().mockResolvedValue(Response.json({
        ...admission,
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

  it("forwards only the session viewer identity and preserves server admission decisions", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({
      ...admission, code: "ABC234", status: "in_game", family: "werewolves",
      playerCount: 8, capacity: 8, viewerMembership: "participant", canSpectate: false,
    }));
    const handler = createRoomPreviewHandler({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      getSession: vi.fn().mockResolvedValue({ user: { id: "verified-viewer" } }),
      fetcher,
    });
    const response = await handler(new Request("http://web.local/api/rooms/ABC234/preview?viewerUserId=forged", {
      headers: { "X-Werewolf-Room-Preview-Viewer": "forged" },
    }), context);

    expect(fetcher).toHaveBeenCalledWith("http://game.local/rooms/ABC234/preview", expect.objectContaining({
      headers: expect.objectContaining({ "X-Werewolf-Room-Preview-Viewer": "verified-viewer" }),
    }));
    const credential = fetcher.mock.calls[0]?.[1].headers["X-Werewolf-Room-Preview"] as string;
    const secret = "test-secret-that-is-long-enough-32-chars";
    expect(verifyRoomPreviewCredential("ABC234", credential, secret, "verified-viewer")).toBe(true);
    expect(verifyRoomPreviewCredential("ABC234", credential, secret, "forged")).toBe(false);
    expect(verifyRoomPreviewCredential("ABC234", credential, secret)).toBe(false);
    await expect(response.json()).resolves.toMatchObject({
      mode: "werewolves_classic", roomVisibility: "private", viewerMembership: "participant",
      canJoinAsPlayer: true, canSpectate: false,
    });
  });

  it("does not send an untrusted viewer header for an anonymous request", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    const handler = createRoomPreviewHandler({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      getSession: vi.fn().mockResolvedValue(null), fetcher,
    });
    await handler(new Request("http://web.local/api/rooms/ABC234/preview", {
      headers: { "X-Werewolf-Room-Preview-Viewer": "forged" },
    }), context);
    expect(fetcher.mock.calls[0]?.[1].headers).not.toHaveProperty("X-Werewolf-Room-Preview-Viewer");
  });

  it.each([
    { canJoinAsPlayer: undefined },
    { canSpectate: "true" },
    { viewerMembership: "host" },
    { mode: "mafia_free" },
    { roomVisibility: undefined },
  ])("fails closed on malformed admission data %j", async (invalid) => {
    const handler = createRoomPreviewHandler({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      getSession: vi.fn().mockResolvedValue(null),
      fetcher: vi.fn().mockResolvedValue(Response.json({
        ...admission, code: "ABC234", status: "lobby", family: "werewolves",
        playerCount: 1, capacity: 8, ...invalid,
      })),
    });
    const response = await handler(new Request("http://web.local/api/rooms/ABC234/preview"), context);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "unavailable" });
  });
});
