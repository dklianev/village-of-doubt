import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createDatabase, getLeaderboardRows } from "@werewolf/database";
import { getRoleTeam, ROLE_DEFINITIONS, type RoleCode } from "@werewolf/shared";
import { LeaderboardSkeleton } from "@/components/skeleton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Класация | Върколак и Мафия",
  description: "Анонимна класация от завършени игри: участия, победи и последна активност.",
};

interface LeaderboardEntry {
  displayName: string;
  games: number;
  wins: number;
  lastPlayed: Date | null;
}

export default function LeaderboardPage() {
  return (
    <main className="shell utility-shell">
      <section className="paper-card utility-hero rounded-[2rem] p-8">
        <p className="section-kicker text-[#842f2b]">класация</p>
        <h1 className="mt-3 text-5xl font-black">Кой оцелява най-често?</h1>
        <p className="mt-4 max-w-3xl text-[#4f3829]">
          Класацията работи с anonymous имената от завършени игри. Няма акаунти, няма профили за следене — само
          вечерната статистика, която групата може да гледа след игра.
        </p>
      </section>

      <section className="paper-card mt-6 rounded-[2rem] p-6">
        <Suspense fallback={<LeaderboardSkeleton />}>
          <LeaderboardContent />
        </Suspense>
      </section>
    </main>
  );
}

async function LeaderboardContent() {
  const entries = await loadLeaderboard();

  if (entries.length === 0) {
    return (
      <div className="empty-state-card utility-empty">
        <span aria-hidden="true" />
        <h2>Първата победа още не е написана</h2>
        <p>
          Когато завърши игра, тук ще се появят участията, победите и процентът на успех за хората около масата.
        </p>
        <Link className="btn btn-primary" href="/">
          Започни игра
        </Link>
      </div>
    );
  }

  return (
    <div className="leaderboard-list">
      {entries.map((entry, index) => (
        <article key={entry.displayName} className="leaderboard-row">
          <span className="leaderboard-rank">{index + 1}</span>
          <div>
            <h2>{entry.displayName}</h2>
            <p>
              {entry.games} игри · {entry.wins} победи · последно: {formatDate(entry.lastPlayed)}
            </p>
          </div>
          <strong>{Math.round((entry.wins / Math.max(1, entry.games)) * 100)}%</strong>
        </article>
      ))}
    </div>
  );
}

async function loadLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const rows = await getLeaderboardRows(db);
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

    return [...byName.values()].sort((left, right) => right.wins - left.wins || right.games - left.games).slice(0, 30);
  } catch (error) {
    console.error("[leaderboard]", error);
    return [];
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

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium" }).format(value) : "няма данни";
}
