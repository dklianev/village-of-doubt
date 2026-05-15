import { headlineFor, shortMeta, winRatePercent, type LeaderboardEntry } from "@/lib/leaderboard-headlines";

export function SecondaryStories({ second, third }: { second: LeaderboardEntry | undefined; third: LeaderboardEntry | undefined }) {
  if (!second && !third) {
    return null;
  }

  return (
    <section className="secondary-stories" aria-label="Вторични новини">
      {second ? (
        <article className="secondary-story">
          <p className="secondary-rank">№ 2</p>
          <h3 className="secondary-title">{headlineFor(second, 2)}</h3>
          <p className="secondary-meta">
            {shortMeta(second)} · {winRatePercent(second)}%
          </p>
        </article>
      ) : null}
      {third ? (
        <article className="secondary-story">
          <p className="secondary-rank">№ 3</p>
          <h3 className="secondary-title">{headlineFor(third, 3)}</h3>
          <p className="secondary-meta">
            {shortMeta(third)} · {winRatePercent(third)}%
          </p>
        </article>
      ) : null}
    </section>
  );
}
