import type { CSSProperties } from "react";
import type { GameFamily, GameMode, GamePhase } from "@werewolf/shared";
import { communicationBg, modeBg } from "@/lib/play/copy";
import { phaseBg, phaseSigil } from "@/lib/play/phase-display";
import type { PublicPlayer } from "@/lib/play/types";
import { PlayerTokensSkeleton } from "@/components/skeleton";
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
  const seatCount = Math.max(seatedPlayers.length, 1);
  const aliveCount = players.filter((player) => player.playing && player.alive).length;
  const eliminatedCount = players.filter((player) => player.playing && !player.alive).length;
  const seatDensity = seatCount >= 13 ? "crowded" : seatCount >= 9 ? "full" : "open";
  const titleId = "play-stage-title";

  return (
    <section
      className="play-stage play-section"
      data-family={family}
      data-seat-density={seatDensity}
      aria-labelledby={titleId}
      style={{ "--seat-count": seatCount } as CSSProperties}
    >
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

      <div className="play-table" aria-label="Игрална маса">
        <div className="play-table-core" aria-label="Център на масата">
          <span className="play-table-sigil" aria-hidden="true">{phaseSigil(phase)}</span>
          <Timer endsAt={phaseEndsAt} />
          <span className="play-table-counts">
            {aliveCount} живи
            {eliminatedCount > 0 ? ` · ${eliminatedCount} елиминирани` : ""}
          </span>
        </div>

        <div className="play-seat-ring">
          {!hasSnapshot ? <PlayerTokensSkeleton /> : null}
          {hasSnapshot && players.length === 0 ? (
            <div className="empty-state-card empty-players-card play-stage-empty rounded-[2rem] p-5">
              <span aria-hidden="true" />
              <strong>Площадът още е празен</strong>
              <p>Поканата чака първите телефони около масата.</p>
            </div>
          ) : null}
          {seatedPlayers.map((player, index) => {
            const seatAngle = getSeatAngle(index, seatCount);
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
                style={{
                  "--seat-angle": `${seatAngle}deg`,
                  "--seat-angle-reverse": `${seatAngle * -1}deg`,
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

  const [start, end] = seatCount <= 2 ? [120, 240] : seatCount <= 4 ? [90, 270] : [70, 290];
  return start + ((end - start) / (seatCount - 1)) * index;
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
