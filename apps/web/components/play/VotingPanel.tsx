import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { VoteTallyBar } from "@/components/play/VoteTallyBar";
import type { PublicPlayer, VoteTallyItem } from "@/lib/play/types";
import styles from "./VotingPanel.module.css";

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
  const [skipArmed, setSkipArmed] = useState(false);
  const maxVotes = Math.max(1, ...voteTally.map((item) => item.count));
  const selectedTarget = livingPlayers.find((player) => player.userId === selectedTargetId && player.userId !== currentUserId);

  useEffect(() => {
    setSkipArmed(false);
  }, [selectedTargetId]);

  return (
    <section className="ritual-panel" aria-label="Гласуване">
      <div className="play-selected-target" data-filled={selectedTarget ? "true" : undefined}>
        <span>{selectedTarget ? "Избран играч" : "За кого гласуваш?"}</span>
        <strong className={styles.selectedName}>{selectedTarget?.displayName ?? "Избери играч"}</strong>
      </div>
      <div className="play-action-buttons flex flex-wrap">
        <button
          className="btn btn-primary"
          type="button"
          disabled={!selectedTarget}
          aria-label={selectedTarget ? `Потвърди гласа за ${selectedTarget.displayName}` : "Потвърди гласа"}
          onClick={() => {
            if (!selectedTarget) return;
            setSkipArmed(false);
            sendVote(selectedTarget.userId);
          }}
        >
          Потвърди гласа
        </button>
        {allowSkipVote ? (
          <button
            className="btn btn-secondary play-confirm-skip"
            data-command-priority="quiet"
            data-confirm-state={skipArmed ? "armed" : "idle"}
            type="button"
            aria-pressed={skipArmed}
            onClick={() => {
              if (skipArmed) {
                setSkipArmed(false);
                sendVote("skip");
                return;
              }
              setSkipArmed(true);
            }}
          >
            {skipArmed ? "Потвърди пропускането" : "Пропусни глас"}
          </button>
        ) : null}
      </div>
      <details className="play-action-explanation play-vote-counts">
        <summary>Преброяване<ChevronDown aria-hidden /></summary>
        <VoteTallyBar items={voteTally} maxVotes={maxVotes} />
      </details>
    </section>
  );
}
