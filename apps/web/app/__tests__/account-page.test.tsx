import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "@/app/account/page";
import type { AccountDashboard } from "@/components/account/AccountDashboard";
import { AccountSections } from "@/components/account/AccountSections";
import { PrivacyRights } from "@/components/privacy/PrivacyRights";
import { resolveWelcomeRedirect } from "@/components/sign-in/welcome-redirect";
import { publicGameReference } from "@/lib/game-reference";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";

type DashboardProps = ComponentProps<typeof AccountDashboard>;
const mocks = vi.hoisted(() => ({
  dashboard: vi.fn((_props: DashboardProps) => null),
  headers: vi.fn(), getSession: vi.fn(), listUserAccounts: vi.fn(), createDatabase: vi.fn(),
  getPlayerGameStatistics: vi.fn(), getRecentCompletedGamesForUser: vi.fn(), getAchievementsForUser: vi.fn(),
  redirect: vi.fn((location: string) => { throw new Error(`redirect:${location}`); }),
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession, listUserAccounts: mocks.listUserAccounts } } }));
vi.mock("@/components/account/AccountDashboard", () => ({ AccountDashboard: mocks.dashboard }));
vi.mock("@werewolf/database", () => ({
  createDatabase: mocks.createDatabase,
  getPlayerGameStatistics: mocks.getPlayerGameStatistics,
  getRecentCompletedGamesForUser: mocks.getRecentCompletedGamesForUser,
  getAchievementsForUser: mocks.getAchievementsForUser,
}));

const emptyStats = { totalGames: 0, totalWins: 0, longestStreak: 0, winsByRole: [] };
const db = { fixture: true };
const requestHeaders = new Headers();
function session(createdAt: unknown = "2026-01-01T00:00:00Z") {
  return { user: {
    id: "synthetic-player", name: "Synthetic Player", email: "synthetic@example.test",
    createdAt, emailVerified: true, avatarId: "portrait-f04",
  } };
}
async function props() {
  render(await AccountPage({}));
  return mocks.dashboard.mock.calls.at(-1)![0];
}

