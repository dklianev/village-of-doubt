import { afterEach, describe, expect, it, vi } from "vitest";

const { checkDatabaseReadiness, createDatabase } = vi.hoisted(() => ({
  checkDatabaseReadiness: vi.fn(),
  createDatabase: vi.fn(() => ({ mocked: true })),
}));

vi.mock("@werewolf/database", () => ({
  checkDatabaseReadiness,
  createDatabase,
}));

import { loadStatusServices } from "../status-health";

describe("loadStatusServices", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("отбелязва базата и game server-а като недостъпни при провалени readiness probes", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/werewolf");
    vi.stubEnv("NEXT_PUBLIC_GAME_SERVER_URL", "ws://game.example.test");
    checkDatabaseReadiness.mockResolvedValueOnce(false);
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const services = await loadStatusServices();

    expect(services.find((service) => service.id === "database")?.status).toBe("down");
    expect(services.find((service) => service.id === "game-server")?.status).toBe("down");
    expect(createDatabase).toHaveBeenCalledWith("postgres://localhost/werewolf");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://game.example.test/health/ready",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
