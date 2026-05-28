import type { CSSProperties } from "react";
import Link from "next/link";
import type { GameMode } from "@werewolf/shared";
import { topMoments, type HistoryGameView } from "@/lib/history-highlights";
import { tiltFor } from "@/lib/history-tilt";

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

export function CaseFileCard({ game }: { game: HistoryGameView }) {
  const family = modeFamily(game.mode);
  const outcome = outcomeFor(game);
  const moments = topMoments(game.timeline, 2);
  const style = { "--tilt": `${tiltFor(game.id)}deg` } as CSSProperties;

  return (
    <article className="case-file" data-family={family} data-outcome={outcome} style={style}>
      <span className="pushpin" aria-hidden="true" />
      <header className="case-file-head">
        <span className="case-file-number">Дело №{game.code}</span>
        <span className="case-file-date">{shortDate(game.endedAt)}</span>
      </header>
      <h2 className="case-file-verdict">{winnerBg(game.winnerTeam)}</h2>
      <p className="case-file-mode">
        {modeBg(game.mode)} · {playerCountBg(game)}
      </p>
      <ul className="case-file-highlights">
        {moments.map((moment) => (
          <li key={moment.id}>
            <span className="case-file-bullet" aria-hidden="true" />
            {moment.label}
          </li>
        ))}
      </ul>
      <footer className="case-file-foot">
        <span className="case-file-events">{eventsBg(game.eventCount)}</span>
        <Link href={`/history/${game.id}/replay`} className="case-file-cta">
          Отвори дело <span aria-hidden="true">›</span>
        </Link>
      </footer>
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

function shortDate(value: string | null) {
  if (!value) {
    return "без дата";
  }

  return new Intl.DateTimeFormat("bg-BG", { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(value));
}

function playerCountBg(game: HistoryGameView) {
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

function eventsBg(count: number) {
  if (count === 1) {
    return "1 следа";
  }

  return `${count} следи`;
}
