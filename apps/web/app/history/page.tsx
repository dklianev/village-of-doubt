import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { Suspense } from "react";
import { createDatabase, getPublicGameArchive, getPublicGameTimelinesBatch } from "@werewolf/database";
import { safeMonitoringErrorMetadata, type GameMode } from "@werewolf/shared";
import { JsonLd } from "@/components/JsonLd";
import { ArchiveHeader, ArchiveLoading, EvidenceWall } from "@/components/history/EvidenceWall";
import type { HistoryGameView, HistoryTimelineEventView } from "@/lib/history-highlights";
import { publicGameReference } from "@/lib/game-reference";
import { absoluteUrl, routeMetadata } from "@/lib/seo";
import { ARCHIVE_PAGE_SIZE, firstSearchValue, parseArchiveSelection, type ArchiveSelection } from "@/lib/history-archive";
import styles from "@/components/history/Archive.module.css";

export const metadata: Metadata = routeMetadata({
  title: "История — архивът на масата",
  description: "Завършени игри, победители, смърти, гласове и развръзки от масата. Прегледай как са се развили старите стаи.",
  path: "/history",
  image: "/game-art/og/og-history.png",
  imageAlt: "Детективско табло с празни карти и червена нишка",
  ogDescription: "Победи, смърти, гласове и развръзки от старите стаи.",
  robots: { index: false, follow: false },
});

export const instant = true;

const historyJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "История на игрите",
  description: "Архив от завършени игри, победители, гласове и развръзки.",
  url: absoluteUrl("/history"),
  inLanguage: "bg-BG",
};

type HistoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default function HistoryPage({ searchParams }: HistoryPageProps) {
  return (
    <main className={`shell ${styles.archive}`}>
      <JsonLd data={historyJsonLd} />
      <ArchiveHeader />
      <Suspense fallback={<ArchiveLoading />}>
        <HistoryRouteContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function HistoryRouteContent({
  searchParams,
}: {
  searchParams: HistoryPageProps["searchParams"];
}) {
  const params = await searchParams;
  const selection = parseArchiveSelection(params);
  const visualHistory = process.env.NODE_ENV !== "production" ? firstSearchValue(params?.visualHistory) : undefined;
  const result = await loadHistory(selection, visualHistory);
  return <EvidenceWall {...result} selection={selection} visualHistory={visualHistory} />;
}

type HistoryLoadResult =
  | { status: "ready"; games: HistoryGameView[]; hasOlder: boolean; hasNewer: boolean }
  | { status: "unavailable"; games: [] };

async function loadHistory(selection: ArchiveSelection, visualHistory?: string): Promise<HistoryLoadResult> {
  if (process.env.NODE_ENV !== "production") {
    if (visualHistory === "empty") {
      return { status: "ready", games: [], hasOlder: false, hasNewer: false };
    }
    if (visualHistory === "fixture" || visualHistory === "paginated") {
      return fixtureArchive(selection, visualHistory === "paginated" ? 36 : 8);
    }
    if (visualHistory === "unavailable") {
      return { status: "unavailable", games: [] };
    }
    if (process.env.HISTORY_EVIDENCE_FIXTURE === "empty") {
      return { status: "ready", games: [], hasOlder: false, hasNewer: false };
    }
    if (process.env.HISTORY_EVIDENCE_FIXTURE === "1") {
      return fixtureArchive(selection, 8);
    }
  }

  if (!process.env.DATABASE_URL) {
    return { status: "unavailable", games: [] };
  }

  try {
    return { status: "ready", ...await loadCachedPublicHistory(selection) };
  } catch (error) {
    console.error("[history]", safeMonitoringErrorMetadata(error));
    return { status: "unavailable", games: [] };
  }
}

async function loadCachedPublicHistory(selection: ArchiveSelection): Promise<{ games: HistoryGameView[]; hasOlder: boolean; hasNewer: boolean }> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 3_600 });
  cacheTag("public-game-history");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("History database is unavailable");

  const db = createDatabase(databaseUrl);
  const page = await getPublicGameArchive(db, { ...selection, limit: ARCHIVE_PAGE_SIZE });
  const endedGames = page.games;
  const timelinesMap = await getPublicGameTimelinesBatch(
    db,
    endedGames.map((game) => game.id),
    6,
  );

  const games = endedGames.map((game) => ({
    id: game.id,
    code: publicGameReference(game.id),
    config: game.config,
    status: game.status,
    winnerTeam: game.winnerTeam,
    startedAt: game.startedAt?.toISOString() ?? null,
    endedAt: game.endedAt?.toISOString() ?? null,
    eventCount: game.eventCount,
    mode: modeFromConfig(game.config),
    timeline: (timelinesMap.get(game.id) ?? []).map(serializeTimelineEvent),
  }));
  return { games, hasOlder: page.hasOlder, hasNewer: page.hasNewer };
}

