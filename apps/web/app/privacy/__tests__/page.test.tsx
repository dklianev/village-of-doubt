import type { ComponentProps } from "react";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PrivacyPage from "../page";
import type { PrivacyDashboard } from "@/components/privacy/PrivacyDashboard";

type DashboardProps = ComponentProps<typeof PrivacyDashboard>;
const mocks = vi.hoisted(() => ({
  dashboard: vi.fn((_props: DashboardProps) => null),
  headers: vi.fn(), getSession: vi.fn(), listUserAccounts: vi.fn(), createDatabase: vi.fn(),
  getPlayerGameStatistics: vi.fn(), getAchievementsForUser: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession, listUserAccounts: mocks.listUserAccounts } } }));
vi.mock("@/components/privacy/PrivacyDashboard", () => ({ PrivacyDashboard: mocks.dashboard }));
vi.mock("@werewolf/database", () => ({
  createDatabase: mocks.createDatabase,
  getPlayerGameStatistics: mocks.getPlayerGameStatistics,
  getAchievementsForUser: mocks.getAchievementsForUser,
}));

const db = { fixture: true };
const requestHeaders = new Headers();
const user = {
  id: "synthetic-player", name: "Тестов играч", email: "synthetic@example.test",
  createdAt: "2026-01-01T00:00:00.000Z", emailVerified: true,
};

async function snapshot() {
  render(await PrivacyPage({}));
  return mocks.dashboard.mock.calls.at(-1)![0].userSnapshot;
}

describe("privacy page snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://synthetic.invalid/privacy-page-mock");
    mocks.headers.mockResolvedValue(requestHeaders);
    mocks.getSession.mockResolvedValue({ user });
    mocks.listUserAccounts.mockResolvedValue([{ providerId: "google" }]);
    mocks.createDatabase.mockReturnValue(db);
    mocks.getPlayerGameStatistics.mockResolvedValue({ totalGames: 0 });
    mocks.getAchievementsForUser.mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses uncapped completed-participation statistics and serializes only the count", async () => {
    mocks.getPlayerGameStatistics.mockResolvedValue({
      totalGames: 537, totalWins: 300, longestStreak: 5,
      winsByRole: [{ role: "synthetic-private-role", wins: 300 }],
    });
    mocks.getAchievementsForUser.mockResolvedValue([{ id: "synthetic-achievement" }]);
    const result = await snapshot();
    expect(mocks.getPlayerGameStatistics).toHaveBeenCalledWith(db, user.id);
    expect(result).toMatchObject({ totalGames: 537, totalAchievements: 1 });
    expect(result).not.toHaveProperty("userId");
    expect(JSON.stringify(result)).not.toContain("synthetic-private-role");
    expect(JSON.stringify(result)).not.toContain("synthetic-achievement");
  });

  it("distinguishes a successfully empty result from unavailable data", async () => {
    expect(await snapshot()).toMatchObject({ totalGames: 0, totalAchievements: 0 });
  });

  it.each(["getPlayerGameStatistics", "getAchievementsForUser"] as const)(
    "preserves independent results when %s fails", async (query) => {
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      mocks.getPlayerGameStatistics.mockResolvedValue({ totalGames: 537 });
      mocks.getAchievementsForUser.mockResolvedValue([{ id: "synthetic-achievement" }]);
      mocks[query].mockRejectedValue(new Error("synthetic-private-database-error"));
      const result = await snapshot();
      expect(result).toMatchObject({
        totalGames: query === "getPlayerGameStatistics" ? null : 537,
        totalAchievements: query === "getAchievementsForUser" ? null : 1,
      });
      expect(JSON.stringify([result, log.mock.calls])).not.toContain("synthetic-private-database-error");
    },
  );

  it("keeps counts unavailable when there is no database configuration", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(await snapshot()).toMatchObject({ totalGames: null, totalAchievements: null, providersUsed: 1 });
    expect(mocks.createDatabase).not.toHaveBeenCalled();
    expect(mocks.getPlayerGameStatistics).not.toHaveBeenCalled();
  });

  it("keeps counts unavailable when database initialization fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createDatabase.mockImplementationOnce(() => { throw new Error("synthetic-connection-error"); });
    expect(await snapshot()).toMatchObject({ totalGames: null, totalAchievements: null });
  });

  it.each([
    [["google"], 1], [["discord"], 1], [["google", "credential", "google"], 2], [[], 0],
  ] as const)("counts only actual linked providers %j", async (providers, expected) => {
    mocks.listUserAccounts.mockResolvedValue(providers.map((providerId) => ({
      providerId, accessToken: "synthetic-private-token", accountId: "synthetic-private-account",
    })));
    const result = await snapshot();
    expect(result?.providersUsed).toBe(expected);
    expect(mocks.listUserAccounts).toHaveBeenCalledWith({ headers: requestHeaders });
    expect(JSON.stringify(result)).not.toContain("synthetic-private");
  });

  it("does not invent a provider count when the account lookup fails", async () => {
    mocks.listUserAccounts.mockRejectedValue(new Error("synthetic-provider-error"));
    expect((await snapshot())?.providersUsed).toBeNull();
  });

  it.each([null, "invalid-date"])("does not invent a membership date for %s", async (createdAt) => {
    mocks.getSession.mockResolvedValue({ user: { ...user, createdAt } });
    expect((await snapshot())?.memberSince).toBeNull();
  });

  it("does not fetch private data without a session, including a production fixture parameter", async () => {
    mocks.getSession.mockResolvedValue(null);
    render(await PrivacyPage({ searchParams: Promise.resolve({ visualAuth: "1" }) }));
    expect(mocks.dashboard.mock.calls.at(-1)![0].userSnapshot).toBeNull();
    expect(mocks.listUserAccounts).not.toHaveBeenCalled();
    expect(mocks.createDatabase).not.toHaveBeenCalled();
  });

  it("keeps the public policy available when session lookup fails", async () => {
    mocks.getSession.mockRejectedValue(new Error("synthetic-session-error"));
    expect(await snapshot()).toBeNull();
    expect(mocks.listUserAccounts).not.toHaveBeenCalled();
  });
});
