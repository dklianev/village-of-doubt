import { memo } from "react";
import { ROLE_DEFINITIONS, type GamePhase, type RoleCode } from "@werewolf/shared";
import { arePlayersEqual, playerInitials, playerStatusBadge } from "@/lib/play/player-display";
import type { PublicPlayer } from "@/lib/play/types";

interface PlaySeatProps {
  player: PublicPlayer;
  phase: GamePhase;
  narratorMode: string;
  targetable: boolean;
  selected: boolean;
  secondSelected: boolean;
  voteCount: number;
  canManageNarrator: boolean;
  canManageMayor: boolean;
  onSelect: () => void;
  onMakeNarrator: () => void;
  onMakeMayor: () => void;
}

export const PlaySeat = memo(function PlaySeat({
  player,
  phase,
  narratorMode,
  targetable,
  selected,
  secondSelected,
  voteCount,
  canManageNarrator,
  canManageMayor,
  onSelect,
  onMakeNarrator,
  onMakeMayor,
}: PlaySeatProps) {
  const status = seatStatusText(player, phase, narratorMode);
  const content = (
    <>
      <span className="play-seat-avatar" aria-hidden="true">
        {playerInitials(player.displayName)}
      </span>
      <span className="play-seat-copy">
        <strong>{player.displayName}</strong>
        <small>{playerStatusBadge(player, phase)}</small>
      </span>
      <span className="play-seat-state">{status}</span>
      {voteCount > 0 ? <span className="play-seat-vote-count" aria-label={`${voteCount} гласа`}>{voteCount}</span> : null}
      {selected || secondSelected ? (
        <span className="play-seat-selected-mark">{secondSelected ? "втора цел" : "цел"}</span>
      ) : null}
    </>
  );

  if (targetable) {
    return (
      <button
        className="play-seat-token"
        type="button"
        aria-pressed={selected || secondSelected}
        aria-label={`Избери ${player.displayName}`}
        onClick={onSelect}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="play-seat-token" aria-label={`${player.displayName}: ${status}`}>
      {content}
      {canManageNarrator || canManageMayor ? (
        <span className="play-seat-controls">
          {canManageNarrator ? (
            <button type="button" onClick={onMakeNarrator}>
              Разказвач
            </button>
          ) : null}
          {canManageMayor ? (
            <button type="button" onClick={onMakeMayor}>
              Кмет
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}, arePlaySeatPropsEqual);

function seatStatusText(player: PublicPlayer, phase: GamePhase, narratorMode: string) {
  if (!player.playing) {
    return "извън играта";
  }
  if (!player.alive) {
    return player.revealedRole
      ? ROLE_DEFINITIONS[player.revealedRole as RoleCode]?.nameBg ?? "елиминиран"
      : "елиминиран";
  }

  const details = [
    player.connected ? "онлайн" : "извън връзка",
    player.host ? "водещ" : "",
    player.narrator ? "разказвач" : "",
    player.mayor ? "кмет" : "",
    narratorMode === "full_human" ? (player.acceptedFullNarrator ? "приел" : "чака") : "",
  ].filter(Boolean);

  return details.join(" · ") || playerStatusBadge(player, phase);
}

function arePlaySeatPropsEqual(previous: PlaySeatProps, next: PlaySeatProps) {
  return previous.phase === next.phase
    && previous.narratorMode === next.narratorMode
    && previous.targetable === next.targetable
    && previous.selected === next.selected
    && previous.secondSelected === next.secondSelected
    && previous.voteCount === next.voteCount
    && previous.canManageNarrator === next.canManageNarrator
    && previous.canManageMayor === next.canManageMayor
    && arePlayersEqual(previous.player, next.player);
}
