import { NextRequest } from "next/server";
import { describe, expect, it, vi, afterEach } from "vitest";
import { GET } from "../route";

vi.mock("@werewolf/database", () => ({
  createDatabase: vi.fn(() => ({ mocked: true })),
  getAchievementsForUser: vi.fn(),
}));

describe("GET /api/achievements", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it("returns an empty list when userId is missing", async () => {
    const response = await GET(new NextRequest("http://localhost/api/achievements"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ achievements: [] });
  });

  it("returns an empty list when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;

    const response = await GET(new NextRequest("http://localhost/api/achievements?userId=user-1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ achievements: [] });
  });

  it("serializes achievements for a known user", async () => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/werewolf";
    const { getAchievementsForUser } = await import("@werewolf/database");
    vi.mocked(getAchievementsForUser).mockResolvedValue([
      {
        achievementId: "first_blood",
        gameId: "game-1",
        unlockedAt: new Date("2026-05-15T10:00:00.000Z"),
      },
    ]);

    const response = await GET(new NextRequest("http://localhost/api/achievements?userId=user-1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      achievements: [
        {
          achievementId: "first_blood",
          gameId: "game-1",
          unlockedAt: "2026-05-15T10:00:00.000Z",
        },
      ],
    });
  });
});
