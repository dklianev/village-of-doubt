import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { ProfilePortrait } from "@/components/ProfilePortrait";
import { VoteTallyBar } from "@/components/play/VoteTallyBar";
import { avatarIdForUser } from "@/lib/avatar-catalog";
import type { PublicPlayer, VoteTallyItem } from "@/lib/play/types";
import styles from "./VotingPanel.module.css";

export function VotingPanel({
  currentUserId,
  livingPlayers,
  selectedTargetId,
  acceptedTargetId,
  voteTally,
  allowSkipVote,
  sendVote,
}: {
  currentUserId: string;
  livingPlayers: PublicPlayer[];
  selectedTargetId: string;
  acceptedTargetId?: string | undefined;
  voteTally: VoteTallyItem[];
  allowSkipVote: boolean;
  sendVote: (targetUserId: string) => void;
}) {
  const [skipArmed, setSkipArmed] = useState(false);
  const maxVotes = Math.max(1, ...voteTally.map((item) => item.count));
  const selectedTarget = livingPlayers.find((player) => player.userId === selectedTargetId && player.userId !== currentUserId);
  const confirmed = Boolean(selectedTarget && selectedTarget.userId === acceptedTargetId);

  useEffect(() => {
    setSkipArmed(false);
  }, [selectedTargetId]);

  return (
    <section className={`ritual-panel ${styles.panel}`} aria-label="Гласуване">
      <div
        className={`play-selected-target ${styles.selection}`}
        data-filled={selectedTarget ? "true" : undefined}
        data-vote-state={selectedTarget ? confirmed ? "confirmed" : "selected" : "empty"}
      >
        {selectedTarget ? (
          <div className={styles.avatar} aria-hidden="true">
            <ProfilePortrait avatarId={avatarIdForUser(selectedTarget.userId, selectedTarget.avatarId)} decorative />
          </div>
        ) : null}
        <div className={styles.selectionCopy}>
          <span className={styles.selectionLabel}>{selectedTarget ? confirmed ? "Потвърден глас" : "Избран играч" : "За кого гласуваш?"}</span>
          <strong className={styles.selectedName}>{selectedTarget?.displayName ?? "Избери играч"}</strong>
          {selectedTarget ? (
            <span className={styles.selectionStatus}>
              {confirmed ? <Check aria-hidden /> : null}
              {confirmed ? "Гласът е приет" : "Още не е потвърден"}
            </span>
          ) : null}
        </div>
      </div>
      <div className="play-action-buttons flex flex-wrap">
        <button
          className={`btn btn-primary ${styles.confirm}`}
          type="button"
          disabled={!selectedTarget}
          aria-label={selectedTarget ? `Потвърди гласа за ${selectedTarget.displayName}` : "Потвърди гласа"}
          onClick={() => {
            if (!selectedTarget) return;
            setSkipArmed(false);
            sendVote(selectedTarget.userId);
          }}
        >
          <Check aria-hidden />
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
