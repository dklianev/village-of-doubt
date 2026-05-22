import { memo } from "react";
import { ROLE_DEFINITIONS, type GamePhase, type RoleCode } from "@werewolf/shared";
import { arePlayersEqual, playerInitials, playerStatusBadge, playerTokenClass } from "@/lib/play/player-display";
import type { PublicPlayer } from "@/lib/play/types";

export const PlayerTile = memo(function PlayerTile({
  player,
  phase,
  narratorMode,
  canManageNarrator,
  canManageMayor,
  onMakeNarrator,
  onMakeMayor,
}: {
  player: PublicPlayer;
  phase: GamePhase;
  narratorMode: string;
  canManageNarrator: boolean;
  canManageMayor: boolean;
  onMakeNarrator: () => void;
  onMakeMayor: () => void;
}) {
  return (
    <div className={playerTokenClass(player)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="player-avatar" aria-hidden="true">
            {playerInitials(player.displayName)}
          </span>
          <div>
            <strong className="block leading-tight">{player.displayName}</strong>
            <small className="font-bold uppercase tracking-[0.16em] text-[#842f2b]/80">
              {playerStatusBadge(player, phase)}
            </small>
          </div>
        </div>
        <span className="rounded-full bg-[#221611]/10 px-3 py-1 text-sm font-bold">
          {player.playing
            ? player.alive
              ? "жив"
              : player.revealedRole
                ? `† ${ROLE_DEFINITIONS[player.revealedRole as RoleCode]?.nameBg ?? "елиминиран"}`
                : "елиминиран"
            : "извън играта"}
        </span>
      </div>
      <small className="mt-3 block text-[#4f3829]">
        {player.connected ? "онлайн" : "прекъсната връзка"}
        {player.host ? " · водещ" : ""}
        {player.narrator ? " · Разказвач" : ""}
        {player.mayor ? " · Кмет" : ""}
        {player.ready ? " · готов" : ""}
        {narratorMode === "full_human" ? ` · ${player.acceptedFullNarrator ? "приел" : "чака приемане"}` : ""}
        {player.actedThisPhase ? " · действал" : ""}
        {player.hasVoted ? " · гласувал" : ""}
      </small>
      {canManageNarrator ? (
        <button className="btn btn-secondary mt-3 min-h-0 px-3 py-2 text-sm" type="button" onClick={onMakeNarrator}>
          Направи Разказвач
        </button>
      ) : null}
      {canManageMayor ? (
        <button className="btn btn-secondary mt-3 min-h-0 px-3 py-2 text-sm" type="button" onClick={onMakeMayor}>
          Направи Кмет
        </button>
      ) : null}
    </div>
  );
}, arePlayerTilePropsEqual);

function arePlayerTilePropsEqual(
  previous: {
    player: PublicPlayer;
    phase: GamePhase;
    narratorMode: string;
    canManageNarrator: boolean;
    canManageMayor: boolean;
  },
  next: {
    player: PublicPlayer;
    phase: GamePhase;
    narratorMode: string;
    canManageNarrator: boolean;
    canManageMayor: boolean;
  },
) {
  return previous.phase === next.phase
    && previous.narratorMode === next.narratorMode
    && previous.canManageNarrator === next.canManageNarrator
    && previous.canManageMayor === next.canManageMayor
    && arePlayersEqual(previous.player, next.player);
}
