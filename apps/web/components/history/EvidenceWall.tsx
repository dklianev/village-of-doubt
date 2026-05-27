"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { BriefcaseBusiness, PawPrint, Scale, ScrollText, Search } from "lucide-react";
import { Display, Pill, SceneCard } from "@werewolf/ui";
import { CaseFileCard, eventsBg, modeFamily, outcomeFor } from "@/components/history/CaseFileCard";
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
  const stats = useMemo(() => archiveStats(games), [games]);
  const featuredCase = filteredGames[0];
  const drawerCases = filteredGames.slice(1);

  return (
    <>
      <header aria-label="Архив на масата" className={styles.heroFrame}>
        <SceneCard
          eyebrow="АРХИВ"
          density="lg"
          background={{
            image: "var(--art-history)",
            overlay: "veil",
            minHeight: "var(--ds-scene-hero-min-cinematic)",
          }}
        >
          <div className={styles.heroCopy}>
            <Display size="hero">Архив на масата</Display>
            <p className={styles.heroSubtitle}>Всяко дело лежи като папка върху нощно бюро: дата, играчи, роли и развръзка.</p>
          </div>
        </SceneCard>
      </header>

      {games.length > 0 ? (
        <section className={styles.archiveDesk} aria-label="Архивен плот">
          <div className={styles.ledgerStrip} aria-label="Статистика на архива">
            <LedgerStat icon={<ScrollText />} label="Дела" value={stats.total} />
            <LedgerStat icon={<PawPrint />} label="Върколак" value={stats.werewolves} tone="werewolves" />
            <LedgerStat icon={<BriefcaseBusiness />} label="Мафия" value={stats.mafia} tone="mafia" />
            <LedgerStat icon={<Scale />} label="Победи" value={stats.wins} tone="win" />
            <LedgerStat icon={<Search />} label="Следи" value={eventsBg(stats.events)} />
          </div>

          <div className={styles.filterTray} role="group" aria-label="Филтри по дело">
            <span className={styles.filterTrayLabel}>Нишка на доказателствата</span>
            <div className={styles.filterTabs}>
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={styles.filterTab}
                  data-active={filter === item.value ? "true" : "false"}
                  aria-pressed={filter === item.value}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {games.length === 0 ? (
        <EvidenceWallEmpty />
      ) : filteredGames.length > 0 ? (
        <section className={styles.archiveBoard} aria-label="Списък с дела">
          <div className={styles.featuredCase}>
            <span className={styles.boardKicker}>Последно заведено дело</span>
            <CaseFileCard key={featuredCase!.id} game={featuredCase!} variant="featured" />
          </div>
          {drawerCases.length > 0 ? (
            <svg className={styles.redThread} aria-hidden="true" focusable="false" viewBox="0 0 200 100" preserveAspectRatio="none">
              <path d="M 12 52 C 48 28, 83 73, 122 46 S 170 37, 194 55" />
            </svg>
          ) : null}
          {drawerCases.length > 0 ? (
            <div className={styles.caseDrawerGrid} aria-label="Останали дела">
              {drawerCases.map((game) => (
                <CaseFileCard key={game.id} game={game} />
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className={styles.evidenceFilterEmpty}>
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

function LedgerStat({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  tone?: "werewolves" | "mafia" | "win" | "default";
}) {
  return (
    <div className={styles.ledgerStat} data-tone={tone}>
      <span className={styles.ledgerIcon} aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function archiveStats(games: HistoryGameView[]) {
  return games.reduce(
    (stats, game) => {
      stats.total += 1;
      stats.events += game.eventCount;

      if (modeFamily(game.mode) === "werewolves") {
        stats.werewolves += 1;
      } else {
        stats.mafia += 1;
      }

      if (outcomeFor(game) === "win") {
        stats.wins += 1;
      }

      return stats;
    },
    { total: 0, werewolves: 0, mafia: 0, wins: 0, events: 0 },
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
