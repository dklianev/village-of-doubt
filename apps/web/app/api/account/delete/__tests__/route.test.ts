import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const { createDatabase, deleteUserAccountAtomically, getSession, revalidateTag, revokeActiveGameSessions } = vi.hoisted(() => ({
  createDatabase: vi.fn(() => ({ mocked: true })),
  deleteUserAccountAtomically: vi.fn(() => Promise.resolve(true)),
  getSession: vi.fn(),
  revalidateTag: vi.fn(),
  revokeActiveGameSessions: vi.fn(() => Promise.resolve()),
}));

vi.mock("next/cache", () => ({ revalidateTag }));

vi.mock("@/lib/auth", () => ({
  ACCOUNT_DELETE_FRESH_AGE_SECONDS: 10 * 60,
  auth: {
    api: {
      getSession,
    },
  },
}));

vi.mock("@werewolf/database", () => ({
  createDatabase,
  deleteUserAccountAtomically,
}));

vi.mock("@/lib/game-session-revocation", () => ({ revokeActiveGameSessions }));

function deleteRequest(options: { intent?: string; origin?: string } = {}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.origin !== undefined) {
    headers.set("origin", options.origin);
  }

  return new Request("http://localhost:3000/api/account/delete", {
    method: "POST",
    headers,
    body: JSON.stringify({ intent: options.intent ?? "delete-account" }),
  });
}

describe("POST /api/account/delete", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/werewolf");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("отказва заявка без same-origin доказателство", async () => {
    const response = await POST(deleteRequest());

    expect(response.status).toBe(403);
    expect(getSession).not.toHaveBeenCalled();
    expect(deleteUserAccountAtomically).not.toHaveBeenCalled();
  });

  it("отказва cross-origin заявка", async () => {
    const response = await POST(deleteRequest({ origin: "https://attacker.example" }));

    expect(response.status).toBe(403);
    expect(deleteUserAccountAtomically).not.toHaveBeenCalled();
  });

  it("отказва невалиден Origin header", async () => {
    const response = await POST(deleteRequest({ origin: "not-an-origin" }));

    expect(response.status).toBe(403);
    expect(deleteUserAccountAtomically).not.toHaveBeenCalled();
  });

  it("изисква изрично server-side намерение", async () => {
    const response = await POST(deleteRequest({ origin: "http://localhost:3000", intent: "preview-account" }));

    expect(response.status).toBe(400);
    expect(getSession).not.toHaveBeenCalled();
    expect(deleteUserAccountAtomically).not.toHaveBeenCalled();
  });

  it("отказва гости", async () => {
    getSession.mockResolvedValueOnce(null);

    const response = await POST(deleteRequest({ origin: "http://localhost:3000" }));

    expect(response.status).toBe(401);
    expect(deleteUserAccountAtomically).not.toHaveBeenCalled();
  });

  it("изтрива текущия потребител и историята му в една database операция", async () => {
    getSession.mockResolvedValueOnce(freshSession("user-1"));

    const response = await POST(deleteRequest({ origin: "http://localhost:3000" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(createDatabase).toHaveBeenCalledWith("postgres://localhost/werewolf");
    expect(deleteUserAccountAtomically).toHaveBeenCalledWith({ mocked: true }, "user-1");
    expect(revokeActiveGameSessions).toHaveBeenCalledWith("user-1", { requireRealtime: true });
    expect(revalidateTag).toHaveBeenCalledWith("public-leaderboard", "max");
    expect(revalidateTag).toHaveBeenCalledWith("public-game-history", "max");
  });

  it("не изтрива профила, ако активните игрови сесии не могат да бъдат прекратени", async () => {
    getSession.mockResolvedValueOnce(freshSession("user-1"));
    revokeActiveGameSessions.mockRejectedValueOnce(new Error("redis unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(deleteRequest({ origin: "http://localhost:3000" }));

    expect(response.status).toBe(500);
    expect(deleteUserAccountAtomically).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("изисква повторно влизане при сесия по-стара от 10 минути", async () => {
    getSession.mockResolvedValueOnce({
      user: { id: "user-1" },
      session: { createdAt: new Date(Date.now() - 10 * 60 * 1_000 - 1) },
    });

    const response = await POST(deleteRequest({ origin: "http://localhost:3000" }));

    expect(response.status).toBe(403);
    expect(deleteUserAccountAtomically).not.toHaveBeenCalled();
  });

  it("връща service unavailable без база", async () => {
    vi.stubEnv("DATABASE_URL", "");
    getSession.mockResolvedValueOnce(freshSession("user-1"));

    const response = await POST(deleteRequest({ origin: "http://localhost:3000" }));

    expect(response.status).toBe(503);
    expect(deleteUserAccountAtomically).not.toHaveBeenCalled();
  });

  it("отказва прекалено голямо потвърждение", async () => {
    const request = deleteRequest({ origin: "http://localhost:3000" });
    request.headers.set("content-length", "1024");

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("връща безопасна грешка при rollback на транзакцията", async () => {
    getSession.mockResolvedValueOnce(freshSession("user-1"));
    deleteUserAccountAtomically.mockRejectedValueOnce(new Error("private provider details"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(deleteRequest({ origin: "http://localhost:3000" }));

    expect(response.status).toBe(500);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("private provider details");
    consoleError.mockRestore();
  });
});

function freshSession(userId: string) {
  return {
    user: { id: userId },
    session: { createdAt: new Date() },
  };
}
