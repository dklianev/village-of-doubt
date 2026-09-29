import type { LeaderboardEntry } from "@/lib/leaderboard-headlines";

export const LEADERBOARD_FIXTURE_AS_OF = new Date("2026-09-17T19:00:00.000Z");

export function fixtureLeaderboard(count = 18): LeaderboardEntry[] {
  const names = [
    "Мила", "Калоян", "Ива", "Борис", "Сияна", "Радо", "Неда", "Тео", "Лора",
    "Виктор", "Елица", "Петър", "Дара", "Никола", "Яна", "Сава", "Рая", "Крис",
    "Александра Константинополска", "АлександърБезИнтервалиЗаПроверка",
    "Борис", "Деница", "Стефан", "Мария", "Димитър", "Елена", "Тодор", "Ралица", "Антон", "Искра",
  ];
  const scores: Array<[number, number]> = [
    [9, 8], [11, 7], [8, 5], [10, 5], [7, 4], [9, 4], [6, 3], [8, 3], [6, 2],
    [5, 2], [7, 2], [4, 1], [5, 1], [3, 1], [6, 1], [2, 1], [4, 0], [3, 0],
  ];

  return names.slice(0, count).map((displayName, index) => {
    const [games, wins] = scores[index] ?? [2, 0];
    return {
      id: `fixture-${String(index + 1).padStart(2, "0")}`,
      displayName,
      games,
      wins,
      lastPlayed: new Date(LEADERBOARD_FIXTURE_AS_OF.getTime() - Math.min(index, 18) * 3 * 60 * 60 * 1000),
    };
  }).sort((a, b) => b.wins - a.wins
    || b.games - a.games
    || b.lastPlayed.getTime() - a.lastPlayed.getTime()
    || a.id.localeCompare(b.id));
}
