import Link from "next/link";
import { Display } from "@werewolf/ui/server";
import type { GameMode } from "@werewolf/shared";
import { topMoments, type HistoryGameView } from "@/lib/history-highlights";
import styles from "./History.module.css";

type GameFamilyView = "werewolves" | "mafia";
type CaseOutcome = "win" | "loss" | "unknown";

const WINNER_LABELS: Record<string, string> = {
  village: "Селото печели",
  werewolves: "Върколаците печелят",
  vampires: "Вампирите печелят",
  mafia: "Мафията печели",
  maniac: "Маниакът печели",
  lovers: "Влюбените печелят",
  draw: "Равенство",
};

export function CaseFileCard({ game, variant = "drawer" }: { game: HistoryGameView; variant?: "featured" | "drawer" }) {
  const family = modeFamily(game.mode);
  const outcome = outcomeFor(game);
  const moments = topMoments(game.timeline, 2);

  return (
    <article className={styles.caseFileShell} data-family={family} data-outcome={outcome} data-variant={variant}>
      <Link href={`/history/${game.id}/replay`} className={styles.caseFileLink}>
        <div className={styles.caseDossier}>
          <header className={styles.caseFileHead}>
            <span className={styles.caseFileEyebrow}>ДЕЛО №{game.code}</span>
            <span className={styles.caseOutcomeRibbon}>{outcomeBg(outcome)}</span>
          </header>
          <div className={styles.caseStampRow}>
            <span>{shortDate(game.endedAt)}</span>
            <span>{modeBg(game.mode)}</span>
          </div>
          <div className={styles.caseFileContent}>
            <div>
              <Display size={variant === "featured" ? "h2" : "h3"} as="h2">
                {winnerBg(game.winnerTeam)}
              </Display>
              <p className={styles.caseFileMode}>{playerCountBg(game)}</p>
            </div>
            <span className={styles.caseFactionSeal} aria-hidden="true">
              {family === "werewolves" ? "В" : "М"}
            </span>
            <ul className={styles.caseFileHighlights}>
              {moments.map((moment) => (
                <li key={moment.id}>
                  <span className={styles.caseFileBullet} aria-hidden="true" />
                  {moment.label}
                </li>
              ))}
            </ul>
            <footer className={styles.caseFileFoot}>
              <span className={styles.caseFileEvents}>{eventsBg(game.eventCount)}</span>
              <span className={styles.caseFileAction} aria-hidden="true">
                Отвори дело →
              </span>
            </footer>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function winnerBg(winner: string | null) {
  return winner ? WINNER_LABELS[winner] ?? "Неразпозната развръзка" : "Няма победител";
}

export function modeBg(mode: GameMode) {
  const labels: Record<GameMode, string> = {
    werewolves_classic: "Върколак",
    mafia_sport: "Спортна Мафия",
    mafia_free: "Мафия",
  };

  return labels[mode];
}

export function modeFamily(mode: GameMode): GameFamilyView {
  return mode === "werewolves_classic" ? "werewolves" : "mafia";
}

export function outcomeFor(game: HistoryGameView): CaseOutcome {
  if (game.winnerTeam === "village" || game.winnerTeam === "lovers") {
    return "win";
  }

  if (game.winnerTeam === "werewolves" || game.winnerTeam === "vampires" || game.winnerTeam === "mafia" || game.winnerTeam === "maniac") {
    return "loss";
  }

  return "unknown";
}

function outcomeBg(outcome: CaseOutcome) {
  if (outcome === "win") {
    return "Победа";
  }

  if (outcome === "loss") {
    return "Опасно дело";
  }

  return "Неясно дело";
}

export function shortDate(value: string | null) {
  if (!value) {
    return "без дата";
  }

  return new Intl.DateTimeFormat("bg-BG", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(value));
}

export function playerCountBg(game: HistoryGameView) {
  const count = playerCountFromConfig(game.config);
  return count ? `${count} души` : "неизвестен брой";
}

function playerCountFromConfig(config: unknown) {
  if (config && typeof config === "object" && "playerCount" in config) {
    const value = (config as { playerCount?: unknown }).playerCount;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  return null;
}

export function eventsBg(count: number) {
  if (count === 1) {
    return "1 следа";
  }

  return `${count} следи`;
}
