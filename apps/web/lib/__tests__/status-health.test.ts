import { afterEach, describe, expect, it, vi } from "vitest";

const { checkDatabaseReadiness, createDatabase } = vi.hoisted(() => ({
  checkDatabaseReadiness: vi.fn(),
  createDatabase: vi.fn(() => ({ mocked: true })),
}));

const { checkRuntimeRedisReadiness } = vi.hoisted(() => ({
  checkRuntimeRedisReadiness: vi.fn(),
}));

vi.mock("@werewolf/database", () => ({
  checkDatabaseReadiness,
  createDatabase,
}));

vi.mock("../runtime-rate-limit", () => ({
  checkRuntimeRedisReadiness,
}));

import {
  loadStatusServices,
  loadStatusSnapshot,
  resetStatusHealthCacheForTests,
} from "../status-health";

describe("loadStatusServices", () => {
  afterEach(() => {
    resetStatusHealthCacheForTests();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("отбелязва базата и game server-а като недостъпни при провалени readiness probes", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/werewolf");
    vi.stubEnv("NEXT_PUBLIC_GAME_SERVER_URL", "ws://game.example.test");
    vi.stubEnv("REDIS_URL", "redis://redis:6379");
    checkDatabaseReadiness.mockResolvedValueOnce(false);
    checkRuntimeRedisReadiness.mockResolvedValueOnce(false);
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const services = await loadStatusServices();

    expect(services.find((service) => service.id === "database")?.status).toBe("down");
    expect(services.find((service) => service.id === "game-server")?.status).toBe("down");
    expect(services.find((service) => service.id === "redis")?.status).toBe("down");
    expect(createDatabase).toHaveBeenCalledWith("postgres://localhost/werewolf");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://game.example.test/health/ready",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("обединява едновременни probes и връща точния момент на проверката", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/werewolf");
    vi.stubEnv("NEXT_PUBLIC_GAME_SERVER_URL", "ws://game.example.test");
    vi.stubEnv("REDIS_URL", "redis://redis:6379");
    checkDatabaseReadiness.mockResolvedValue(true);
    checkRuntimeRedisReadiness.mockResolvedValue(true);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      loadStatusSnapshot(),
      loadStatusSnapshot(),
    ]);

    expect(first.lastCheckedAt).toBe(second.lastCheckedAt);
    expect(checkDatabaseReadiness).toHaveBeenCalledOnce();
    expect(checkRuntimeRedisReadiness).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(first.services.find((service) => service.id === "redis")?.status).toBe("ok");
  });

  it("връща защитно копие от краткия status cache", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/werewolf");
    checkDatabaseReadiness.mockResolvedValue(true);

    const first = await loadStatusSnapshot();
    first.services[0]!.name = "Променено";
    const second = await loadStatusSnapshot();

    expect(second.services[0]?.name).toBe("Уеб приложение");
    expect(checkDatabaseReadiness).toHaveBeenCalledOnce();
  });
});
