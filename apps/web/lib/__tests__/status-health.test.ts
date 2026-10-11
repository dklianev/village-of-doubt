import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  beforeEach(() => {
    for (const name of ["DATABASE_URL", "NEXT_PUBLIC_GAME_SERVER_URL", "REDIS_URL", "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET", "DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "RESEND_API_KEY", "STATUS_HEALTH_FIXTURE"]) {
      vi.stubEnv(name, "");
    }
  });

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

  it("описва външните доставчици като конфигурирани, без да твърди че са probe-нати", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "synthetic-google-secret");
    vi.stubEnv("DISCORD_CLIENT_ID", "discord-client");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "synthetic-discord-secret");
    vi.stubEnv("RESEND_API_KEY", "resend-key");

    const services = await loadStatusServices();

    expect(services.find((service) => service.id === "auth-google")).toMatchObject({
      status: "unknown", detail: "Конфигуриран; входът не се проверява автоматично.",
    });
    expect(services.find((service) => service.id === "auth-discord")).toMatchObject({
      status: "unknown", detail: "Конфигуриран; входът не се проверява автоматично.",
    });
    expect(services.find((service) => service.id === "email")).toMatchObject({
      status: "unknown", detail: "Конфигурирана; доставката на имейли не се проверява автоматично.",
    });
    expect(JSON.stringify(services)).not.toMatch(/google-client|discord-client|synthetic-.*-secret|resend-key/);
  });

  it("does not describe partially configured OAuth as ready", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "synthetic-google-client");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "synthetic-discord-secret");

    const services = await loadStatusServices();

    for (const id of ["auth-google", "auth-discord"]) {
      expect(services.find((service) => service.id === id)).toMatchObject({
        status: "unknown", detail: "Не е конфигуриран напълно.",
      });
    }
  });

  it("keeps dependency addresses and failed probe details private", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://synthetic:secret@private-db.test/werewolf");
    vi.stubEnv("NEXT_PUBLIC_GAME_SERVER_URL", "wss://private-game.test");
    vi.stubEnv("REDIS_URL", "redis://private-redis.test:6379");
    checkDatabaseReadiness.mockRejectedValueOnce(new Error("private-db.test synthetic secret"));
    checkRuntimeRedisReadiness.mockResolvedValueOnce(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("private-game.test failed")));

    expect(JSON.stringify(await loadStatusSnapshot())).not.toMatch(/private-|postgres:|redis:|secret|https?:|wss?:/);
  });

  it("ползва детерминистичен healthy fixture извън production без реални probes", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("STATUS_HEALTH_FIXTURE", "healthy");
    vi.stubEnv("DATABASE_URL", "postgres://localhost/werewolf");
    vi.stubEnv("NEXT_PUBLIC_GAME_SERVER_URL", "ws://game.example.test");
    vi.stubEnv("REDIS_URL", "redis://redis:6379");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await loadStatusSnapshot();

    expect(snapshot.lastCheckedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(snapshot.services.slice(0, 4).map((service) => service.status)).toEqual([
      "ok",
      "ok",
      "ok",
      "ok",
    ]);
    expect(checkDatabaseReadiness).not.toHaveBeenCalled();
    expect(checkRuntimeRedisReadiness).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("игнорира visual health fixture в production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STATUS_HEALTH_FIXTURE", "healthy");

    const snapshot = await loadStatusSnapshot();

    expect(snapshot.lastCheckedAt).not.toBe("2026-01-01T00:00:00.000Z");
    expect(snapshot.services.find((service) => service.id === "database")?.status).toBe("unknown");
  });
});
