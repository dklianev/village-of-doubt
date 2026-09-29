import type { PlayerGameStatistics } from "@werewolf/database";
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

function isKnownRole(role: string): role is RoleCode {
  return Object.hasOwn(ROLE_DEFINITIONS, role);
}

export function computePlayerStats(summary: PlayerGameStatistics, memberSince: Date | null): PlayerStats {
  const { totalGames, totalWins, longestStreak } = summary;
  let villageWins = 0;
  let threatWins = 0;

  for (const { role, winnerTeam, wins } of summary.winsByRole) {
    const playerTeam = isKnownRole(role) ? getRoleTeam(role) : null;
    if (winnerTeam === "village" && playerTeam === "village") {
      villageWins += wins;
    }
    if (
      (winnerTeam === "werewolves" || winnerTeam === "vampires" || winnerTeam === "mafia")
      && playerTeam === winnerTeam
    ) {
      threatWins += wins;
    }
  }

  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  return { totalGames, totalWins, winRate, villageWins, threatWins, longestStreak, memberSince };
}
