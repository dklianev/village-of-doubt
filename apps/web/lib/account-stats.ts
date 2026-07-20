import type { GameHistorySummary } from "@werewolf/database";
import { getRoleTeam, ROLE_DEFINITIONS, type RoleCode } from "@werewolf/shared";

export interface PlayerStats {
  totalGames: number;
  totalWins: number;
  winRate: number;
  villageWins: number;
  threatWins: number;
  longestStreak: number;
  memberSince: Date | null;
}

interface GameWithPlayerOutcome {
  game: GameHistorySummary;
  role: string | null;
  won: boolean;
}

function isKnownRole(role: string | null): role is RoleCode {
  return Boolean(role && role in ROLE_DEFINITIONS);
}

export function computePlayerStats(rows: GameWithPlayerOutcome[], memberSince: Date | null): PlayerStats {
  const totalGames = rows.length;
  let totalWins = 0;
  let villageWins = 0;
  let threatWins = 0;
  let currentStreak = 0;
  let longestStreak = 0;

  const sorted = [...rows].sort((a, b) => {
    const aTime = a.game.endedAt?.getTime() ?? 0;
    const bTime = b.game.endedAt?.getTime() ?? 0;
    return aTime - bTime;
  });

  for (const row of sorted) {
    const winner = row.game.winnerTeam;
    const won = row.won;

    if (won) {
      totalWins += 1;
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      const playerTeam = isKnownRole(row.role) ? getRoleTeam(row.role) : null;
      if (winner === "village" && playerTeam === "village") {
        villageWins += 1;
      }
      if (
        (winner === "werewolves" || winner === "vampires" || winner === "mafia")
        && playerTeam === winner
      ) {
        threatWins += 1;
      }
    } else {
      currentStreak = 0;
    }
  }

  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  return { totalGames, totalWins, winRate, villageWins, threatWins, longestStreak, memberSince };
}
