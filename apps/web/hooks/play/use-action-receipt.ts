import { useEffect, useState } from "react";
import type { Room } from "@colyseus/sdk";
import type { GamePhase } from "@werewolf/shared";

type ActionReceipt = { kind: "night" } | { kind: "vote" | "nomination" | "revenge"; targetUserId: string };

const RECEIPT_PHASES: Record<ActionReceipt["kind"], readonly GamePhase[]> = {
  night: ["first_night", "night"],
  vote: ["voting"],
  nomination: ["day_discussion"],
  revenge: ["hunter_revenge"],
};

interface ActionReceiptOptions {
  viewerId?: string | undefined;
  hasVoted?: boolean | undefined;
  revoteEligibleUserIds?: readonly string[] | undefined;
  votingCycle?: number | undefined;
}

export function useActionReceipt(
  room: Room | null,
  phase: GamePhase,
  round: number,
  { viewerId, hasVoted, revoteEligibleUserIds, votingCycle }: ActionReceiptOptions = {},
) {
  const roomId = room?.roomId;
  const revoteSignature = JSON.stringify([...(revoteEligibleUserIds ?? [])].sort());
  const [context, setContext] = useState({ room, roomId, viewerId, phase, round, hasVoted, revoteSignature, votingCycle, cycle: 0 });
  const [receipt, setReceipt] = useState<{ cycle: number; action: ActionReceipt } | null>(null);
  const roomChanged = context.room !== room || context.roomId !== roomId;
  // A replacement transport can retain an ACK only for the same known room and viewer.
  const canRetainRoomReceipt = Boolean(room && context.room && roomId && viewerId
    && context.roomId === roomId && context.viewerId === viewerId && context.votingCycle === votingCycle);
  const scopeChanged = (roomChanged && !canRetainRoomReceipt) || context.viewerId !== viewerId
    || context.phase !== phase || context.round !== round
    || (phase === "voting" && context.votingCycle !== votingCycle);

  if (roomChanged || scopeChanged || context.hasVoted !== hasVoted || context.revoteSignature !== revoteSignature) {
    // The ballot marker catches repeated ties even when hasVoted=true was never patched.
    const reset = scopeChanged || (phase === "voting" && (
      (context.hasVoted === true && hasVoted === false) || context.revoteSignature !== revoteSignature
    ));
    setContext({ room, roomId, viewerId, phase, round, hasVoted, revoteSignature, votingCycle, cycle: context.cycle + (reset ? 1 : 0) });
    if (reset) setReceipt(null);
  }

  const cycle = context.cycle;

  useEffect(() => {
    if (!room) return;
    let active = true;
    const subscriptions = ([
      ["night_action_ack", "night"],
      ["vote_ack", "vote"],
      ["nomination_ack", "nomination"],
      ["hunter_revenge_ack", "revenge"],
    ] as const).map(([event, kind]) => room.onMessage(event, (message: unknown) => {
      if (!active || !RECEIPT_PHASES[kind].includes(phase) || !message || typeof message !== "object") return;
      const payload = message as Record<string, unknown>;
      if (payload.phase !== phase || payload.round !== round) return;
      if (kind === "vote" && votingCycle !== undefined && payload.votingCycle !== votingCycle) return;
      if (kind !== "night" && typeof payload.targetUserId !== "string") return;
      const action: ActionReceipt = kind === "night"
        ? { kind }
        : { kind, targetUserId: payload.targetUserId as string };
      setReceipt({ cycle, action });
    }));
    return () => {
      active = false;
      for (const unsubscribe of subscriptions) unsubscribe?.();
    };
  }, [cycle, phase, room, round, votingCycle]);

  return receipt?.cycle === cycle ? receipt.action : null;
}
