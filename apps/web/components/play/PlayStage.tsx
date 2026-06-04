import type { CSSProperties } from "react";
import type { GameFamily, GameMode, GamePhase } from "@werewolf/shared";
import { communicationBg, modeBg } from "@/lib/play/copy";
import { phaseBg, phaseSigil } from "@/lib/play/phase-display";
import type { PublicPlayer } from "@/lib/play/types";
import { PlaySeat } from "@/components/play/PlaySeat";
import { Timer } from "@/components/play/Timer";

interface PlayStageProps {
  code: string;
  phase: GamePhase;
  mode: GameMode;
  family: GameFamily;
  round: number;
  phaseEndsAt: number;
  status: string;
  isStatusInformative: boolean;
  isPending: boolean;
  players: PublicPlayer[];
  hasSnapshot: boolean;
  narratorMode: string;
  communicationMode: string;
  ownPlayer: PublicPlayer | undefined;
  targetableIds: Set<string>;
  selectedTargetId: string;
  secondTargetId: string;
  voteCounts: Map<string, number>;
  onSelectSeat: (targetUserId: string) => void;
  onMakeNarrator: (targetUserId: string) => void;
  onMakeMayor: (targetUserId: string) => void;
}

export function PlayStage({
  code,
  phase,
  mode,
  family,
  round,
  phaseEndsAt,
  status,
  isStatusInformative,
  isPending,
  players,
  hasSnapshot,
  narratorMode,
  communicationMode,
  ownPlayer,
  targetableIds,
  selectedTargetId,
  secondTargetId,
  voteCounts,
  onSelectSeat,
  onMakeNarrator,
  onMakeMayor,
}: PlayStageProps) {
  const seatedPlayers = (phase === "lobby" ? players : players.filter((player) => player.playing));
  const loadingSeatCount = 6;
  const seatCount = hasSnapshot ? Math.max(seatedPlayers.length, 1) : loadingSeatCount;
  const aliveCount = players.filter((player) => player.playing && player.alive).length;
  const eliminatedCount = players.filter((player) => player.playing && !player.alive).length;
  const seatDensity = seatCount >= 13 ? "crowded" : seatCount >= 9 ? "full" : "open";
  const openSeatWidth = seatDensity === "open" ? Math.max(52, Math.min(92, 116 - seatCount * 8)) : undefined;
  const openSeatAvatar = openSeatWidth ? Math.max(40, Math.min(66, Math.round(openSeatWidth * 0.72))) : undefined;
  const isNight = phase === "first_night" || phase === "night";
  const titleId = "play-stage-title";
  const stageStyle = {
    "--seat-count": seatCount,
    ...(openSeatWidth
      ? {
          "--open-seat-width": `${openSeatWidth}px`,
          "--open-seat-avatar": `${openSeatAvatar}px`,
          "--open-seat-gap": openSeatWidth >= 76 ? "6px" : "4px",
          "--open-seat-padding": openSeatWidth >= 76 ? "5px 4px 7px" : "3px 2px 5px",
          "--open-seat-name-size": openSeatWidth >= 84 ? "0.78rem" : openSeatWidth >= 76 ? "0.72rem" : "0.66rem",
        }
      : {}),
  } as CSSProperties;

  return (
    <section
      className="play-stage play-section"
      data-family={family}
      data-night={isNight ? "true" : undefined}
      data-seat-density={seatDensity}
      aria-labelledby={titleId}
      style={stageStyle}
    >
      <div className="play-stage-fog" aria-hidden="true" />
      <div className="play-stage-hud">
        <div className="play-stage-copy">
          <p className="phase-kicker">стая {code} · рунд {round}</p>
          <div className="play-phase-pill" aria-label={`Фаза: ${phaseBg(phase, mode)}`}>
            <span className="play-phase-dot" aria-hidden />
            <span>Фаза: {phaseBg(phase, mode)}</span>
          </div>
          <h1 id={titleId} className="play-stage-title">{phaseBg(phase, mode)}</h1>
          {isStatusInformative || isPending ? (
            <p className="play-stage-status" aria-live="polite" aria-atomic="true">
              {isStatusInformative ? status : ""}
              {isPending ? " Обновяване..." : ""}
            </p>
          ) : null}
        </div>
      </div>

      <div className="play-table" role="group" aria-label="Игрална маса">
        <div className="play-table-core" role="group" aria-label="Център на масата">
          <span className="play-table-sigil" aria-hidden="true">{phaseSigil(phase)}</span>
          <Timer endsAt={phaseEndsAt} />
          <span className="play-table-counts">
            {aliveCount} живи
            {eliminatedCount > 0 ? ` · ${eliminatedCount} елиминирани` : ""}
          </span>
        </div>
      </div>

      <div className="play-seat-ring">
        {!hasSnapshot
          ? Array.from({ length: loadingSeatCount }).map((_, index) => {
              const seatAngle = getSeatAngle(index, loadingSeatCount);
              const seatPosition = getSeatPosition(index, loadingSeatCount);
              return (
                <div
                  key={index}
                  className="play-seat play-seat-skeleton"
                  aria-hidden="true"
                  style={{
                    "--seat-angle": `${seatAngle}deg`,
                    "--seat-angle-reverse": `${seatAngle * -1}deg`,
                    "--seat-x": `${seatPosition.x}%`,
                    "--seat-y": `${seatPosition.y}%`,
                  } as CSSProperties}
                >
                  <div className="play-seat-token">
                    <span className="play-seat-avatar skeleton" />
                    <span className="play-seat-name skeleton" />
                    <span className="play-seat-state skeleton" />
                  </div>
                </div>
              );
            })
          : null}
        {hasSnapshot && players.length === 0 ? (
          <div className="empty-state-card empty-players-card play-stage-empty rounded-[2rem] p-5">
            <span aria-hidden="true" />
            <strong>Площадът още е празен</strong>
            <p>Поканата чака първите телефони около масата.</p>
          </div>
        ) : null}
        {seatedPlayers.map((player, index) => {
          const seatAngle = getSeatAngle(index, seatCount);
          const seatPosition = getSeatPosition(index, seatCount);
          const seatMenuPlacement = getSeatMenuPlacement(seatAngle, seatPosition);
          const seatState = getSeatState(player, phase);
          const targetable = targetableIds.has(player.userId);
          const selected = selectedTargetId === player.userId;
          const secondSelected = secondTargetId === player.userId;
          return (
            <div
              key={player.userId}
              className="play-seat"
              data-current={player.userId === ownPlayer?.userId ? "true" : undefined}
              data-targetable={targetable ? "true" : undefined}
              data-selected={selected ? "true" : undefined}
              data-second-selected={secondSelected ? "true" : undefined}
              data-voted={player.hasVoted ? "true" : undefined}
              data-seat-state={seatState}
              data-menu-x={seatMenuPlacement.x}
              data-menu-y={seatMenuPlacement.y}
              style={{
                "--seat-angle": `${seatAngle}deg`,
                "--seat-angle-reverse": `${seatAngle * -1}deg`,
                "--seat-x": `${seatPosition.x}%`,
                "--seat-y": `${seatPosition.y}%`,
              } as CSSProperties}
            >
              <PlaySeat
                player={player}
                phase={phase}
                narratorMode={narratorMode}
                targetable={targetable}
                selected={selected}
                secondSelected={secondSelected}
                voteCount={voteCounts.get(player.userId) ?? 0}
                canManageNarrator={Boolean(ownPlayer?.host && narratorMode !== "automatic" && phase === "lobby")}
                canManageMayor={Boolean(
                  (ownPlayer?.host || ownPlayer?.narrator)
                    && mode === "werewolves_classic"
                    && (phase === "lobby" || phase === "mayor_successor")
                    && player.playing
                    && player.alive,
                )}
                onSelect={() => onSelectSeat(player.userId)}
                onMakeNarrator={() => onMakeNarrator(player.userId)}
                onMakeMayor={() => onMakeMayor(player.userId)}
              />
            </div>
          );
        })}
      </div>

      <div className="play-stage-ledger" aria-hidden="true">
        <span>{modeBg(mode)}</span>
        <span>{communicationBg(communicationMode)}</span>
      </div>
    </section>
  );
}

