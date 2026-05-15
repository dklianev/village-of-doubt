export interface LeaderboardEntry {
  displayName: string;
  games: number;
  wins: number;
  lastPlayed: Date | null;
}

export function headlineFor(entry: LeaderboardEntry, rank: number): string {
  const { wins, games, displayName } = entry;
  const winRate = wins / Math.max(1, games);

  if (rank === 1) {
    if (games >= 5 && wins === games) {
      return `${displayName} още не познава поражение`;
    }
    if (winRate >= 0.75 && wins >= 4) {
      return `${displayName} отново оцеля`;
    }
    if (winRate >= 0.5 && wins >= 3) {
      return `${displayName} остава прав в нощите`;
    }
    if (games === 1 && wins === 1) {
      return `Първа победа: ${displayName} взе вечерта`;
    }
    return `${displayName} оцелява най-често`;
  }

  if (rank === 2) {
    if (wins >= 5) {
      return `${displayName} остава в сянка`;
    }
    if (winRate >= 0.5) {
      return `${displayName} се държи близо до върха`;
    }
    return `${displayName} е втора фигура`;
  }

  if (rank === 3) {
    if (winRate >= 0.5) {
      return `${displayName} се движи внимателно`;
    }
    if (wins >= 2) {
      return `${displayName} вече има две победи`;
    }
    return `${displayName} още събира памет`;
  }

  return displayName;
}

export function flavorQuoteFor(entry: LeaderboardEntry, rank: number): string | null {
  if (rank !== 1) {
    return null;
  }

  const { wins, games } = entry;
  const winRate = wins / Math.max(1, games);

  if (winRate >= 0.85 && games >= 5) {
    return `${wins} победи от ${games} вечери. Селото знае кого да гледа.`;
  }
  if (wins >= 5) {
    return `${wins} победи събрани под различни роли. Всяка нощ носи нова маска.`;
  }
  if (games === 1 && wins === 1) {
    return "Една игра, една победа. Дебютът става легенда.";
  }
  if (winRate >= 0.5) {
    return `${wins} оцеляли вечери от ${games}. По-малко гласове отиват в сянка.`;
  }
  return `${wins} оцеляли вечери от ${games}. Масата помни.`;
}

export function shortMeta(entry: LeaderboardEntry): string {
  return `${entry.games} вечери · ${entry.wins} победи`;
}

export function winRatePercent(entry: LeaderboardEntry): number {
  return Math.round((entry.wins / Math.max(1, entry.games)) * 100);
}

export function formatNewspaperDate(date: Date): string {
  return new Intl.DateTimeFormat("bg-BG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function issueNumber(seed: number): string {
  return String(Math.max(1, seed)).padStart(3, "0");
}
