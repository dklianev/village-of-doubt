import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

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

  it("returns a bounded public preview for a healthy room", async () => {
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
          players: [],
        }),
      ),
    );

    const response = await GET(new Request("http://web.local/api/rooms/ABC234/preview"), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({ code: "ABC234", status: "lobby", playerCount: 2 });
    expect(fetch).toHaveBeenCalledWith(
      "http://game.local/rooms/ABC234/preview",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
