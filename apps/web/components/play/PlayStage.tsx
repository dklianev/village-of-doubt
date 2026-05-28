import type { CSSProperties } from "react";
import type { GameFamily, GameMode, GamePhase } from "@werewolf/shared";
import { communicationBg, modeBg } from "@/lib/play/copy";
import { phaseBg, phaseSigil } from "@/lib/play/phase-display";
import type { PublicPlayer } from "@/lib/play/types";
import { PlayerTokensSkeleton } from "@/components/skeleton";
import { PlayerTile } from "@/components/play/PlayerTile";
import { Timer } from "@/components/play/Timer";

interface PlayStageProps {
  code: string;
  phase: GamePhase;
  mode: GameMode;
  family: GameFamily;
  round: number;
  phaseEndsAt: number;
  players: PublicPlayer[];
  hasSnapshot: boolean;
  narratorMode: string;
  communicationMode: string;
  ownPlayer: PublicPlayer | undefined;
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
  players,
  hasSnapshot,
  narratorMode,
  communicationMode,
  ownPlayer,
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
        </div>
        <div className="play-stage-clock">
          <div className="phase-sigil" aria-hidden="true">
            {phaseSigil(phase)}
          </div>
          <Timer endsAt={phaseEndsAt} />
        </div>
      </div>

      <div className="play-table" aria-label="Игрална маса">
        <div className="play-table-core" aria-hidden="true">
          <span className="play-table-sigil">{phaseSigil(phase)}</span>
          <span>{aliveCount} живи</span>
          {eliminatedCount > 0 ? <span>{eliminatedCount} елиминирани</span> : null}
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
            const seatAngle = (360 / seatCount) * index - 90;
            return (
              <div
                key={player.userId}
                className="play-seat"
                style={{
                  "--seat-angle": `${seatAngle}deg`,
                  "--seat-angle-reverse": `${seatAngle * -1}deg`,
                } as CSSProperties}
              >
                <PlayerTile
                  player={player}
                  phase={phase}
                  narratorMode={narratorMode}
                  canManageNarrator={Boolean(ownPlayer?.host && narratorMode !== "automatic" && phase === "lobby")}
                  canManageMayor={Boolean(
                    (ownPlayer?.host || ownPlayer?.narrator)
                      && mode === "werewolves_classic"
                      && (phase === "lobby" || phase === "mayor_successor")
                      && player.playing
                      && player.alive,
                  )}
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
