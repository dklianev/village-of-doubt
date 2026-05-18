import { getRoleTeam, ROLE_DEFINITIONS, type RoleCode } from "@werewolf/shared";
import type { GameHistorySummary } from "@werewolf/database";

export interface PlayerStats {
  totalGames: number;
  totalWins: number;
  winRate: number;
  villageWins: number;
  threatWins: number;
  longestStreak: number;
  memberSince: Date | null;
}

interface GameWithPlayerRole {
  game: GameHistorySummary;
  role: string | null;
}

export function computePlayerStats(rows: GameWithPlayerRole[], memberSince: Date | null): PlayerStats {
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
    const role = row.role;
    const won = didPlayerWin(role, winner);

    if (won) {
      totalWins += 1;
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      if (winner === "village") {
        villageWins += 1;
      }
      if (winner === "werewolves" || winner === "vampires" || winner === "mafia") {
        threatWins += 1;
      }
    } else {
      currentStreak = 0;
    }
  }

  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  return { totalGames, totalWins, winRate, villageWins, threatWins, longestStreak, memberSince };
}

function didPlayerWin(role: string | null, winner: string | null): boolean {
  if (!role || !winner || winner === "draw") {
    return false;
  }
  if (!isKnownRole(role)) {
    return false;
  }
  if (winner === "maniac") {
    return role === "maniac";
  }
  if (winner === "lovers") {
    return false;
  }

  return getRoleTeam(role) === winner;
}

function isKnownRole(role: string): role is RoleCode {
  return role in ROLE_DEFINITIONS;
}
