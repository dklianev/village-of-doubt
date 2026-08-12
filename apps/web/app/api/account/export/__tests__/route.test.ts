import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const mocks = vi.hoisted(() => ({
  createDatabase: vi.fn(),
  gameEventsFindMany: vi.fn(),
  gamePlayersFindMany: vi.fn(),
  gamesFindMany: vi.fn(),
  getAchievementsForUser: vi.fn(),
  getAccountExportPage: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@werewolf/database", () => ({
  ACCOUNT_EXPORT_DEFAULT_EVENT_PAGE_SIZE: 500,
  ACCOUNT_EXPORT_DEFAULT_PAGE_SIZE: 50,
  ACCOUNT_EXPORT_MAX_EVENT_PAGE_SIZE: 1_000,
  ACCOUNT_EXPORT_MAX_PAGE: 1_000,
  ACCOUNT_EXPORT_MAX_PAGE_SIZE: 100,
  createDatabase: mocks.createDatabase,
  getAccountExportPage: mocks.getAccountExportPage,
  getAchievementsForUser: mocks.getAchievementsForUser,
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

describe("GET /api/account/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DATABASE_URL", "postgres://example.test/werewolf");
    mocks.createDatabase.mockReturnValue({
      query: {
        gameEvents: { findMany: mocks.gameEventsFindMany },
        gamePlayers: { findMany: mocks.gamePlayersFindMany },
        games: { findMany: mocks.gamesFindMany },
      },
    });
    mocks.getAchievementsForUser.mockResolvedValue([]);
    mocks.gamePlayersFindMany.mockResolvedValue([]);
    mocks.gamesFindMany.mockResolvedValue([]);
    mocks.gameEventsFindMany.mockResolvedValue([]);
    mocks.getAccountExportPage.mockResolvedValue({
      games: [],
      page: 1,
      pageSize: 50,
      hasMore: false,
      eventPage: 1,
      eventPageSize: 500,
      eventsHasMore: false,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("отказва export без активна сесия", async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.createDatabase).not.toHaveBeenCalled();
  });

  it("връща bounded страница без foreign hostId и забранява cache", async () => {
    mocks.getSession.mockResolvedValue(signedInSession());
    mocks.getAccountExportPage.mockResolvedValue({
      games: [{
        id: "game-1",
        code: "ROOM1",
        hostId: "foreign-host",
        isHost: false,
        config: { mode: "werewolves_classic" },
        status: "ended",
        winnerTeam: "village",
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
        endedAt: new Date("2026-01-01T01:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        player: { displayName: "Анна", role: "seer" },
        events: [eventRow({ id: "public-1", gameId: "game-1" })],
        eventCount: 1,
      }],
      page: 2,
      pageSize: 25,
      hasMore: true,
      eventPage: 3,
      eventPageSize: 200,
      eventsHasMore: true,
    });

    const response = await GET(new Request(
      "http://localhost/api/account/export?page=2&pageSize=25&eventPage=3&eventPageSize=200",
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.games).toHaveLength(1);
    expect(body.games[0]).toMatchObject({ id: "game-1", isHost: false, eventCount: 1 });
    expect(body.games[0]).not.toHaveProperty("hostId");
    expect(JSON.stringify(body)).not.toContain("foreign-host");
    expect(body.pagination).toEqual({
      page: 2,
      pageSize: 25,
      hasMore: true,
      eventPage: 3,
      eventPageSize: 200,
      eventsHasMore: true,
    });
    expect(body.note).toContain("твоите лични действия");
    expect(body.note).toContain("чужди лични действия");
    expect(mocks.getAccountExportPage).toHaveBeenCalledWith(
      { query: expect.any(Object) },
      "user-1",
      { page: 2, pageSize: 25, eventPage: 3, eventPageSize: 200 },
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain("werewolf-mafia-export-user-1-");
  });

  it("отказва небезопасни pagination параметри преди database query", async () => {
    mocks.getSession.mockResolvedValue(signedInSession());

    const response = await GET(new Request("http://localhost/api/account/export?page=0&pageSize=1000"));

    expect(response.status).toBe(400);
    expect(mocks.createDatabase).not.toHaveBeenCalled();
    expect(mocks.getAccountExportPage).not.toHaveBeenCalled();
  });

  it("отказва export над byte лимита и предлага по-малка страница", async () => {
    mocks.getSession.mockResolvedValue(signedInSession());
    mocks.getAccountExportPage.mockResolvedValue({
      games: [{
        id: "game-1",
        code: "X".repeat(6 * 1024 * 1024),
        isHost: true,
        config: {},
        status: "ended",
        winnerTeam: null,
        startedAt: null,
        endedAt: null,
        createdAt: new Date(),
        player: null,
        events: [],
        eventCount: 0,
      }],
      page: 1,
      pageSize: 50,
      hasMore: false,
      eventPage: 1,
      eventPageSize: 500,
      eventsHasMore: false,
    });

    const response = await GET(new Request("http://localhost/api/account/export"));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "Експортът е твърде голям. Опитай с по-малък размер на страницата.",
    });
  });

  it("ограничава многократните тежки експорти за един профил", async () => {
    mocks.getSession.mockResolvedValue({
      ...signedInSession(),
      user: { ...signedInSession().user, id: "export-rate-user" },
    });

    for (let index = 0; index < 4; index += 1) {
      const response = await GET(exportRequest(`198.51.100.${index + 1}`));
      expect(response.status).toBe(200);
    }

    const blocked = await GET(exportRequest("198.51.100.99"));

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    await expect(blocked.json()).resolves.toEqual({
      error: "Твърде много заявки за експорт. Опитай отново след малко.",
    });
  });
});

function exportRequest(ip: string) {
  return new Request("http://localhost/api/account/export", {
    headers: { "x-forwarded-for": ip },
  });
}

function signedInSession() {
  return {
    user: {
      id: "user-1",
      email: "anna@example.com",
      name: "Анна",
      image: null,
      emailVerified: true,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    },
  };
}

function eventRow(overrides: Record<string, unknown>) {
  return {
    id: "event-1",
    gameId: "game-1",
    round: 1,
    phase: "night",
    type: "night_action_submitted",
    actorId: null,
    targetId: null,
    visibility: "public",
    payload: {},
    createdAt: new Date("2026-01-01T00:30:00.000Z"),
    ...overrides,
  };
}
