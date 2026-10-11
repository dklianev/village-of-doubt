import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeaderboardPage, { metadata } from "./page";

const mocks = vi.hoisted(() => ({ createDatabase: vi.fn(), getLeaderboardRows: vi.fn(), cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("@werewolf/database", () => ({ createDatabase: mocks.createDatabase, getLeaderboardRows: mocks.getLeaderboardRows }));
vi.mock("next/cache", () => ({ cacheTag: mocks.cacheTag, cacheLife: mocks.cacheLife }));

async function route(visualLeaderboard?: string) {
  const page = LeaderboardPage({ searchParams: Promise.resolve(visualLeaderboard ? { visualLeaderboard } : {}) });
  const routeContent = page.props.children[1].props.children;
  const content = await routeContent.type(routeContent.props);
  return content.type(content.props);
}

describe("leaderboard route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://synthetic.invalid/leaderboard-mock");
    mocks.createDatabase.mockReturnValue({ fixture: true });
    mocks.getLeaderboardRows.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("queries a rolling seven-day public aggregate capped at 30 and carries its snapshot time", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-09-17T19:00:00Z");
    vi.setSystemTime(now);
    mocks.getLeaderboardRows.mockResolvedValue([{ userId: "synthetic-player", displayName: "Мила", wins: 2, gamesPlayed: 3, lastPlayedAt: now }]);
    const node = await route();
    expect(mocks.getLeaderboardRows).toHaveBeenCalledWith({ fixture: true }, 30, { since: new Date("2026-09-10T19:00:00Z") });
    expect(node.props.asOf).toEqual(now);
    expect(node.props.entries).toEqual([{ id: "synthetic-player", displayName: "Мила", wins: 2, games: 3, lastPlayed: now }]);
    expect(node.props).not.toHaveProperty("issueCount");
  });

  it("shows empty only after a successful empty query", async () => {
    render(await route());
    expect(screen.getByRole("heading", { name: "Още няма класирани играчи" })).toBeInTheDocument();
  });

  it("keeps query failures distinct and does not expose database errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getLeaderboardRows.mockRejectedValue(new Error("synthetic-private-database-error"));
    render(await route());
    expect(screen.getByRole("alert")).toHaveTextContent("Класацията временно е недостъпна");
    expect(document.body.textContent).not.toContain("synthetic-private-database-error");
    expect(screen.getByRole("link", { name: "Опитай отново" })).toHaveAttribute("href", "/leaderboard");
  });

  it("reports an unconfigured database as unavailable, not zero results", async () => {
    vi.stubEnv("DATABASE_URL", "");
    render(await route());
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(mocks.getLeaderboardRows).not.toHaveBeenCalled();
  });

  it.each(["fixture", "fixture-single", "fixture-three", "fixture-full", "empty", "unavailable"])("ignores %s and environment fixtures in production", async (fixture) => {
    vi.stubEnv("LEADERBOARD_NEWSPAPER_FIXTURE", "filled");
    await route(fixture);
    expect(mocks.getLeaderboardRows).toHaveBeenCalledOnce();
  });

  it("describes profile names and the actual window instead of promising anonymity", () => {
    expect(metadata.description).toContain("Профилни имена");
    expect(metadata.description).toContain("последните 7 дни");
    expect(JSON.stringify(metadata)).not.toMatch(/аноним/i);
  });
});
