import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AchievementsPage from "../page";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(), createDatabase: vi.fn(), getAchievementsForUser: vi.fn(), getReplayEligibleGameIds: vi.fn(),
}));
vi.mock("@werewolf/database", () => ({
  createDatabase: mocks.createDatabase,
  getAchievementsForUser: mocks.getAchievementsForUser,
  getReplayEligibleGameIds: mocks.getReplayEligibleGameIds,
}));
vi.mock("@/lib/require-session", () => ({ requireSession: mocks.requireSession }));
const gameId = "00000000-0000-4000-8000-000000000001";
const db = { synthetic: true };
const row = { achievementId: "first_blood", gameId, unlockedAt: new Date("2026-06-01T22:30:00Z") };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgres://synthetic.invalid/achievements-mock");
  mocks.requireSession.mockResolvedValue({ user: { id: "synthetic-viewer" } });
  mocks.createDatabase.mockReturnValue(db);
  mocks.getAchievementsForUser.mockResolvedValue([row]);
  mocks.getReplayEligibleGameIds.mockResolvedValue(new Set([gameId]));
});
afterEach(() => vi.unstubAllEnvs());

describe("authenticated achievements data", () => {
  it("loads only the session owner's awards and batches replay eligibility checks without loading roles", async () => {
    const { container } = render(await AchievementsPage({}));
    expect(mocks.requireSession).toHaveBeenCalledWith("/achievements");
    expect(mocks.getAchievementsForUser).toHaveBeenCalledWith(db, "synthetic-viewer");
    expect(mocks.getReplayEligibleGameIds).toHaveBeenCalledWith(db, "synthetic-viewer", [gameId]);
    expect(screen.getByRole("link", { name: /Виж играта:/ })).toHaveAttribute("href", `/history/${gameId}/replay`);
    expect(container.textContent).not.toContain("ordinary_villager");
  });

  it.each(["missing participant", "active", "abandoned", "missing endedAt"])("preserves awards but omits ineligible %s game links", async () => {
    mocks.getAchievementsForUser.mockResolvedValue([{ ...row, achievementId: "jester_win" }]);
    mocks.getReplayEligibleGameIds.mockResolvedValue(new Set());
    render(await AchievementsPage({}));
    expect(screen.getByText("Отключено")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Виж играта:/ })).toBeNull();
    expect(screen.getByText("Записът не е достъпен")).toBeInTheDocument();
  });

  it("deduplicates replay checks and ignores unknown catalog entries and null references", async () => {
    mocks.getAchievementsForUser.mockResolvedValue([
      row, { ...row, achievementId: "jester_win" },
      { ...row, achievementId: "guardian_save", gameId: null },
      { ...row, achievementId: "retired-achievement", gameId: "00000000-0000-4000-8000-000000000009" },
    ]);
    render(await AchievementsPage({}));
    expect(mocks.getReplayEligibleGameIds).toHaveBeenCalledExactlyOnceWith(db, "synthetic-viewer", [gameId]);
    expect(screen.getAllByRole("link", { name: /Виж играта:/ })).toHaveLength(2);
  });

  it("retains the collection if the optional replay eligibility lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getReplayEligibleGameIds.mockRejectedValue(new Error("synthetic lookup failure"));
    render(await AchievementsPage({}));
    expect(screen.getByText("Отключено")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("link", { name: /Виж играта:/ })).toBeNull();
  });

  it("marks database failure unavailable without manufacturing zero progress", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getAchievementsForUser.mockRejectedValue(new Error("synthetic database failure"));
    render(await AchievementsPage({}));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /легенди отключени/ })).toBeNull();
  });

  it("renders a real zero result without checking unrelated games", async () => {
    mocks.getAchievementsForUser.mockResolvedValue([]);
    render(await AchievementsPage({}));
    expect(screen.getByText(/Още нямаш отключена легенда/)).toBeInTheDocument();
    expect(mocks.getReplayEligibleGameIds).not.toHaveBeenCalled();
  });

  it("links only eligible games from a mixed batch, including a completed private participant game", async () => {
    const privateId = "00000000-0000-4000-8000-000000000002";
    const activeId = "00000000-0000-4000-8000-000000000003";
    mocks.getAchievementsForUser.mockResolvedValue([
      row, { ...row, achievementId: "guardian_save", gameId: privateId },
      { ...row, achievementId: "jester_win", gameId: activeId },
    ]);
    mocks.getReplayEligibleGameIds.mockResolvedValue(new Set([gameId, privateId]));
    render(await AchievementsPage({}));
    expect(mocks.getReplayEligibleGameIds).toHaveBeenCalledExactlyOnceWith(db, "synthetic-viewer", [gameId, privateId, activeId]);
    expect(screen.getAllByRole("link", { name: /Виж играта:/ }).map((link) => link.getAttribute("href"))).toEqual(
      expect.arrayContaining([`/history/${gameId}/replay`, `/history/${privateId}/replay`]),
    );
    expect(screen.getAllByRole("link", { name: /Виж играта:/ })).toHaveLength(2);
    expect(screen.getAllByText("Отключено")).toHaveLength(3);
  });

  it.each(["fixture", "empty", "unavailable"])("never accepts the %s visual bypass in production", async (fixture) => {
    render(await AchievementsPage({ searchParams: Promise.resolve({ visualAuth: "1", visualAchievements: fixture }) }));
    expect(mocks.requireSession).toHaveBeenCalled();
    expect(mocks.getAchievementsForUser).toHaveBeenCalled();
    expect(screen.getByText("Отключено")).toBeInTheDocument();
  });

  it.each(["fixture", "empty", "unavailable"])("provides an isolated development %s fixture without database access", async (fixture) => {
    vi.stubEnv("NODE_ENV", "development");
    render(await AchievementsPage({ searchParams: Promise.resolve({ visualAuth: "1", visualAchievements: fixture }) }));
    expect(mocks.requireSession).not.toHaveBeenCalled();
    expect(mocks.getAchievementsForUser).not.toHaveBeenCalled();
    if (fixture === "empty") expect(screen.getByText(/Още нямаш отключена легенда/)).toBeInTheDocument();
    if (fixture === "unavailable") expect(screen.getByRole("alert")).toBeInTheDocument();
    if (fixture === "fixture") expect(screen.getAllByRole("link", { name: /Виж играта:/ })).toHaveLength(3);
  });
});
