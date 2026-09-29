import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { Suspense } from "react";
import { createDatabase, getLeaderboardRows } from "@werewolf/database";
import { safeMonitoringErrorMetadata } from "@werewolf/shared";
import { JsonLd } from "@/components/JsonLd";
import { NewspaperEmpty } from "@/components/leaderboard/NewspaperEmpty";
import { NewspaperPage } from "@/components/leaderboard/NewspaperPage";
import { NewspaperUnavailable } from "@/components/leaderboard/NewspaperUnavailable";
import { LeaderboardSkeleton } from "@/components/skeleton";
import type { LeaderboardEntry } from "@/lib/leaderboard-headlines";
import { absoluteUrl, routeMetadata } from "@/lib/seo";
import { fixtureLeaderboard, LEADERBOARD_FIXTURE_AS_OF } from "./leaderboard-fixture";
import "@/components/leaderboard/Leaderboard.module.css";

export const metadata: Metadata = routeMetadata({
  title: "Вечерен брой | Класация",
  description: "Класация по победи от публичните игри през последните 7 дни. Профилни имена, победи, изиграни игри и процент победи.",
  path: "/leaderboard",
  image: "/game-art/og/og-leaderboard.jpg",
  imageAlt: "Вечерен брой на Сенките: печатарска маса, метална единица и пишеща машина",
  ogDescription: "Класация по победи от публичните завършени игри през последните 7 дни.",
});

export const instant = true;

const leaderboardJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Вечерен брой",
  description: "Класация с профилни имена и победи от публичните завършени игри през последните 7 дни.",
  url: absoluteUrl("/leaderboard"),
  inLanguage: "bg-BG",
};

export default function LeaderboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ visualLeaderboard?: string | string[] }>;
}) {
  return (
    <main className="shell newspaper-shell">
      <JsonLd data={leaderboardJsonLd} />
      <Suspense fallback={<LeaderboardSkeleton />}>
        <LeaderboardRouteContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LeaderboardRouteContent({
  searchParams,
}: {
  searchParams: Promise<{ visualLeaderboard?: string | string[] }> | undefined;
}) {
  const visualLeaderboard = firstSearchValue((await searchParams)?.visualLeaderboard);
  return <LeaderboardContent visualLeaderboard={visualLeaderboard} />;
}

async function LeaderboardContent({ visualLeaderboard }: { visualLeaderboard: string | undefined }) {
  const { entries, asOf } = await loadLeaderboard(visualLeaderboard);

  if (entries === null) {
    return <NewspaperUnavailable />;
  }

  if (entries.length === 0) {
    return <NewspaperEmpty />;
  }

  return <NewspaperPage entries={entries} asOf={asOf} />;
}

interface LeaderboardData {
  entries: LeaderboardEntry[] | null;
  asOf?: Date;
}

async function loadLeaderboard(visualLeaderboard?: string): Promise<LeaderboardData> {
  if (process.env.NODE_ENV !== "production") {
    if (visualLeaderboard === "unavailable") {
      return { entries: null };
    }
    if (visualLeaderboard === "empty") {
      return { entries: [] };
    }
    if (["fixture", "fixture-single", "fixture-three", "fixture-full"].includes(visualLeaderboard ?? "")) {
      const count = visualLeaderboard === "fixture-single" ? 1 : visualLeaderboard === "fixture-three" ? 3 : visualLeaderboard === "fixture-full" ? 30 : 18;
      return { entries: fixtureLeaderboard(count), asOf: LEADERBOARD_FIXTURE_AS_OF };
    }
    if (process.env.LEADERBOARD_NEWSPAPER_FIXTURE === "empty") {
      return { entries: [] };
    }
    if (process.env.LEADERBOARD_NEWSPAPER_FIXTURE === "filled") {
      return { entries: fixtureLeaderboard(), asOf: LEADERBOARD_FIXTURE_AS_OF };
    }
  }

  if (!process.env.DATABASE_URL) {
    return { entries: null };
  }

  try {
    const { rows, asOf } = await loadCachedLeaderboard();
    const entries = rows.map((row) => ({
      id: row.userId,
      displayName: row.displayName,
      games: row.gamesPlayed,
      wins: row.wins,
      lastPlayed: row.lastPlayedAt ? new Date(row.lastPlayedAt) : null,
    }));
    return { entries, asOf: new Date(asOf) };
  } catch (error) {
    console.error("[leaderboard]", safeMonitoringErrorMetadata(error));
    return { entries: null };
  }
}

async function loadCachedLeaderboard() {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3_600 });
  cacheTag("public-leaderboard");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Leaderboard database is not configured");

  const asOf = new Date();
  const db = createDatabase(databaseUrl);
  const rows = await getLeaderboardRows(db, 30, {
    since: new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000),
  });
  return {
    asOf: asOf.toISOString(),
    rows: rows.map((row) => ({
      ...row,
      lastPlayedAt: row.lastPlayedAt?.toISOString() ?? null,
    })),
  };
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
