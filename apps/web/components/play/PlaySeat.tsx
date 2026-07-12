import { memo, type CSSProperties, type RefCallback } from "react";
import { MoreHorizontal } from "lucide-react";
import { ROLE_DEFINITIONS, type GamePhase, type RoleCode } from "@werewolf/shared";
import { playerInitials } from "@/lib/play/player-display";
import type { PublicPlayer } from "@/lib/play/types";
import styles from "./PlaySeat.module.css";

export type StageSeatPlayer = Pick<
  PublicPlayer,
  | "userId"
  | "displayName"
  | "connected"
  | "ready"
  | "playing"
  | "alive"
  | "host"
  | "narrator"
  | "acceptedFullNarrator"
  | "mayor"
  | "hasVoted"
  | "revealedRole"
>;

interface PlaySeatProps {
  player: StageSeatPlayer;
  phase: GamePhase;
  narratorMode: string;
  portraitSlot: number;
  targetable: boolean;
  selected: boolean;
  secondSelected: boolean;
  voteCount: number;
  canManageNarrator: boolean;
  canManageMayor: boolean;
  menuId: string;
  menuOpen: boolean;
  menuTriggerRef: RefCallback<HTMLButtonElement>;
  onMenuToggle: (open: boolean) => void;
  onSelect: () => void;
  onMakeNarrator: () => void;
  onMakeMayor: () => void;
}

export const PlaySeat = memo(function PlaySeat({
  player,
  phase,
  narratorMode,
  portraitSlot,
  targetable,
  selected,
  secondSelected,
  voteCount,
  canManageNarrator,
  canManageMayor,
  menuId,
  menuOpen,
  menuTriggerRef,
  onMenuToggle,
  onSelect,
  onMakeNarrator,
  onMakeMayor,
}: PlaySeatProps) {
  const status = seatStatusText(player, phase, narratorMode);
  const stateParts: string[] = [];
  if (voteCount > 0) {
    stateParts.push(`${voteCount} гласа`);
  }
  if (secondSelected) {
    stateParts.push("втора цел");
  } else if (selected) {
    stateParts.push("избрана цел");
  }
  const stateSuffix = stateParts.length > 0 ? `, ${stateParts.join(", ")}` : "";
  const hasManagementControls = canManageNarrator || canManageMayor;
  const portraitColumn = portraitSlot % 3;
  const portraitRow = Math.floor(portraitSlot / 3);
  const portraitStyle = {
    "--portrait-x": `${portraitColumn * 50}%`,
    "--portrait-y": `${portraitRow * 50}%`,
  } as CSSProperties;
  const content = (
    <>
      <span className={styles.portrait} data-seat-portrait aria-hidden="true">
        <span className={styles.avatar} data-seat-avatar style={portraitStyle} />
        <span className={styles.initialBadge}>{playerInitials(player.displayName)}</span>
        {voteCount > 0 ? <span className={styles.voteCount}>{voteCount}</span> : null}
        {selected || secondSelected ? (
          <span className={styles.selectedMark}>{secondSelected ? "2" : "✓"}</span>
        ) : null}
      </span>
      <span className={styles.nameplate} data-seat-name>{player.displayName}</span>
      <span className={styles.state} data-seat-state-label>{status}</span>
    </>
  );

  if (targetable) {
    return (
      <button
        className={`${styles.token} ${styles.targetable}`}
        data-seat-token
        type="button"
        data-alive={player.alive ? "true" : "false"}
        data-connected={player.connected ? "true" : "false"}
        data-ready={player.ready ? "true" : "false"}
        data-voted={player.hasVoted ? "true" : undefined}
        data-selected={selected ? "true" : undefined}
        data-second-selected={secondSelected ? "true" : undefined}
        aria-pressed={selected || secondSelected}
        aria-label={`Избери ${player.displayName}: ${status}${stateSuffix}`}
        onClick={onSelect}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={styles.token}
      data-seat-token
      role="group"
      data-alive={player.alive ? "true" : "false"}
      data-connected={player.connected ? "true" : "false"}
      data-ready={player.ready ? "true" : "false"}
      data-voted={player.hasVoted ? "true" : undefined}
      aria-label={`${player.displayName}: ${status}${stateSuffix}`}
    >
      {content}
      {hasManagementControls ? (
        <div className={styles.menu} data-seat-menu-root data-open={menuOpen ? "true" : undefined}>
          <button
            ref={menuTriggerRef}
            className={styles.menuTrigger}
            type="button"
            aria-label={`Управление за ${player.displayName}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            data-seat-menu-trigger
            onClick={() => onMenuToggle(!menuOpen)}
          >
            <MoreHorizontal aria-hidden="true" strokeWidth={2.4} />
          </button>
          <div id={menuId} className={styles.controls} role="menu" hidden={!menuOpen}>
            {canManageNarrator ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onMakeNarrator();
                  onMenuToggle(false);
                }}
              >
                Разказвач
              </button>
            ) : null}
            {canManageMayor ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onMakeMayor();
                  onMenuToggle(false);
                }}
              >
                Кмет
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}, arePlaySeatPropsEqual);

function seatStatusText(player: StageSeatPlayer, phase: GamePhase, narratorMode: string) {
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
    phase === "lobby" && player.ready ? "готов" : "",
    narratorMode === "full_human" ? (player.acceptedFullNarrator ? "приел" : "чака") : "",
  ].filter(Boolean);

  return details.join(" · ") || "на масата";
}

function arePlaySeatPropsEqual(previous: PlaySeatProps, next: PlaySeatProps) {
  return previous.phase === next.phase
    && previous.narratorMode === next.narratorMode
    && previous.portraitSlot === next.portraitSlot
    && previous.targetable === next.targetable
    && previous.selected === next.selected
    && previous.secondSelected === next.secondSelected
    && previous.voteCount === next.voteCount
    && previous.canManageNarrator === next.canManageNarrator
    && previous.canManageMayor === next.canManageMayor
    && previous.menuOpen === next.menuOpen
    && safePlayersEqual(previous.player, next.player);
}

function safePlayersEqual(previous: StageSeatPlayer, next: StageSeatPlayer) {
  return previous.userId === next.userId
    && previous.displayName === next.displayName
    && previous.connected === next.connected
    && previous.ready === next.ready
    && previous.playing === next.playing
    && previous.alive === next.alive
    && previous.host === next.host
    && previous.narrator === next.narrator
    && previous.acceptedFullNarrator === next.acceptedFullNarrator
    && previous.mayor === next.mayor
    && previous.hasVoted === next.hasVoted
    && previous.revealedRole === next.revealedRole;
}
