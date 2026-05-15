import type { Metadata } from "next";
import { Suspense } from "react";
import { createDatabase, getGameTimeline, getRecentGameHistory } from "@werewolf/database";
import type { GameMode } from "@werewolf/shared";
import { EvidenceWall } from "@/components/history/EvidenceWall";
import { EvidenceWallSkeleton } from "@/components/skeleton";
import type { HistoryGameView, HistoryTimelineEventView } from "@/lib/history-highlights";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "История | Върколак и Мафия",
  description: "Завършени игри, победители, смърти, гласове и развръзки от масата.",
};

export default function HistoryPage() {
  return (
    <main className="shell history-shell evidence-shell">
      <Suspense fallback={<EvidenceWallSkeleton />}>
        <HistoryContent />
      </Suspense>
    </main>
  );
}

async function HistoryContent() {
  const games = await loadHistory();
  return <EvidenceWall games={games} />;
}

async function loadHistory(): Promise<HistoryGameView[]> {
  if (process.env.NODE_ENV !== "production" && process.env.HISTORY_EVIDENCE_FIXTURE === "1") {
    return fixtureHistory();
  }

  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const db = createDatabase(process.env.DATABASE_URL);
    const games = await getRecentGameHistory(db);
    const timelines = await Promise.all(games.map((game) => getGameTimeline(db, game.id, 6)));

    return games.map((game, index) => ({
      id: game.id,
      code: game.code,
      config: game.config,
      status: game.status,
      winnerTeam: game.winnerTeam,
      startedAt: game.startedAt?.toISOString() ?? null,
      endedAt: game.endedAt?.toISOString() ?? null,
      eventCount: game.eventCount,
      mode: modeFromConfig(game.config),
      timeline: (timelines[index] ?? []).map(serializeTimelineEvent),
    }));
  } catch (error) {
    console.error("[history]", error);
    return [];
  }
}

function serializeTimelineEvent(event: {
  id: string;
  round: number;
  phase: string;
  type: string;
  actorId: string | null;
  targetId: string | null;
  visibility: string;
  payload: unknown;
  createdAt: Date;
}): HistoryTimelineEventView {
  return {
    id: event.id,
    round: event.round,
    phase: event.phase,
    type: event.type,
    actorId: event.actorId,
    targetId: event.targetId,
    visibility: event.visibility,
    payload: event.payload,
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

function fixtureHistory(): HistoryGameView[] {
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

  return modes.map((mode, index) => {
    const endedAt = new Date(now.getTime() - index * 1000 * 60 * 60 * 18);
    const startedAt = new Date(endedAt.getTime() - 1000 * 60 * (42 + index * 3));
    const round = 3 + (index % 4);

    return {
      id: `fixture-${index + 1}`,
      code: String(42 - index).padStart(3, "0"),
      config: { mode, playerCount: mode === "mafia_sport" ? 10 : 12 + (index % 5) },
      status: "ended",
      winnerTeam: winners[index] ?? "village",
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

function fixtureEvent(index: number, offset: number, round: number, type: string, createdAt: Date): HistoryTimelineEventView {
  return {
    id: `fixture-${index + 1}-${offset}`,
    round,
    phase: type === "game_over" ? "game_over" : "resolution",
    type,
    actorId: null,
    targetId: null,
    visibility: "public",
    payload: {},
    createdAt: createdAt.toISOString(),
  };
}