describe("account page data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://synthetic.invalid/account-page-mock");
    vi.stubEnv("ACCOUNT_DASHBOARD_FIXTURE", "0");
    mocks.headers.mockResolvedValue(requestHeaders);
    mocks.getSession.mockResolvedValue(session());
    mocks.listUserAccounts.mockResolvedValue([{ providerId: "google" }]);
    mocks.createDatabase.mockReturnValue(db);
    mocks.getPlayerGameStatistics.mockResolvedValue(emptyStats);
    mocks.getRecentCompletedGamesForUser.mockResolvedValue([]);
    mocks.getAchievementsForUser.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    window.history.replaceState(null, "", "/");
    window.localStorage.removeItem("tutorial-completed");
  });

  it("passes lifetime statistics independently of the three recent games and never sends role aggregates", async () => {
    mocks.getPlayerGameStatistics.mockResolvedValue({
      totalGames: 120, totalWins: 90, longestStreak: 55,
      winsByRole: [{ role: "seer", winnerTeam: "village", wins: 60 }, { role: "werewolf", winnerTeam: "werewolves", wins: 30 }],
    });
    const recent = [1, 2, 3].map((n) => ({
      id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      endedAt: new Date(`2026-07-0${4 - n}T00:00:00Z`), config: { mode: "mafia_free" }, winnerTeam: "mafia",
    }));
    mocks.getRecentCompletedGamesForUser.mockResolvedValue(recent);
    const result = await props();

    expect(mocks.getPlayerGameStatistics).toHaveBeenCalledWith(db, "synthetic-player");
    expect(mocks.getRecentCompletedGamesForUser).toHaveBeenCalledWith(db, "synthetic-player", 3);
    expect(result.stats).toEqual({
      totalGames: 120, totalWins: 90, longestStreak: 55, winRate: 75, villageWins: 60, threatWins: 30,
      memberSince: new Date("2026-01-01T00:00:00Z"),
    });
    expect(result.activityState).toBe("ready");
    expect(result.recentGames).toEqual(recent.map(({ id, endedAt }) => ({
      id, code: publicGameReference(id), endedAt, mode: "mafia_free", winnerTeam: "mafia",
    })));
    expect(result.stats).not.toHaveProperty("winsByRole");
  });

  it.each([
    [["google"], ["google"]],
    [["discord"], ["discord"]],
    [["credential", "google", "credential"], ["credential", "google"]],
    [[], []],
  ])("uses only actual linked providers %j despite a session email", async (linked, expected) => {
    mocks.listUserAccounts.mockResolvedValue(linked.map((providerId) => ({
      providerId, accountId: "synthetic-private-account-id", accessToken: "synthetic-token-not-for-props",
    })));
    const result = await props();
    expect(result.providers).toEqual(expected);
    expect(JSON.stringify(result)).not.toContain("synthetic-private-account-id");
    expect(JSON.stringify(result)).not.toContain("synthetic-token-not-for-props");
    expect(mocks.listUserAccounts).toHaveBeenCalledWith({ headers: requestHeaders });
  });

  it("leaves providers unknown when the lookup fails without inventing credentials or leaking the error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.listUserAccounts.mockRejectedValue(new Error("synthetic-private-provider-error"));
    expect((await props()).providers).toEqual([]);
    expect(log).not.toHaveBeenCalled();
  });

  it("marks zero completed participation as empty", async () => {
    expect(await props()).toMatchObject({ activityState: "empty", stats: { totalGames: 0 }, recentGames: [] });
  });

  it.each(["getPlayerGameStatistics", "getRecentCompletedGamesForUser", "getAchievementsForUser"] as const)(
    "keeps activity unavailable when %s fails, without exposing the database error", async (query) => {
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
      mocks[query].mockRejectedValue(new Error("synthetic-private-database-error"));
      const result = await props();
      expect(result.activityState).toBe("unavailable");
      expect(result.recentGames).toEqual([]);
      expect(JSON.stringify([result, log.mock.calls])).not.toContain("synthetic-private-database-error");
    },
  );

  it("does not query an unconfigured database or portray unavailable statistics as an empty history", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect((await props()).activityState).toBe("unavailable");
    expect(mocks.createDatabase).not.toHaveBeenCalled();
  });

  it.each([null, "invalid-date"])("does not fabricate a membership date for %s", async (createdAt) => {
    mocks.getSession.mockResolvedValue(session(createdAt));
    expect((await props()).stats.memberSince).toBeNull();
  });

  it("requires authentication before account lookups even when production fixture flags are provided", async () => {
    vi.stubEnv("ACCOUNT_DASHBOARD_FIXTURE", "1");
    mocks.getSession.mockResolvedValue(null);
    await expect(AccountPage({ searchParams: Promise.resolve({ visualAuth: "1", visualAccount: "complete" }) }))
      .rejects.toThrow("redirect:/sign-in?redirect=%2Faccount");
    expect(mocks.listUserAccounts).not.toHaveBeenCalled();
    expect(mocks.getPlayerGameStatistics).not.toHaveBeenCalled();
  });

  it.each(["empty", "unavailable", "complete", "long"])("serves only synthetic %s data behind the development fixture gate", async (state) => {
    vi.stubEnv("NODE_ENV", "development");
    render(await AccountPage({ searchParams: Promise.resolve({ visualAuth: "1", visualAccount: state }) }));
    const result = mocks.dashboard.mock.calls.at(-1)![0];
    expect(result.userId).toBe("visual-account-user");
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.createDatabase).not.toHaveBeenCalled();
    if (state === "empty" || state === "unavailable") {
      expect(result.activityState).toBe(state);
      expect(result.unlockedAchievementIds).toEqual([]);
      expect(result.recentGames).toEqual([]);
    } else if (state === "complete") {
      expect(result.unlockedAchievementIds).toHaveLength(result.totalAchievementCount);
    } else {
      expect(result.name).toBe("Александра Константинополска");
    }
  });

  it.each([false, true])("preserves the guest privacy export destination with onboarding completed=%s", async (completed) => {
    if (completed) window.localStorage.setItem("tutorial-completed", "1");
    else window.localStorage.removeItem("tutorial-completed");
    mocks.getSession.mockResolvedValue(null);
    render(<PrivacyRights />);
    const exportLink = screen.getByRole("link", { name: "Изтегли данни →" }) as HTMLAnchorElement;
    const entry = new URL(exportLink.href);
    expect(entry.pathname).toBe("/account");
    expect(entry.hash).toBe("#account-data-export");

    await expect(AccountPage({ searchParams: Promise.resolve({ section: entry.searchParams.get("section")! }) }))
      .rejects.toThrow("redirect:/sign-in?redirect=%2Faccount%23account-data-export");
    const signIn = new URL(mocks.redirect.mock.calls.at(-1)![0], window.location.origin);
    expect(signIn.pathname).toBe("/sign-in");
    expect(signIn.hash).toBe("");
    const destination = safeInternalRedirect(signIn.searchParams.get("redirect"));
    expect(destination).toBe("/account#account-data-export");
    const afterSignIn = resolveWelcomeRedirect(destination);
    const welcome = new URL(afterSignIn, window.location.origin);
    expect(welcome.pathname).toBe(completed ? "/account" : "/tutorial");
    const finalDestination = completed ? afterSignIn : safeInternalRedirect(welcome.searchParams.get("redirect"));
    expect(finalDestination).toBe("/account#account-data-export");
    expect(mocks.listUserAccounts).not.toHaveBeenCalled();
    expect(mocks.createDatabase).not.toHaveBeenCalled();

    window.history.replaceState(null, "", finalDestination);
    render(<AccountSections
      chronicle={<p>Игрова история</p>}
      identity={<p>Образ и достъп</p>}
      security={<section id="account-data-export">Твоите данни</section>}
    />);
    const exportSection = document.getElementById("account-data-export")!;
    const scroll = vi.fn();
    exportSection.scrollIntoView = scroll;
    expect(screen.getByRole("tab", { name: "Данни и сигурност" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toContainElement(exportSection);
    expect(exportSection).toBeVisible();
    await waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "instant" }));
  });

  it.each(["data-export", ["data-export", "https://outside.invalid"]])(
    "canonicalizes authenticated export intent %j without leaving a query that overrides later tab choices",
    async (section) => {
      await expect(AccountPage({ searchParams: Promise.resolve({ section }) }))
        .rejects.toThrow("redirect:/account#account-data-export");
      expect(mocks.listUserAccounts).not.toHaveBeenCalled();
      mocks.redirect.mockClear();
      await props();
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );

  it.each([
    undefined, "", "security", "https://outside.invalid", "//outside.invalid", "/%2foutside.invalid",
    "data-export#account-security", ["unknown", "data-export"], [],
  ])("does not forward an unknown or unsafe account section %j through sign-in", async (section) => {
    mocks.getSession.mockResolvedValue(null);
    await expect(AccountPage({ searchParams: Promise.resolve(section === undefined ? {} : { section }) }))
      .rejects.toThrow("redirect:/sign-in?redirect=%2Faccount");
    expect(mocks.listUserAccounts).not.toHaveBeenCalled();
    expect(mocks.createDatabase).not.toHaveBeenCalled();
  });

  it("does not convert a session lookup failure into an authenticated export redirect", async () => {
    mocks.getSession.mockRejectedValueOnce(new Error("synthetic-session-error"));
    await expect(AccountPage({ searchParams: Promise.resolve({ section: "data-export" }) }))
      .rejects.toThrow("synthetic-session-error");
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.createDatabase).not.toHaveBeenCalled();
  });
});
