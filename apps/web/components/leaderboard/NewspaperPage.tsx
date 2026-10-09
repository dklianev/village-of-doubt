import { MainHeadline } from "./MainHeadline";
import { Masthead } from "./Masthead";
import { formatNewspaperDate, winRatePercent, type LeaderboardEntry } from "@/lib/leaderboard-headlines";

export function NewspaperPage({ entries, asOf }: { entries: LeaderboardEntry[]; asOf?: Date | undefined }) {
  const top1 = entries[0];

  if (!top1) {
    return null;
  }

  return (
    <article className="newspaper-page" aria-label="Вечерен брой">
      <Masthead asOf={asOf} />
      <MainHeadline entry={top1} runnersUp={entries.slice(1, 3)} />
      <div className="newspaper-ranking-scroll" role="region" aria-label="Класиране на играчите" tabIndex={0}>
        <table className="newspaper-ranking" aria-describedby="ranking-order ranking-scope">
          <caption><span>Класиране</span><span className="ranking-order-label" aria-hidden="true">По победи</span></caption>
          <colgroup>
            <col className="ranking-place-col" />
            <col />
            <col className="ranking-wins-col" />
            <col className="ranking-games-col" />
            <col className="ranking-rate-col" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" aria-label="Място">№</th>
              <th scope="col">Играч</th>
              <th scope="col">Победи</th>
              <th scope="col">Игри</th>
              <th scope="col" aria-label="Процент победи">%</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={entry.id ?? `${entry.displayName}-${index}`} data-leading={index === 0 || undefined}>
                <td>{index + 1}</td>
                <th scope="row"><bdi>{entry.displayName}</bdi></th>
                <td>{entry.wins}</td>
                <td>{entry.games}</td>
                <td>{winRatePercent(entry)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="newspaper-colophon">
        <p id="ranking-order">
          Подредбата е по победи, после по брой игри и по-скорошно участие.
          При пълно равенство редът е постоянен.
        </p>
        <p id="ranking-scope">
          До 30 играчи от публичните игри, завършили през последните 7 дни.
          Процентът показва победите спрямо изиграните игри.
        </p>
        {asOf ? <p className="newspaper-updated">Данни към <time dateTime={asOf.toISOString()}>{formatNewspaperDate(asOf)}</time> (София).</p> : null}
      </footer>
    </article>
  );
}
