import type { Metadata } from "next";
import type { ComponentProps } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  createDatabase,
  getAchievementsForUser,
  getGameHistoryForUser,
  getPlayerRolesInGames,
} from "@werewolf/database";
import { ACHIEVEMENTS, type GameMode, type WinnerTeam } from "@werewolf/shared";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import { ResourceHints } from "@/components/resource-hints";
import { computePlayerStats } from "@/lib/account-stats";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Твоето досие | Върколак и Мафия",
  description: "Профил, статистики, постижения и контрол на твоите данни.",
  robots: { index: false, follow: false },
};

type AccountHistoryGame = Awaited<ReturnType<typeof getGameHistoryForUser>>[number] & {
  playerRole: string | null;
};

type AccountDashboardProps = ComponentProps<typeof AccountDashboard>;

export default async function AccountPage() {
  if (process.env.NODE_ENV !== "production" && process.env.ACCOUNT_DASHBOARD_FIXTURE === "1") {
    return renderDashboard(fixtureDashboardProps());
  }

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    redirect("/sign-in?redirect=/account");
  }

  const accounts = await auth.api.listUserAccounts({ headers: requestHeaders }).catch(() => []);
  const providerIds = new Set(accounts.map((account) => account.providerId));
  if (session.user.email) {
    providerIds.add("credential");
  }

  let games: AccountHistoryGame[] = [];
  let achievements: Awaited<ReturnType<typeof getAchievementsForUser>> = [];
  const memberSince = parseMemberSince(session.user.createdAt);

  if (process.env.DATABASE_URL) {
    try {
      const db = createDatabase(process.env.DATABASE_URL);
      const historyRows = await getGameHistoryForUser(db, session.user.id, 50);
      achievements = await getAchievementsForUser(db, session.user.id);

      const gameIds = historyRows.map((game) => game.id);
      const rolesByGameId = await getPlayerRolesInGames(db, session.user.id, gameIds);
      games = historyRows.map((game) => ({
        ...game,
        playerRole: rolesByGameId.get(game.id) ?? null,
      }));
    } catch (error) {
      console.error("[account]", error);
    }
  }

  const endedGames = games.filter((game) => game.status === "ended");
  const stats = computePlayerStats(
    endedGames.map((game) => ({ game, role: game.playerRole })),
    memberSince,
  );

  return renderDashboard({
    userId: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    image: session.user.image ?? null,
    emailVerified: session.user.emailVerified ?? false,
    providers: [...providerIds],
    stats,
    recentGames: endedGames.slice(0, 3).map((game) => ({
      id: game.id,
      code: game.code,
      mode: modeFromConfig(game.config),
      winnerTeam: winnerTeamFromValue(game.winnerTeam),
      endedAt: game.endedAt,
    })),
    unlockedAchievementIds: achievements.map((achievement) => achievement.achievementId),
    totalAchievementCount: ACHIEVEMENTS.length,
  });
}

function renderDashboard(props: AccountDashboardProps) {
  return (
    <main className="shell account-shell">
      <ResourceHints images={["/game-art/account/account-hero-banner.webp"]} />
      <AccountDashboard {...props} />
    </main>
  );
}

function fixtureDashboardProps(): AccountDashboardProps {
  return {
    userId: "visual-account-user",
    email: "visual@example.com",
    name: "Визуален играч",
    image: null,
    emailVerified: true,
    providers: ["credential", "google", "discord"],
    stats: {
      totalGames: 8,
      totalWins: 5,
      winRate: 63,
      villageWins: 3,
      threatWins: 2,
      longestStreak: 3,
      memberSince: new Date("2026-03-10T10:00:00.000Z"),
    },
    recentGames: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        code: "4821",
        mode: "werewolves_classic",
        winnerTeam: "village",
        endedAt: new Date("2026-05-14T21:30:00.000Z"),
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        code: "7314",
        mode: "mafia_free",
        winnerTeam: "mafia",
        endedAt: new Date("2026-05-12T20:10:00.000Z"),
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        code: "2097",
        mode: "mafia_sport",
        winnerTeam: "draw",
        endedAt: new Date("2026-05-10T18:45:00.000Z"),
      },
    ],
    unlockedAchievementIds: ["first_blood", "guardian_save", "perfect_record"],
    totalAchievementCount: ACHIEVEMENTS.length,
  };
}

function parseMemberSince(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function modeFromConfig(config: unknown): GameMode {
  if (config && typeof config === "object" && "mode" in config) {
    const mode = (config as { mode?: unknown }).mode;
    if (mode === "werewolves_classic" || mode === "mafia_sport" || mode === "mafia_free") {
      return mode;
    }
  }

  return "werewolves_classic";
}

function winnerTeamFromValue(value: string | null): WinnerTeam | null {
  if (
    value === "village" ||
    value === "werewolves" ||
    value === "vampires" ||
    value === "mafia" ||
    value === "maniac" ||
    value === "lovers" ||
    value === "draw"
  ) {
    return value;
  }

  return null;
}
