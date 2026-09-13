import { ClassifiedsList } from "./ClassifiedsList";
import { MainHeadline } from "./MainHeadline";
import { Masthead } from "./Masthead";
import { RanksColumn } from "./RanksColumn";
import { SecondaryStories } from "./SecondaryStories";
import type { LeaderboardEntry } from "@/lib/leaderboard-headlines";

export function NewspaperPage({ entries, issueCount }: { entries: LeaderboardEntry[]; issueCount: number }) {
  const top1 = entries[0];
  const top2 = entries[1];
  const top3 = entries[2];
  const ranksColumn = entries.slice(3, 8);
  const classifieds = entries.slice(8);

  if (!top1) {
    return null;
  }

  return (
    <article className="newspaper-page" aria-label="Вечерен брой">
      <Masthead issueCount={issueCount} />
      <table className="newspaper-ranking">
        <caption>Начело на класацията</caption>
        <thead>
          <tr>
            <th scope="col">Място</th>
            <th scope="col">Играч</th>
            <th scope="col">Победи</th>
            <th scope="col">Вечери</th>
          </tr>
        </thead>
        <tbody>
          {entries.slice(0, 3).map((entry, index) => (
            <tr key={entry.id ?? `${entry.displayName}-${index}`}>
              <td>{index + 1}</td>
              <th scope="row">{entry.displayName}</th>
              <td>{entry.wins}</td>
              <td>{entry.games}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <MainHeadline entry={top1} />
      <SecondaryStories second={top2} third={top3} />
      {ranksColumn.length > 0 ? <RanksColumn entries={ranksColumn} startRank={4} /> : null}
      {classifieds.length > 0 ? <ClassifiedsList entries={classifieds} startRank={9} /> : null}
    </article>
  );
}
