import { describe, expect, it, vi, afterEach } from "vitest";
import { POST } from "../route";

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
}));

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
  });

  it("rejects requests without a session", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const response = await POST(jsonRequest({ code: "ABC123" }));

    expect(response.status).toBe(401);
  });

  it("rejects an empty room code", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1", name: "Анна" } } as never);

    const response = await POST(jsonRequest({ code: "" }));

    expect(response.status).toBe(400);
  });

  it("rejects malformed room codes", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1", name: "Анна" } } as never);

    await expectStatus({ code: "ABC" }, 400);
    await expectStatus({ code: "ABCDEF1234567" }, 400);
    await expectStatus({ code: "abc-123" }, 400);
  });

  it("issues a token for a valid session and room code", async () => {
    vi.stubEnv("GAME_TOKEN_SECRET", "test-secret-that-is-long-enough-32-chars");
    vi.stubEnv("NODE_ENV", "test");
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1", name: "Анна" } } as never);

    const response = await POST(jsonRequest({ code: "abc123" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token).toBeTruthy();
    expect(body.userId).toBe("user-1");
    expect(body.displayName).toBe("Анна");
    expect(body.roomCode).toBe("ABC123");
  });
});

async function expectStatus(body: unknown, status: number) {
  const response = await POST(jsonRequest(body));
  expect(response.status).toBe(status);
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/game-token", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
