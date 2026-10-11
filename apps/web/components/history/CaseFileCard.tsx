import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, Clock3, ScrollText, UsersRound } from "lucide-react";
import type { GameMode } from "@werewolf/shared";
import { LinkPendingHint } from "@/components/navigation-telemetry";
import { topMoments, type HistoryGameView } from "@/lib/history-highlights";
import { formatBulgarianDateTime } from "@/lib/date-time";
import styles from "./Archive.module.css";

type GameFamilyView = "werewolves" | "mafia";
type CaseOutcome = "win" | "loss" | "unknown";

const WINNER_LABELS: Record<string, string> = {
  village: "Селото печели",
  werewolves: "Върколаците печелят",
  vampires: "Вампирите печелят",
  mafia: "Мафията печели",
  maniac: "Маниакът печели",
  lovers: "Влюбените печелят",
  draw: "Няма победител",
};

export function CaseFileCard({ game, visualHistory }: { game: HistoryGameView; visualHistory?: string | undefined }) {
  const family = modeFamily(game.mode);
  const outcome = outcomeFor(game);
  const moments = topMoments(game.timeline.filter((event) => event.type !== "game_over"), 1);
  const duration = durationBg(game);

  return (
    <article className={`${styles.caseFile} case-file`} data-family={family} data-outcome={outcome}>
      <div className={styles.caseImage}>
        <Image src={`/game-art/mobile/${family === "mafia" ? "mafia" : "werewolf"}/bg-hero-light-v1.webp`}
          alt="" fill sizes="(max-width: 640px) 64px, (max-width: 1000px) 96px, 144px" />
      </div>
      <header className={styles.caseHead}>
        <h3 className={styles.verdict}>{winnerBg(game.winnerTeam, game.mode)}</h3>
        <p className={styles.caseMode}><span>{modeBg(game.mode)}</span><span>Дело №{game.code}</span></p>
        {moments.length ? <p className={styles.highlight}>{moments[0]!.label}</p> : null}
      </header>
      <div className={styles.caseFacts}>
        <time dateTime={game.endedAt ?? undefined}><CalendarDays size={15} aria-hidden="true" />{shortDate(game.endedAt)}</time>
        <p className={styles.participants}>
          <span><UsersRound size={15} aria-hidden="true" />{playerCountBg(game)}</span>
          {duration ? <span><Clock3 size={15} aria-hidden="true" />{duration}</span> : null}
        </p>
        <p><ScrollText size={15} aria-hidden="true" />{eventsBg(game.eventCount)}</p>
      </div>
      <div className={styles.caseFoot}>
        <Link href={`/history/${game.id}/replay${visualHistory === "fixture" || visualHistory === "paginated" ? "?visualReplay=fixture" : ""}`} className={styles.caseLink} aria-label={`Отвори дело №${game.code}`}>
          Отвори дело <LinkPendingHint /> <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function winnerBg(winner: string | null, mode: GameMode = "werewolves_classic") {
  if (winner === "village" && modeFamily(mode) === "mafia") {
    return "Гражданите печелят";
  }

  return winner ? WINNER_LABELS[winner] ?? "Неразпозната развръзка" : "Резултатът не е записан";
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

  return formatBulgarianDateTime(new Date(value), { day: "2-digit", month: "short", year: "2-digit" });
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
    return "1 публична следа";
  }

  return `${count} публични следи`;
}

function durationBg(game: HistoryGameView) {
  if (!game.startedAt || !game.endedAt) return null;
  const minutes = Math.round((Date.parse(game.endedAt) - Date.parse(game.startedAt)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes < 1) return "под 1 мин.";
  return minutes < 60 ? `${minutes} мин.` : `${Math.floor(minutes / 60)} ч.${minutes % 60 ? ` ${minutes % 60} мин.` : ""}`;
}
