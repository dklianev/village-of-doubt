import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { checkDatabaseReadiness, createDatabase } = vi.hoisted(() => ({
  checkDatabaseReadiness: vi.fn(),
  createDatabase: vi.fn(() => ({ mocked: true })),
}));

vi.mock("@werewolf/database", () => ({
  checkDatabaseReadiness,
  createDatabase,
}));

const { checkRuntimeRedisReadiness } = vi.hoisted(() => ({
  checkRuntimeRedisReadiness: vi.fn(),
}));

vi.mock("@/lib/runtime-rate-limit", () => ({
  checkRuntimeRedisReadiness,
}));

import { GET } from "../route";

describe("GET /api/health/ready", () => {
  beforeEach(() => {
    checkRuntimeRedisReadiness.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("връща 200 само когато базата приема заявки", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/werewolf");
    checkDatabaseReadiness.mockResolvedValueOnce(true);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "werewolf-web",
      kind: "readiness",
    });
    expect(createDatabase).toHaveBeenCalledWith("postgres://localhost/werewolf");
  });

  it("връща 503 без конфигурирана база", async () => {
    vi.stubEnv("DATABASE_URL", "");

    const response = await GET();

    expect(response.status).toBe(503);
    expect(checkDatabaseReadiness).not.toHaveBeenCalled();
  });

  it("проверява и вътрешния game-server, когато е конфигуриран", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/werewolf");
    vi.stubEnv("GAME_SERVER_HTTP_URL", "http://game:2567");
    checkDatabaseReadiness.mockResolvedValueOnce(true);
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://game:2567/health/ready"),
      expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
    );
  });

  it("връща 503, когато вътрешният game-server не е готов", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/werewolf");
    vi.stubEnv("GAME_SERVER_HTTP_URL", "http://game:2567");
    checkDatabaseReadiness.mockResolvedValueOnce(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })));

    const response = await GET();

    expect(response.status).toBe(503);
  });

  it("връща 503, когато Redis не е готов за web rate limits", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/werewolf");
    checkDatabaseReadiness.mockResolvedValueOnce(true);
    checkRuntimeRedisReadiness.mockResolvedValueOnce(false);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(checkRuntimeRedisReadiness).toHaveBeenCalledOnce();
  });

  it("изисква вътрешен game-server URL в production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://localhost/werewolf");
    vi.stubEnv("GAME_SERVER_HTTP_URL", "");
    checkDatabaseReadiness.mockResolvedValueOnce(true);

    const response = await GET();

    expect(response.status).toBe(503);
  });

  it("връща 503 без да издава driver грешката", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/werewolf");
    checkDatabaseReadiness.mockRejectedValueOnce(new Error("private connection details"));

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain("private connection details");
  });

  it("връща generic 503 и при синхронен configuration failure", async () => {
    vi.stubEnv("DATABASE_URL", "invalid-dsn");
    createDatabase.mockImplementationOnce(() => {
      throw new Error("private DSN details");
    });

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain("private DSN details");
  });
});
