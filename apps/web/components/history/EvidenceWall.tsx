"use client";

import { useMemo, useState } from "react";
import { CaseFileCard, modeFamily, outcomeFor } from "@/components/history/CaseFileCard";
import { EvidenceWallEmpty } from "@/components/history/EvidenceWallEmpty";
import type { HistoryGameView } from "@/lib/history-highlights";

type EvidenceFilter = "all" | "werewolves" | "mafia" | "wins" | "losses";

const FILTERS: Array<{ value: EvidenceFilter; label: string }> = [
  { value: "all", label: "Всички" },
  { value: "werewolves", label: "Върколак" },
  { value: "mafia", label: "Мафия" },
  { value: "wins", label: "Победи" },
  { value: "losses", label: "Загуби" },
];

export function EvidenceWall({ games }: { games: HistoryGameView[] }) {
  const [filter, setFilter] = useState<EvidenceFilter>("all");
  const filteredGames = useMemo(() => games.filter((game) => matchesFilter(game, filter)), [filter, games]);

  return (
    <>
      <header className="evidence-wall-header">
        <p className="section-kicker">архив</p>
        <h1>Архив на масата</h1>
        <p className="evidence-wall-subtitle">Всяко дело носи дата, играчите, ролите и развръзката.</p>
      </header>

      {games.length > 0 ? (
        <div className="evidence-filters" role="group" aria-label="Филтри по дело">
          {FILTERS.map((item) => (
            <button key={item.value} type="button" data-active={filter === item.value} onClick={() => setFilter(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {games.length === 0 ? (
        <EvidenceWallEmpty />
      ) : filteredGames.length > 0 ? (
        <section className="evidence-wall" aria-label="Списък с дела">
          {filteredGames.map((game) => (
            <CaseFileCard key={game.id} game={game} />
          ))}
        </section>
      ) : (
        <section className="evidence-filter-empty">
          <h2>Няма дела за този филтър</h2>
          <p>Смени филтъра или изчакай нова завършена игра.</p>
          <button type="button" className="btn btn-secondary" onClick={() => setFilter("all")}>
            Покажи всички
          </button>
        </section>
      )}
    </>
  );
}

function matchesFilter(game: HistoryGameView, filter: EvidenceFilter) {
  switch (filter) {
    case "werewolves":
      return modeFamily(game.mode) === "werewolves";
    case "mafia":
      return modeFamily(game.mode) === "mafia";
    case "wins":
      return outcomeFor(game) === "win";
    case "losses":
      return outcomeFor(game) === "loss";
    case "all":
    default:
      return true;
  }
}
