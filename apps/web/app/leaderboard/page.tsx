import type { Metadata } from "next";
import { Suspense } from "react";
import { createDatabase, getLeaderboardRows } from "@werewolf/database";
import { getRoleTeam, ROLE_DEFINITIONS, type RoleCode } from "@werewolf/shared";
import { NewspaperEmpty } from "@/components/leaderboard/NewspaperEmpty";
import { NewspaperPage } from "@/components/leaderboard/NewspaperPage";
import { LeaderboardSkeleton } from "@/components/skeleton";
import type { LeaderboardEntry } from "@/lib/leaderboard-headlines";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Класация | Върколак и Мафия",
  description: "Анонимна класация от завършени игри: участия, победи и последна активност.",
};

export default function LeaderboardPage() {
  return (
    <main className="shell newspaper-shell">
      <Suspense fallback={<LeaderboardSkeleton />}>
        <LeaderboardContent />
      </Suspense>
    </main>
  );
}

async function LeaderboardContent() {
  const { entries, issueCount } = await loadLeaderboard();

  if (entries.length === 0) {
    return <NewspaperEmpty />;
  }

  return <NewspaperPage entries={entries} issueCount={issueCount} />;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  issueCount: number;
}

async function loadLeaderboard(): Promise<LeaderboardData> {
  if (process.env.NODE_ENV !== "production") {
    if (process.env.LEADERBOARD_NEWSPAPER_FIXTURE === "empty") {
      return { entries: [], issueCount: 1 };
    }
    if (process.env.LEADERBOARD_NEWSPAPER_FIXTURE === "filled") {
      return { entries: fixtureLeaderboard(), issueCount: 18 };
    }
  }

  if (!process.env.DATABASE_URL) {
    return { entries: [], issueCount: 1 };
  }

  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const rows = await getLeaderboardRows(db);
    const issueCount = new Set(rows.map((row) => row.gameId)).size;
    const byName = new Map<string, LeaderboardEntry>();
    for (const row of rows) {
      const current = byName.get(row.displayName) ?? {
        displayName: row.displayName,
        games: 0,
        wins: 0,
        lastPlayed: row.endedAt,
      };
      current.games += 1;
      current.wins += didRoleWin(row.role, row.winnerTeam) ? 1 : 0;
      current.lastPlayed = latestDate(current.lastPlayed, row.endedAt);
      byName.set(row.displayName, current);
    }

    const entries = [...byName.values()].sort((left, right) => right.wins - left.wins || right.games - left.games).slice(0, 30);
    return { entries, issueCount: Math.max(1, issueCount) };
  } catch (error) {
    console.error("[leaderboard]", error);
    return { entries: [], issueCount: 1 };
  }
}

function didRoleWin(role: string, winnerTeam: string | null) {
  if (!winnerTeam) {
    return false;
  }
  if (winnerTeam === "maniac") {
    return role === "maniac";
  }
  if (winnerTeam === "lovers") {
    return false;
  }
  if (!(role in ROLE_DEFINITIONS)) {
    return false;
  }
  const team = getRoleTeam(role as RoleCode);
  return team === winnerTeam;
}

function latestDate(left: Date | null, right: Date | null) {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return left > right ? left : right;
}

function fixtureLeaderboard(): LeaderboardEntry[] {
  const day = 24 * 60 * 60 * 1000;
  const today = new Date("2026-05-15T19:00:00.000Z");
  const names = [
    "Мила",
    "Калоян",
    "Ива",
    "Борис",
    "Сияна",
    "Радо",
    "Неда",
    "Тео",
    "Лора",
    "Виктор",
    "Елица",
    "Петър",
    "Дара",
    "Никола",
    "Яна",
    "Сава",
    "Рая",
    "Крис",
  ];
  const scores: Array<[number, number]> = [
    [9, 8],
    [11, 7],
    [8, 5],
    [10, 5],
    [7, 4],
    [9, 4],
    [6, 3],
    [8, 3],
    [6, 2],
    [5, 2],
    [7, 2],
    [4, 1],
    [5, 1],
    [3, 1],
    [6, 1],
    [2, 1],
    [4, 0],
    [3, 0],
  ];

  return names.map((displayName, index) => {
    const [games, wins] = scores[index] ?? [1, 0];
    return {
      displayName,
      games,
      wins,
      lastPlayed: new Date(today.getTime() - index * day),
    };
  });
}