function getSeatAngle(index: number, seatCount: number) {
  if (seatCount <= 1) {
    return 180;
  }

  // Seats ring the table along an arc with a gap kept clear at the top, where the
  // HUD presides (angle 0 = straight up). Dense tables get a smaller but still
  // meaningful gap and rely on compact medallions/radius tuning in CSS.
  const topGap =
    seatCount <= 4 ? 160 : seatCount <= 8 ? 118 : seatCount <= 12 ? 132 : 120;
  const span = 360 - topGap;
  return topGap / 2 + (span / (seatCount - 1)) * index;
}

function getSeatPosition(index: number, seatCount: number) {
  if (seatCount < 9) {
    // Oval table: place seats on an ellipse expressed in ring-box percentages
    // (like the dense perimeter below) instead of a fixed pixel radius. A circle
    // is taller than the height-locked desktop stage and its bottom seats fall
    // out of the stage's overflow:hidden box; percentages always stay inside.
    // Seats hug the left/right arcs with a gap kept clear at the top (HUD) AND
    // the bottom-centre, so no medallion ever lands on the central timer core.
    const rx = 48;
    const ry = 38;
    const topGap = seatCount <= 4 ? 90 : seatCount === 5 ? 70 : seatCount === 6 ? 80 : 112;
    const bottomGap = seatCount <= 4 ? 70 : seatCount === 5 ? 80 : seatCount === 6 ? 60 : 46;
    const rightCount = Math.ceil(seatCount / 2);
    const leftCount = seatCount - rightCount;
    let deg: number;
    if (index < rightCount) {
      const start = topGap / 2;
      const end = 180 - bottomGap / 2;
      deg = rightCount <= 1 ? (start + end) / 2 : start + ((end - start) / (rightCount - 1)) * index;
    } else {
      const j = index - rightCount;
      const start = 180 + bottomGap / 2;
      const end = 360 - topGap / 2;
      deg = leftCount <= 1 ? (start + end) / 2 : start + ((end - start) / (leftCount - 1)) * j;
    }
    const angle = (deg * Math.PI) / 180;
    return { x: 50 + rx * Math.sin(angle), y: 50 - ry * Math.cos(angle) };
  }

  const crowded = seatCount >= 13;
  const topCount = crowded
    ? Math.min(5, Math.max(4, Math.ceil(seatCount * 0.3)))
    : 2;
  const bottomCount = topCount;
  const sideSlots = Math.max(0, seatCount - topCount - bottomCount);
  const rightCount = Math.ceil(sideSlots / 2);
  const leftCount = sideSlots - rightCount;

  if (index < topCount) {
    return { x: spread(crowded ? 78 : 72, crowded ? 22 : 28, topCount, index), y: crowded ? 0 : 8 };
  }

  const rightIndex = index - topCount;
  if (rightIndex < rightCount) {
    return { x: crowded ? 97 : 94, y: spread(crowded ? 16 : 8, crowded ? 84 : 98, rightCount, rightIndex) };
  }

  const bottomIndex = rightIndex - rightCount;
  if (bottomIndex < bottomCount) {
    return { x: spread(crowded ? 78 : 72, crowded ? 22 : 28, bottomCount, bottomIndex), y: crowded ? 100 : 98 };
  }

  const leftIndex = bottomIndex - bottomCount;
  return { x: crowded ? 3 : 6, y: spread(crowded ? 84 : 98, crowded ? 16 : 8, leftCount, leftIndex) };
}

function getSeatMenuPlacement(angle: number, position: { x: number; y: number }) {
  const radians = (angle * Math.PI) / 180;
  const radialX = Math.sin(radians);
  const radialY = -Math.cos(radians);
  const x = position.x <= 28 || (position.x === 50 && radialX < -0.34)
    ? "right"
    : "left";
  const y = position.y >= 72 || (position.y === 50 && radialY > 0.34)
    ? "up"
    : "down";

  return { x, y };
}

function spread(start: number, end: number, count: number, index: number) {
  if (count <= 1) {
    return (start + end) / 2;
  }
  return start + ((end - start) / (count - 1)) * index;
}

function getSeatState(player: PublicPlayer, phase: GamePhase) {
  if (!player.playing) {
    return "bench";
  }
  if (!player.alive) {
    return "dead";
  }
  if (player.actedThisPhase || player.hasVoted) {
    return "active";
  }
  if (phase === "lobby" && player.ready) {
    return "ready";
  }
  return "idle";
}
