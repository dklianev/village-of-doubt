import { formatBulgarianDateTime } from "@/lib/date-time";

export interface LeaderboardEntry {
  id?: string;
  displayName: string;
  games: number;
  wins: number;
  lastPlayed: Date | null;
}

export function headlineFor(entry: LeaderboardEntry, rank: number): string {
  return rank === 1 ? `${entry.displayName} оглавява броя` : entry.displayName;
}

export function flavorQuoteFor(entry: LeaderboardEntry, rank: number): string | null {
  if (rank !== 1) {
    return null;
  }

  const { wins, games } = entry;
  return `${wins} ${wins === 1 ? "победа" : "победи"} от ${games} ${games === 1 ? "игра" : "игри"} за последните 7 дни.`;
}

export function winRatePercent(entry: LeaderboardEntry): number {
  return Math.round((entry.wins / Math.max(1, entry.games)) * 100);
}

export function formatNewspaperDate(date: Date): string {
  return formatBulgarianDateTime(date, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
