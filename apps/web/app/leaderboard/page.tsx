import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { Suspense } from "react";
import { createDatabase, getLeaderboardRows } from "@werewolf/database";
import { JsonLd } from "@/components/JsonLd";
import { NewspaperEmpty } from "@/components/leaderboard/NewspaperEmpty";
import { NewspaperPage } from "@/components/leaderboard/NewspaperPage";
import { NewspaperUnavailable } from "@/components/leaderboard/NewspaperUnavailable";
import { LeaderboardSkeleton } from "@/components/skeleton";
import type { LeaderboardEntry } from "@/lib/leaderboard-headlines";
import { absoluteUrl, routeMetadata } from "@/lib/seo";
import "@/components/leaderboard/Leaderboard.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = routeMetadata({
  title: "Вечерен брой — седмичният списък на масата",
  description: "Анонимен вечерен брой от завършени игри: участия, победи и последна активност, подредени като стар градски вестник.",
  path: "/leaderboard",
  image: "/game-art/og/og-leaderboard.png",
  imageAlt: "Празен стар вестник, пишеща машина и кафе",
  ogDescription: "Участия, победи и последна активност от завършените игри.",
});

const leaderboardJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Вечерен брой",
  description: "Анонимен вечерен брой от завършени игри с участия, победи и последна активност.",
  url: absoluteUrl("/leaderboard"),
  inLanguage: "bg-BG",
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ visualLeaderboard?: string | string[] }>;
}) {
  const visualLeaderboard = firstSearchValue((await searchParams)?.visualLeaderboard);

  return (
    <main className="shell newspaper-shell">
      <JsonLd data={leaderboardJsonLd} />
      <Suspense fallback={<LeaderboardSkeleton />}>
        <LeaderboardContent visualLeaderboard={visualLeaderboard} />
      </Suspense>
    </main>
  );
}

async function LeaderboardContent({ visualLeaderboard }: { visualLeaderboard: string | undefined }) {
  const { entries, issueCount } = await loadLeaderboard(visualLeaderboard);

  if (entries === null) {
    return <NewspaperUnavailable />;
  }

  if (entries.length === 0) {
    return <NewspaperEmpty />;
  }

  return <NewspaperPage entries={entries} issueCount={issueCount} />;
}

interface LeaderboardData {
  entries: LeaderboardEntry[] | null;
  issueCount: number;
}

async function loadLeaderboard(visualLeaderboard?: string): Promise<LeaderboardData> {
  if (process.env.NODE_ENV !== "production") {
    if (visualLeaderboard === "empty") {
      return { entries: [], issueCount: 1 };
    }
    if (visualLeaderboard === "fixture") {
      return { entries: fixtureLeaderboard(), issueCount: 18 };
    }
    if (process.env.LEADERBOARD_NEWSPAPER_FIXTURE === "empty") {
      return { entries: [], issueCount: 1 };
    }
    if (process.env.LEADERBOARD_NEWSPAPER_FIXTURE === "filled") {
      return { entries: fixtureLeaderboard(), issueCount: 18 };
    }
  }

  if (!process.env.DATABASE_URL) {
    return { entries: null, issueCount: 1 };
  }

  try {
    const rows = await loadCachedLeaderboard();
    const entries = rows.map((row) => ({
      id: row.userId,
      displayName: row.displayName,
      games: row.gamesPlayed,
      wins: row.wins,
      lastPlayed: row.lastPlayedAt ? new Date(row.lastPlayedAt) : null,
    }));
    const issueCount = Math.max(1, rows.reduce((sum, row) => sum + row.gamesPlayed, 0));
    return { entries, issueCount: Math.max(1, issueCount) };
  } catch (error) {
    console.error("[leaderboard]", error);
    return { entries: null, issueCount: 1 };
  }
}

const loadCachedLeaderboard = unstable_cache(
  async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return [];
    }

    const db = createDatabase(databaseUrl);
    const rows = await getLeaderboardRows(db);
    return rows.map((row) => ({
      ...row,
      lastPlayedAt: row.lastPlayedAt?.toISOString() ?? null,
    }));
  },
  ["public-leaderboard-v1"],
  { revalidate: 60, tags: ["public-leaderboard"] },
);

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
      id: `fixture-${index + 1}`,
      displayName,
      games,
      wins,
      lastPlayed: new Date(today.getTime() - index * day),
    };
  });
}
