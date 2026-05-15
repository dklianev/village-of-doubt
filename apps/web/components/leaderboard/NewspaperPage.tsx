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
    <article className="newspaper-page" aria-label="Вечерен брой на класацията">
      <Masthead issueCount={issueCount} />
      <MainHeadline entry={top1} />
      <SecondaryStories second={top2} third={top3} />
      {ranksColumn.length > 0 ? <RanksColumn entries={ranksColumn} startRank={4} /> : null}
      {classifieds.length > 0 ? <ClassifiedsList entries={classifieds} startRank={9} /> : null}
    </article>
  );
}
