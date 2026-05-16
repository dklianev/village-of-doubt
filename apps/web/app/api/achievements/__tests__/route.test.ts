import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@werewolf/database", () => ({
  createDatabase: vi.fn(() => ({ mocked: true })),
  getAchievementsForUser: vi.fn(),
}));

describe("GET /api/achievements", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    vi.clearAllMocks();
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it("отказва без сесия", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Не си влязъл." });
  });

  it("връща празен списък при липсваща база, но само със сесия", async () => {
    delete process.env.DATABASE_URL;
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof auth.api.getSession>>);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ achievements: [] });
  });

  it("зарежда постижения за потребителя от сесията", async () => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/werewolf";
    const { auth } = await import("@/lib/auth");
    const { getAchievementsForUser } = await import("@werewolf/database");
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as Awaited<ReturnType<typeof auth.api.getSession>>);
    vi.mocked(getAchievementsForUser).mockResolvedValue([
      {
        achievementId: "first_blood",
        gameId: "game-1",
        unlockedAt: new Date("2026-05-15T10:00:00.000Z"),
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(getAchievementsForUser).toHaveBeenCalledWith({ mocked: true }, "user-1");
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

  it("игнорира userId в URL и използва само сесията", async () => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/werewolf";
    const { auth } = await import("@/lib/auth");
    const { getAchievementsForUser } = await import("@werewolf/database");
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "owner-user" },
    } as Awaited<ReturnType<typeof auth.api.getSession>>);
    vi.mocked(getAchievementsForUser).mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(getAchievementsForUser).toHaveBeenCalledWith({ mocked: true }, "owner-user");
  });
});
