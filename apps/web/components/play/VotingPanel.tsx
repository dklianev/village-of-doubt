import { VoteTallyBar } from "@/components/play/VoteTallyBar";
import type { PublicPlayer, VoteTallyItem } from "@/lib/play/types";

export function VotingPanel({
  currentUserId,
  livingPlayers,
  voteTally,
  allowSkipVote,
  sendVote,
}: {
  currentUserId: string;
  livingPlayers: PublicPlayer[];
  voteTally: VoteTallyItem[];
  allowSkipVote: boolean;
  sendVote: (targetUserId: string) => void;
}) {
  const maxVotes = Math.max(1, ...voteTally.map((item) => item.count));

  return (
    <section className="ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">гласуване</p>
      <h2 className="mt-2 text-3xl font-black">Кого ще изгоните от площада?</h2>
      <VoteTallyBar items={voteTally} maxVotes={maxVotes} />
      <div className="mt-5 flex flex-wrap gap-3">
        {livingPlayers
          .filter((player) => player.userId !== currentUserId)
          .map((player) => (
            <button className="btn btn-primary" type="button" key={player.userId} onClick={() => sendVote(player.userId)}>
              {player.displayName}
            </button>
          ))}
        {allowSkipVote ? (
          <button className="btn btn-secondary" type="button" onClick={() => sendVote("skip")}>
            Пропусни глас
          </button>
        ) : null}
      </div>
    </section>
  );
}
