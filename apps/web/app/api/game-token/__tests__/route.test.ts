import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

describe("POST /api/game-token", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("rejects requests without a session", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const response = await POST(jsonRequest({ code: "MN2K7A" }, "203.0.113.1"));

    expect(response.status).toBe(401);
  });

  it("rejects an empty room code", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1", name: "Анна" } } as never);

    const response = await POST(jsonRequest({ code: "" }, "203.0.113.2"));

    expect(response.status).toBe(400);
  });

  it("rejects malformed room codes", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1", name: "Анна" } } as never);

    await expectStatus({ code: "ABC" }, 400, "203.0.113.3");
    await expectStatus({ code: "OOOOOO" }, 400, "203.0.113.4");
    await expectStatus({ code: 123456 }, 400, "203.0.113.5");
  });

  it("issues a token for a valid session and room code", async () => {
    vi.stubEnv("GAME_TOKEN_SECRET", "test-secret-that-is-long-enough-32-chars");
    vi.stubEnv("NODE_ENV", "test");
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1", name: "Анна" } } as never);

    const response = await POST(jsonRequest({ code: "mn2-k7a" }, "203.0.113.6"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token).toBeTruthy();
    expect(body.userId).toBe("user-1");
    expect(body.displayName).toBe("Анна");
    expect(body.avatarId).toBe("portrait-m01");
    expect(body.roomCode).toBe("MN2K7A");
  });

  it("includes the viewer's validated portrait in the signed token", async () => {
    vi.stubEnv("GAME_TOKEN_SECRET", "test-secret-that-is-long-enough-32-chars");
    vi.stubEnv("NODE_ENV", "test");
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "portrait-user", name: "Анна", avatarId: "portrait-f05" },
    } as never);

    const response = await POST(jsonRequest({ code: "MN2K7A" }, "203.0.113.10"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.avatarId).toBe("portrait-f05");
  });

  it("нормализира и ограничава името в игровия ключ до 32 символа", async () => {
    vi.stubEnv("GAME_TOKEN_SECRET", "test-secret-that-is-long-enough-32-chars");
    vi.stubEnv("NODE_ENV", "test");
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "long-name-user", name: `  ${"А".repeat(40)}  ` },
    } as never);

    const response = await POST(jsonRequest({ code: "MN2K7A" }, "203.0.113.9"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.displayName).toBe("А".repeat(32));
  });

  it("отказва прекалено голямо тяло преди session lookup", async () => {
    const { auth } = await import("@/lib/auth");
    const request = new Request("http://localhost/api/game-token", {
      method: "POST",
      headers: {
        "content-length": "4096",
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.7",
      },
      body: JSON.stringify({ code: "MN2K7A" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(auth.api.getSession).not.toHaveBeenCalled();
  });

  it("отказва невалиден JSON", async () => {
    const request = new Request("http://localhost/api/game-token", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.8",
      },
      body: "{",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("ограничава издаването на ключове за един потребител", async () => {
    vi.stubEnv("GAME_TOKEN_SECRET", "test-secret-that-is-long-enough-32-chars");
    vi.stubEnv("NODE_ENV", "test");
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "rate-limited-user", name: "Анна" },
    } as never);

    for (let index = 0; index < 12; index += 1) {
      const response = await POST(jsonRequest({ code: "MN2K7A" }, `198.51.100.${index + 1}`));
      expect(response.status).toBe(200);
    }

    const blocked = await POST(jsonRequest({ code: "MN2K7A" }, "198.51.100.200"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    await expect(blocked.json()).resolves.toEqual({
      error: "Твърде много заявки за игрови ключ. Опитай отново след малко.",
    });
  });
});

async function expectStatus(body: unknown, status: number, ip: string) {
  const response = await POST(jsonRequest(body, ip));
  expect(response.status).toBe(status);
}

function jsonRequest(body: unknown, ip: string) {
  return new Request("http://localhost/api/game-token", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}
