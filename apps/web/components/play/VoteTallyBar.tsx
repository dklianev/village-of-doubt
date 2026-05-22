import type { VoteTallyItem } from "@/lib/play/types";

export function VoteTallyBar({ items, maxVotes }: { items: VoteTallyItem[]; maxVotes: number }) {
  if (items.length === 0) {
    return (
      <div className="vote-tally-card mt-5">
        <p>Още няма подадени гласове. Първият глас често задава посоката на целия ден.</p>
      </div>
    );
  }

  return (
    <div className="vote-tally-card mt-5" aria-label="Текущо броене на гласовете">
      {items.map((item) => (
        <div key={item.targetUserId} className="vote-tally-row">
          <span>{item.targetName}</span>
          <div>
            <i style={{ transform: `scaleX(${Math.max(0.1, Math.min(1, item.count / maxVotes))})` }} />
          </div>
          <strong>{item.count}</strong>
          {item.hasMayorVote ? <small>кметски глас при равенство</small> : null}
        </div>
      ))}
    </div>
  );
}
