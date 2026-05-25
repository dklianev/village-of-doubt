"use client";

import { useMemo, useState } from "react";
import { Display, Pill, SceneCard } from "@werewolf/ui";
import { CaseFileCard, modeFamily, outcomeFor } from "@/components/history/CaseFileCard";
import { EvidenceWallEmpty } from "@/components/history/EvidenceWallEmpty";
import type { HistoryGameView } from "@/lib/history-highlights";
import styles from "./History.module.css";

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
      <header aria-label="Архив на масата" className={styles.heroFrame}>
        <SceneCard
          eyebrow="АРХИВ"
          density="lg"
          background={{
            image: "var(--art-history)",
            overlay: "scrim",
          }}
        >
          <Display size="h1">Архив на масата</Display>
          <p className={styles.heroSubtitle}>Всяко дело носи дата, играчите, ролите и развръзката.</p>
        </SceneCard>
      </header>

      {games.length > 0 ? (
        <div className={styles.evidenceFilters} role="group" aria-label="Филтри по дело">
          {FILTERS.map((item) => (
            <Pill
              key={item.value}
              type="button"
              intent={filter === item.value ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Pill>
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
          <Pill type="button" intent="secondary" size="sm" onClick={() => setFilter("all")}>
            Покажи всички
          </Pill>
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
