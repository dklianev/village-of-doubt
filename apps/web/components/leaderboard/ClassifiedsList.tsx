import { winRatePercent, type LeaderboardEntry } from "@/lib/leaderboard-headlines";

export function ClassifiedsList({ entries, startRank }: { entries: LeaderboardEntry[]; startRank: number }) {
  return (
    <section className="classifieds" aria-label="Класифицирани играчи">
      <h3 className="classifieds-title">
        Класифицирани · рангове {startRank}–{startRank + entries.length - 1}
      </h3>
      <ul className="classifieds-list">
        {entries.map((entry, index) => (
          <li key={entry.displayName} className="classifieds-item">
            <strong>
              № {startRank + index} · {entry.displayName}
            </strong>
            <span>
              {entry.games}/{entry.wins} · {winRatePercent(entry)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
