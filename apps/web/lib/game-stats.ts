import type { GameFamily } from "@werewolf/shared";
import type { LiveStats } from "@/components/landing/LiveTickerCard";
import type { Ending } from "@/components/landing/RecentEndingsCard";

export type GameHomeStats = { liveStats: LiveStats; recentEndings: Ending[] };

/** Public table activity from the game server; null when it is unreachable (never blocks a page). */
export async function loadGameStats(): Promise<GameHomeStats | null> {
  const gameServerUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL?.replace(/^ws/, "http") ?? "http://localhost:2567";
  try {
    const response = await fetch(`${gameServerUrl}/stats`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(800),
    });
    if (!response.ok) {
      return null;
    }
    const stats = (await response.json()) as {
      activeRooms?: number;
      connectedPlayers?: number;
      byFamily?: Partial<Record<GameFamily, number>>;
      recentEndings?: Ending[];
      lastWinner?: Ending | null;
    };

    return {
      liveStats: {
        activeRooms: stats.activeRooms ?? 0,
        connectedPlayers: stats.connectedPlayers ?? 0,
        ...(stats.byFamily ? { byFamily: stats.byFamily } : {}),
      },
      recentEndings: stats.recentEndings ?? (stats.lastWinner ? [stats.lastWinner] : []),
    };
  } catch {
    return null;
  }
}
