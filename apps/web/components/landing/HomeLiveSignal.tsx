import { loadGameStats } from "@/lib/game-stats";

function count(value: number, one: string, many: string) {
  return `${value} ${value === 1 ? one : many}`;
}

/**
 * A quiet proof of life under the homepage hero. Streams in behind Suspense and stays absent
 * when no table is open or the game server is unreachable, so an empty evening never shouts.
 */
export async function HomeLiveSignal() {
  const stats = await loadGameStats();
  const rooms = stats?.liveStats.activeRooms ?? 0;
  if (!stats || rooms < 1) return null;
  const players = stats.liveStats.connectedPlayers;

  return (
    <p className="landing-live-signal">
      <span className="landing-live-dot" aria-hidden="true" />
      <span>На живо: {count(rooms, "маса", "маси")}{players > 0 ? ` · ${count(players, "играч", "играчи")}` : ""}</span>
    </p>
  );
}
