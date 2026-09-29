import { flavorQuoteFor, type LeaderboardEntry } from "@/lib/leaderboard-headlines";

export function MainHeadline({
  entry,
  runnersUp = [],
}: {
  entry: LeaderboardEntry;
  runnersUp?: LeaderboardEntry[];
}) {
  const quote = flavorQuoteFor(entry, 1);

  return (
    <section className="headline-main" aria-label="Начело на броя">
      <div className="headline-body">
        <p className="headline-kicker">Начело на броя</p>
        <h2 className="headline-main-title"><bdi>{entry.displayName}</bdi> оглавява броя</h2>
        <p className="headline-lede">{quote}</p>
      </div>
      {runnersUp.length > 0 ? (
        <ol className="headline-runners" start={2} aria-label="След водача">
          {runnersUp.slice(0, 2).map((runner, index) => (
            <li className="headline-runner" key={runner.id ?? `${runner.displayName}-${index}`}>
              <span className="headline-rank" aria-label={`Място ${index + 2}`}>0{index + 2}</span>
              <bdi className="headline-runner-name">{runner.displayName}</bdi>
              <span className="headline-runner-wins">{runner.wins} {runner.wins === 1 ? "победа" : "победи"}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
