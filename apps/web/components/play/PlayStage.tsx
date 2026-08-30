"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { GameFamily, GameMode, GamePhase } from "@werewolf/shared";
import { avatarIdForUser } from "@/lib/avatar-catalog";
import { communicationBg, modeBg } from "@/lib/play/copy";
import { phaseBg, phaseSigil } from "@/lib/play/phase-display";
import { computeSeatLayout, type SeatLayoutItem } from "@/lib/play/seat-layout";
import type { PublicPlayer } from "@/lib/play/types";
import { PlaySeat, type StageSeatPlayer } from "@/components/play/PlaySeat";
import { Timer } from "@/components/play/Timer";
import styles from "./PlayStage.module.css";

interface PlayStageProps {
  code: string;
  phase: GamePhase;
  mode: GameMode;
  family: GameFamily;
  round: number;
  phaseEndsAt: number;
  isPending: boolean;
  players: PublicPlayer[];
  hasSnapshot: boolean;
  narratorMode: string;
  communicationMode: string;
  ownPlayer: PublicPlayer | undefined;
  targetableIds: Set<string>;
  shortcutNumbers: Map<string, number>;
  selectedTargetId: string;
  secondTargetId: string;
  voteCounts: Map<string, number>;
  currentSpeakerUserId: string;
  currentDefenseUserId: string;
  nomineeIds: Set<string>;
  onSelectSeat: (targetUserId: string) => void;
  onMakeNarrator: (targetUserId: string) => void;
  onMakeMayor: (targetUserId: string) => void;
}

type LayoutMode = "full-table" | "compact-table" | "dense-table-grid" | "mobile-table-grid";

interface StageMeasurements {
  mode: LayoutMode;
  sceneTop: number;
  sceneWidth: number;
  sceneHeight: number;
}

const INITIAL_MEASUREMENTS: StageMeasurements = {
  mode: "compact-table",
  sceneTop: 132,
  sceneWidth: 760,
  sceneHeight: 360,
};

