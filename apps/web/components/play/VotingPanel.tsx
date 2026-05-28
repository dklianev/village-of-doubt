import { VoteTallyBar } from "@/components/play/VoteTallyBar";
import type { PublicPlayer, VoteTallyItem } from "@/lib/play/types";

export function VotingPanel({
  currentUserId,
  livingPlayers,
  selectedTargetId,
  voteTally,
  allowSkipVote,
  sendVote,
}: {
  currentUserId: string;
  livingPlayers: PublicPlayer[];
  selectedTargetId: string;
  voteTally: VoteTallyItem[];
  allowSkipVote: boolean;
  sendVote: (targetUserId: string) => void;
}) {
  const maxVotes = Math.max(1, ...voteTally.map((item) => item.count));
  const selectedTarget = livingPlayers.find((player) => player.userId === selectedTargetId && player.userId !== currentUserId);

  return (
    <section className="ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">гласуване</p>
      <h2 className="mt-2 text-3xl font-black">Кого ще изгоните от площада?</h2>
      <VoteTallyBar items={voteTally} maxVotes={maxVotes} />
      <div className="play-selected-target mt-5">
        <span>Избрано място</span>
        <strong>{selectedTarget?.displayName ?? "избери играч от масата"}</strong>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className="btn btn-primary"
          type="button"
          disabled={!selectedTarget}
          onClick={() => selectedTarget && sendVote(selectedTarget.userId)}
        >
          {selectedTarget ? `Потвърди гласа за ${selectedTarget.displayName}` : "Потвърди гласа"}
        </button>
        {allowSkipVote ? (
          <button className="btn btn-secondary" type="button" onClick={() => sendVote("skip")}>
            Пропусни глас
          </button>
        ) : null}
      </div>
    </section>
  );
}
