import type { Metadata } from "next";
import { Suspense } from "react";
import { createDatabase, getLeaderboardRows } from "@werewolf/database";
import { JsonLd } from "@/components/JsonLd";
import { NewspaperEmpty } from "@/components/leaderboard/NewspaperEmpty";
import { NewspaperPage } from "@/components/leaderboard/NewspaperPage";
import { LeaderboardSkeleton } from "@/components/skeleton";
import type { LeaderboardEntry } from "@/lib/leaderboard-headlines";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = routeMetadata({
  title: "Класация — седмичният брой на масата",
  description: "Анонимна класация от завършени игри: участия, победи и последна активност, подредени като стар градски вестник.",
  path: "/leaderboard",
  image: "/game-art/og/og-leaderboard.png",
  imageAlt: "Празен стар вестник, пишеща машина и кафе",
  ogDescription: "Участия, победи и последна активност от завършените игри.",
});

const leaderboardJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Класация",
  description: "Анонимна класация от завършени игри с участия, победи и последна активност.",
  url: absoluteUrl("/leaderboard"),
  inLanguage: "bg-BG",
};

export default function LeaderboardPage() {
  return (
    <main className="shell newspaper-shell">
      <JsonLd data={leaderboardJsonLd} />
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
    const entries = rows.map((row) => ({
      displayName: row.displayName,
      games: row.gamesPlayed,
      wins: row.wins,
      lastPlayed: row.lastPlayedAt,
    }));
    const issueCount = Math.max(1, rows.reduce((sum, row) => sum + row.gamesPlayed, 0));
    return { entries, issueCount: Math.max(1, issueCount) };
  } catch (error) {
    console.error("[leaderboard]", error);
    return { entries: [], issueCount: 1 };
  }
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
