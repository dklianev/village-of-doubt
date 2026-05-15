import { shortMeta, winRatePercent, type LeaderboardEntry } from "@/lib/leaderboard-headlines";

export function RanksColumn({ entries, startRank }: { entries: LeaderboardEntry[]; startRank: number }) {
  return (
    <section className="ranks-column" aria-label="Класирани играчи">
      <h3 className="ranks-column-title">Класирани</h3>
      <ol className="ranks-column-list" start={startRank}>
        {entries.map((entry, index) => (
          <li key={entry.displayName} className="ranks-column-item">
            <span className="ranks-column-num">№ {startRank + index}</span>
            <span className="ranks-column-name">{entry.displayName}</span>
            <span className="ranks-column-meta">
              {shortMeta(entry)} · {winRatePercent(entry)}%
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