export function PlayStage({
  code,
  phase,
  mode,
  family,
  round,
  phaseEndsAt,
  isPending,
  players,
  hasSnapshot,
  narratorMode,
  communicationMode,
  ownPlayer,
  targetableIds,
  shortcutNumbers,
  selectedTargetId,
  secondTargetId,
  voteCounts,
  currentSpeakerUserId,
  currentDefenseUserId,
  nomineeIds,
  onSelectSeat,
  onMakeNarrator,
  onMakeMayor,
}: PlayStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const menuTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const [measurements, setMeasurements] = useState(INITIAL_MEASUREMENTS);
  const [hasMeasured, setHasMeasured] = useState(false);
  const [openMenuUserId, setOpenMenuUserId] = useState("");
  const publicPlayers = useMemo(() => players.map(toStageSeatPlayer), [players]);
  const seatedPlayers = phase === "lobby" ? publicPlayers : publicPlayers.filter((player) => player.playing);
  const loadingSeatCount = 6;
  const seatCount = hasSnapshot ? seatedPlayers.length : loadingSeatCount;
  const aliveCount = publicPlayers.filter((player) => player.playing && player.alive).length;
  const eliminatedCount = publicPlayers.filter((player) => player.playing && !player.alive).length;
  const seatDensity = seatCount >= 14 ? "crowded" : seatCount >= 10 ? "full" : "open";
  const isNight = phase === "first_night" || phase === "night";
  const currentSpeaker = publicPlayers.find((player) => player.userId === currentSpeakerUserId);
  const currentDefender = publicPlayers.find((player) => player.userId === currentDefenseUserId);
  const titleId = "play-stage-title";

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const hud = hudRef.current;
    const scene = sceneRef.current;
    if (!stage || !hud || !scene || typeof ResizeObserver !== "function") {
      return;
    }

    const measure = () => {
      const stageRect = stage.getBoundingClientRect();
      const hudRect = hud.getBoundingClientRect();
      const sceneTop = Math.max(104, hudRect.bottom - stageRect.top + 16);
      const sceneWidth = scene.clientWidth;
      const sceneHeight = scene.clientHeight;
      const viewportRequiresGrid = window.matchMedia("(max-width: 1023px)").matches;
      const nextMode: LayoutMode = viewportRequiresGrid
        ? "mobile-table-grid"
        : sceneWidth >= 800 && sceneHeight >= 320
          ? "full-table"
          : sceneWidth >= 700 && sceneHeight >= 236
            ? "compact-table"
            : "mobile-table-grid";

      setMeasurements((current) => {
        const next = { mode: nextMode, sceneTop, sceneWidth, sceneHeight };
        return current.mode === next.mode
          && Math.abs(current.sceneTop - next.sceneTop) < 1
          && Math.abs(current.sceneWidth - next.sceneWidth) < 1
          && Math.abs(current.sceneHeight - next.sceneHeight) < 1
          ? current
          : next;
      });
      setHasMeasured(true);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(hud);
    observer.observe(scene);
    const initialFrame = window.requestAnimationFrame(measure);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(initialFrame);
    };
  }, []);

  const seatLayout = useMemo(() => {
    if (measurements.mode === "mobile-table-grid" || seatCount < 3 || seatCount > 18) {
      return [];
    }
    try {
      const coreSize = measurements.mode === "compact-table" ? 136 : 160;
      const coreCenterYRatio = measurements.mode === "compact-table" || seatCount >= 10 ? 0.5 : 0.57;
      return computeSeatLayout({
        contentWidth: measurements.sceneWidth,
        contentHeight: measurements.sceneHeight,
        count: seatCount,
        reservedHud: { x: 0, y: 0, width: 0, height: 0 },
        reservedCenter: {
          x: measurements.sceneWidth / 2 - coreSize / 2,
          y: measurements.sceneHeight * coreCenterYRatio - coreSize / 2,
          width: coreSize,
          height: coreSize,
        },
        minHitSize: 44,
      });
    } catch {
      return [];
    }
  }, [measurements, seatCount]);
  const measuredMode: LayoutMode = seatLayout.length === seatCount && seatCount >= 3
    ? measurements.mode
    : measurements.mode === "mobile-table-grid"
      ? "mobile-table-grid"
      : "dense-table-grid";
  const effectiveMode: LayoutMode = !hasMeasured ? "mobile-table-grid" : measuredMode;
  const mobileGridColumns = seatCount <= 6 ? 2 : seatCount <= 9 ? 3 : 4;

  const closeMenu = useCallback((restoreFocus: boolean) => {
    setOpenMenuUserId((current) => {
      if (restoreFocus && current) {
        const trigger = menuTriggerRefs.current.get(current);
        window.requestAnimationFrame(() => trigger?.focus());
      }
      return "";
    });
  }, []);

  useLayoutEffect(() => {
    if (!openMenuUserId) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-seat-menu-root]")) {
        closeMenu(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMenu(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, openMenuUserId]);

  const stageStyle = {
    "--seat-count": Math.max(seatCount, 1),
    "--table-scene-top": `${measurements.sceneTop}px`,
    "--table-scene-height": `${measurements.sceneHeight}px`,
  } as CSSProperties;

  return (
    <section
      ref={stageRef}
      className={`${styles.stage} play-stage play-section`}
      data-family={family}
      data-phase={phase}
      data-night={isNight ? "true" : undefined}
      data-seat-density={seatDensity}
      data-seat-count={seatCount}
      data-layout-mode={effectiveMode}
      data-layout-ready={hasMeasured ? "true" : undefined}
      aria-labelledby={titleId}
      aria-hidden={phase === "game_over" ? true : undefined}
      inert={phase === "game_over" ? true : undefined}
      style={stageStyle}
    >
      <div className={styles.atmosphereBack} aria-hidden="true" />
      <div className={styles.atmosphereFront} aria-hidden="true" />

      <div ref={hudRef} className={styles.hud} data-stage-hud>
        <div className={styles.copy}>
          <p className={styles.kicker}>стая {code} · рунд {round}</p>
          <div className={styles.phasePill}>
            <span className={styles.phaseDot} aria-hidden />
            <span>Фаза: {phaseBg(phase, mode)}</span>
          </div>
          <h1 id={titleId} className={styles.title}>{phaseBg(phase, mode)}</h1>
          {currentSpeaker || currentDefender ? (
            <p className={styles.dayFocus} aria-live="polite">
              {currentSpeaker ? `Говори: ${currentSpeaker.displayName}` : `Защита: ${currentDefender?.displayName}`}
            </p>
          ) : null}
          {isPending ? (
            <p className={styles.status} aria-live="polite" aria-atomic="true">
              Обновяване...
            </p>
          ) : null}
        </div>
      </div>

      <div ref={sceneRef} className={styles.tableScene} data-table-scene role="group" aria-label="Игрална маса">
        <div className={styles.tableSurface} aria-hidden="true" />
        <div className={styles.core} data-table-core role="group" aria-label="Център на масата">
          <span className={styles.sigil} aria-hidden="true">{phaseSigil(phase)}</span>
          <Timer endsAt={phaseEndsAt} />
          <span className={styles.counts}>
            {aliveCount} {aliveCount === 1 ? "жив" : "живи"}
            {eliminatedCount > 0
              ? ` · ${eliminatedCount} ${eliminatedCount === 1 ? "елиминиран" : "елиминирани"}`
              : ""}
          </span>
        </div>

        <div className={styles.seatRing} data-seat-ring>
          {!hasSnapshot
            ? Array.from({ length: loadingSeatCount }).map((_, index) => renderSkeleton(index, seatLayout[index], effectiveMode))
            : null}
          {hasSnapshot && players.length === 0 ? (
            <div className={styles.emptyState}>
              <strong>Площадът още е празен</strong>
              <p>Поканата чака първите телефони около масата.</p>
            </div>
          ) : null}
          {seatedPlayers.map((player, index) => {
            const geometry = seatLayout[index];
            const isMobileGrid = effectiveMode === "mobile-table-grid";
            const isMobileStartEdge = isMobileGrid && index % mobileGridColumns === 0;
            const isMobileLastRow = isMobileGrid && index >= seatCount - mobileGridColumns;
            const targetable = targetableIds.has(player.userId);
            const selected = selectedTargetId === player.userId;
            const secondSelected = secondTargetId === player.userId;
            const menuOpen = openMenuUserId === player.userId;
            const menuId = `seat-menu-${index}`;
            return (
              <div
                key={player.userId}
                className={`${styles.seatSlot} play-seat-slot`}
                data-current={player.userId === ownPlayer?.userId ? "true" : undefined}
                data-targetable={targetable ? "true" : undefined}
                data-selected={selected ? "true" : undefined}
                data-second-selected={secondSelected ? "true" : undefined}
                data-voted={player.hasVoted ? "true" : undefined}
                data-alive={player.alive ? "true" : "false"}
                data-ready={player.ready ? "true" : "false"}
                data-connected={player.connected ? "true" : "false"}
                data-menu-open={menuOpen ? "true" : undefined}
                data-speaking={player.userId === currentSpeakerUserId ? "true" : undefined}
                data-defending={player.userId === currentDefenseUserId ? "true" : undefined}
                data-nominee={nomineeIds.has(player.userId) ? "true" : undefined}
                data-menu-x={geometry?.menuPlacement.x ?? (isMobileStartEdge ? "mobile-start" : undefined)}
                data-menu-y={geometry?.menuPlacement.y ?? (isMobileLastRow ? "up" : undefined)}
                style={effectiveMode.endsWith("table-grid") ? undefined : seatStyle(geometry)}
              >
                <PlaySeat
                  player={player}
                  phase={phase}
                  narratorMode={narratorMode}
                  targetable={targetable}
                  {...(shortcutNumbers.has(player.userId)
                    ? { shortcutNumber: shortcutNumbers.get(player.userId)! }
                    : {})}
                  selected={selected}
                  secondSelected={secondSelected}
                  voteCount={voteCounts.get(player.userId) ?? 0}
                  speaking={player.userId === currentSpeakerUserId}
                  defending={player.userId === currentDefenseUserId}
                  nominee={nomineeIds.has(player.userId)}
                  canManageNarrator={Boolean(ownPlayer?.host && narratorMode !== "automatic" && phase === "lobby")}
                  canManageMayor={Boolean(
                    (ownPlayer?.host || ownPlayer?.narrator)
                      && mode === "werewolves_classic"
                      && (phase === "lobby" || phase === "mayor_successor")
                      && player.playing
                      && player.alive,
                  )}
                  menuId={menuId}
                  menuOpen={menuOpen}
                  menuTriggerRef={(node) => {
                    if (node) {
                      menuTriggerRefs.current.set(player.userId, node);
                    } else {
                      menuTriggerRefs.current.delete(player.userId);
                    }
                  }}
                  onMenuToggle={(open) => setOpenMenuUserId(open ? player.userId : "")}
                  onMenuActionComplete={() => closeMenu(true)}
                  onSelect={() => onSelectSeat(player.userId)}
                  onMakeNarrator={() => onMakeNarrator(player.userId)}
                  onMakeMayor={() => onMakeMayor(player.userId)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.ledger} data-stage-ledger aria-hidden="true">
        <span>{modeBg(mode)}</span>
        <span>{communicationBg(communicationMode)}</span>
      </div>
    </section>
  );
}

function toStageSeatPlayer(player: PublicPlayer): StageSeatPlayer {
  return {
    userId: player.userId,
    displayName: player.displayName,
    avatarId: avatarIdForUser(player.userId, player.avatarId),
    connected: player.connected,
    ready: player.ready,
    playing: player.playing,
    alive: player.alive,
    host: player.host,
    narrator: player.narrator,
    acceptedFullNarrator: player.acceptedFullNarrator,
    mayor: player.mayor,
    hasVoted: player.hasVoted,
    revealedRole: player.revealedRole,
  };
}

function seatStyle(geometry: SeatLayoutItem | undefined) {
  if (!geometry) {
    return undefined;
  }
  return {
    "--seat-x": `${geometry.x}px`,
    "--seat-y": `${geometry.y}px`,
    "--seat-visual-size": `${Math.round(geometry.visualSize * geometry.scale)}px`,
    "--seat-hit-size": `${Math.ceil(geometry.hitSize)}px`,
    zIndex: geometry.zIndex,
  } as CSSProperties;
}

function renderSkeleton(index: number, geometry: SeatLayoutItem | undefined, layoutMode: LayoutMode) {
  return (
    <div
      key={index}
      className={`${styles.seatSlot} ${styles.skeletonSlot} play-seat-skeleton`}
      aria-hidden="true"
      style={layoutMode.endsWith("table-grid") ? undefined : seatStyle(geometry)}
    >
      <span className={styles.skeletonPortrait} />
      <span className={styles.skeletonName} />
    </div>
  );
}