function serializeTimelineEvent(event: {
  id: string;
  round: number;
  phase: string;
  type: string;
  createdAt: Date;
}): HistoryTimelineEventView {
  return {
    id: event.id,
    round: event.round,
    phase: event.phase,
    type: event.type,
    createdAt: event.createdAt.toISOString(),
  };
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

function fixtureHistory(count = 8): HistoryGameView[] {
  const now = new Date("2026-05-15T20:30:00.000Z");
  const winners = ["village", "mafia", "werewolves", "lovers", "vampires", "draw", "maniac", "village"];
  const modes: GameMode[] = [
    "werewolves_classic",
    "mafia_sport",
    "werewolves_classic",
    "mafia_free",
    "werewolves_classic",
    "mafia_sport",
    "mafia_free",
    "werewolves_classic",
  ];

  return Array.from({ length: count }, (_, index) => {
    const id = `00000000-0000-4000-8000-${String(count - index).padStart(12, "0")}`;
    const mode = modes[index % modes.length]!;
    const endedAt = new Date(now.getTime() - index * 1000 * 60 * 60 * 18);
    const startedAt = new Date(endedAt.getTime() - 1000 * 60 * (42 + index * 3));
    const round = 3 + (index % 4);

    return {
      id,
      code: publicGameReference(id),
      config: { mode, playerCount: mode === "mafia_sport" ? 10 : 12 + (index % 5) },
      status: "ended",
      winnerTeam: winners[index % winners.length] ?? "village",
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      eventCount: 18 + index * 5,
      mode,
      timeline: [
        fixtureEvent(index, 0, round, "game_over", endedAt),
        fixtureEvent(index, 1, round, index % 2 === 0 ? "death" : "vote_tally", new Date(endedAt.getTime() - 1000 * 60 * 7)),
        fixtureEvent(index, 2, Math.max(1, round - 1), "reveal", new Date(endedAt.getTime() - 1000 * 60 * 18)),
      ],
    };
  });
}

function fixtureArchive(selection: ArchiveSelection, count: number): HistoryLoadResult {
  const games = fixtureHistory(count).filter((game) =>
    (selection.family === "all" || (selection.family === "werewolves" ? game.mode === "werewolves_classic" : game.mode !== "werewolves_classic"))
    && (selection.outcome === "all" || game.winnerTeam === (selection.outcome === "unknown" ? null : selection.outcome)),
  );
  const cursorIndex = games.findIndex((game) => game.id === (selection.before ?? selection.after));
  if ((selection.before || selection.after) && cursorIndex < 0) return { status: "ready", games: [], hasOlder: false, hasNewer: false };
  const end = selection.after ? cursorIndex : games.length;
  const start = selection.after ? Math.max(0, end - ARCHIVE_PAGE_SIZE) : selection.before ? cursorIndex + 1 : 0;
  const page = games.slice(start, Math.min(end, start + ARCHIVE_PAGE_SIZE));
  return { status: "ready", games: page, hasOlder: start + page.length < games.length, hasNewer: start > 0 };
}

function fixtureEvent(index: number, offset: number, round: number, type: string, createdAt: Date): HistoryTimelineEventView {
  return {
    id: `fixture-${index + 1}-${offset}`,
    round,
    phase: type === "game_over" ? "game_over" : "resolution",
    type,
    createdAt: createdAt.toISOString(),
  };
}
