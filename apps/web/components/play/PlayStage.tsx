"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { GameFamily, GameMode, GamePhase } from "@werewolf/shared";
import { Check, Clock, Crown, Eye, Mic2, WifiOff } from "lucide-react";
import { avatarIdForUser } from "@/lib/avatar-catalog";
import { communicationBg, modeBg, narratorBg } from "@/lib/play/copy";
import { phaseBg } from "@/lib/play/phase-display";
import type { SeatLayoutItem } from "@/lib/play/seat-layout";
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
  lobbyInvitation?: ReactNode;
  activeRoomAction?: ReactNode;
}

type LayoutMode = "dense-table-grid" | "mobile-table-grid" | "lobby-table" | "active-table" | "crowded-table";

interface StageMeasurements {
  mode: LayoutMode;
  compact: boolean;
  sceneTop: number;
  sceneWidth: number;
  sceneHeight: number;
}

const INITIAL_MEASUREMENTS: StageMeasurements = {
  mode: "dense-table-grid",
  compact: false,
  sceneTop: 132,
  sceneWidth: 760,
  sceneHeight: 360,
};

const LOBBY_STATUSES = {
  disconnected: { label: "Без връзка", Icon: WifiOff, state: "disconnected" },
  narrator: { label: "Разказвач", Icon: Mic2, state: "observer" },
  observer: { label: "Наблюдава", Icon: Eye, state: "observer" },
  ready: { label: "Готов", Icon: Check, state: "ready" },
  waiting: { label: "Не е готов", Icon: Clock, state: "waiting" },
} as const;

const LOBBY_EIGHT_SEATS = [[0.5, 0.34], [0.69, 0.38], [0.81, 0.60], [0.65, 0.80], [0.42, 0.81], [0.26, 0.73], [0.17, 0.53], [0.31, 0.385]] as const;
const LOBBY_TWELVE_SEATS = [[0.26, 0.36], [0.42, 0.34], [0.58, 0.34], [0.74, 0.36], [0.85, 0.58], [0.85, 0.80], [0.65, 0.87], [0.48, 0.87], [0.31, 0.87], [0.15, 0.80], [0.15, 0.58], [0.15, 0.37]] as const;
const ACTIVE_EIGHT_SEATS = [[0.5, 0.315], [0.685, 0.35], [0.80, 0.525], [0.715, 0.765], [0.5, 0.835], [0.28, 0.765], [0.195, 0.525], [0.315, 0.35]] as const;
const ACTIVE_TWELVE_SEATS = [[0.30, 0.32], [0.43, 0.285], [0.57, 0.285], [0.70, 0.32], [0.83, 0.50], [0.83, 0.73], [0.66, 0.855], [0.50, 0.885], [0.34, 0.855], [0.17, 0.73], [0.17, 0.50], [0.20, 0.325]] as const;
const COMPACT_EIGHT_SEATS = [[0.5, 0.26], [0.685, 0.31], [0.80, 0.525], [0.715, 0.765], [0.5, 0.85], [0.28, 0.765], [0.195, 0.525], [0.315, 0.31]] as const;
const COMPACT_TWELVE_SEATS = [[0.32, 0.31], [0.435, 0.28], [0.55, 0.27], [0.665, 0.28], [0.78, 0.31], [0.89, 0.50], [0.81, 0.77], [0.67, 0.86], [0.48, 0.86], [0.29, 0.86], [0.14, 0.77], [0.14, 0.48]] as const;

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
  lobbyInvitation,
  activeRoomAction,
}: PlayStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const menuTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const [measurements, setMeasurements] = useState(INITIAL_MEASUREMENTS);
  const [hasMeasured, setHasMeasured] = useState(false);
  const [openMenuUserId, setOpenMenuUserId] = useState("");
  const publicPlayers = useMemo(() => players.map(toStageSeatPlayer), [players]);
  const participants = publicPlayers.filter((player) => player.playing);
  const seatedPlayers = phase === "lobby" ? publicPlayers : participants;
  const loadingSeatCount = 6;
  const seatCount = hasSnapshot ? seatedPlayers.length : loadingSeatCount;
  const aliveCount = participants.filter((player) => player.alive).length;
  const eliminatedCount = participants.length - aliveCount;
  const seatDensity = seatCount >= 13 ? "crowded" : seatCount >= 10 ? "full" : "open";
  const isNight = phase === "first_night" || phase === "night";
  const currentSpeaker = publicPlayers.find((player) => player.userId === currentSpeakerUserId);
  const currentDefender = publicPlayers.find((player) => player.userId === currentDefenseUserId);
  const titleId = "play-stage-title";
  const canManageNarrator = Boolean(ownPlayer?.host && narratorMode !== "automatic" && phase === "lobby");
  const canManageMayor = (player: StageSeatPlayer) => Boolean(
    (ownPlayer?.host || ownPlayer?.narrator)
      && mode === "werewolves_classic"
      && (phase === "lobby" || phase === "mayor_successor")
      && player.playing
      && player.alive,
  );
  const openMenuEligible = seatedPlayers.some(player => player.userId === openMenuUserId
    && !targetableIds.has(player.userId) && (canManageNarrator || canManageMayor(player)));

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
      const shortDesktop = window.matchMedia("(min-width: 1366px) and (max-height: 960px)").matches;
      const activeOvalFits = window.matchMedia("(min-width: 1366px)").matches
        && stageRect.width >= 1200
        && seatCount >= 3 && seatCount <= 12
        && sceneTop <= stageRect.width * 0.135;
      const crowdedOvalFits = !viewportRequiresGrid && stageRect.width >= 980
        && seatCount > 12 && seatCount <= 30 && sceneTop <= 300
        && stageRect.width * 0.88 / (Math.ceil(seatCount / 2) - 1) >= 78
        && (parseFloat(getComputedStyle(stage).fontSize) || 16) <= 18;
      const nextMode: LayoutMode = crowdedOvalFits ? "crowded-table" : phase !== "lobby"
        ? activeOvalFits ? "active-table" : viewportRequiresGrid ? "mobile-table-grid" : "dense-table-grid"
        : !viewportRequiresGrid && sceneWidth >= 700 && sceneHeight >= 236
          ? "lobby-table" : "mobile-table-grid";

      setMeasurements((current) => {
        const next = { mode: nextMode, compact: phase !== "lobby" && shortDesktop, sceneTop, sceneWidth, sceneHeight };
        return current.mode === next.mode
          && current.compact === next.compact
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
    window.addEventListener("resize", measure);
    const initialFrame = window.requestAnimationFrame(measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.cancelAnimationFrame(initialFrame);
    };
  }, [phase, seatCount]);

  const seatLayout = useMemo(() => {
    if (measurements.mode === "crowded-table") {
      const upperCount = Math.ceil(seatCount / 2);
      const size = Math.min(76, Math.floor(measurements.sceneWidth * 0.88 / (upperCount - 1)) - 26);
      // Two facing arcs leave the instrument clear and retain clockwise seat order.
      return Array.from({ length: seatCount }, (_, index): SeatLayoutItem => {
        const upper = index < upperCount;
        const rowCount = upper ? upperCount : seatCount - upperCount;
        const progress = upper ? index / (rowCount - 1) : 1 - (index - upperCount) / (rowCount - 1);
        const curve = 1 - Math.sqrt(1 - (2 * progress - 1) ** 2);
        const x = measurements.sceneWidth * (0.06 + 0.88 * progress);
        const y = upper ? measurements.sceneTop + 62 + curve * 68
          : measurements.sceneHeight - (phase === "lobby" ? 88 : 66) - curve * 68;
        return { index, x, y, visualSize: size, hitSize: size, scale: 1, zIndex: 100 + Math.round(y),
          menuPlacement: { x: x < measurements.sceneWidth / 2 ? "right" : "left", y: upper ? "down" : "up" } };
      });
    }
    if (phase !== "lobby") {
      if (measurements.mode !== "active-table") return [];
      // The active room crops the header from the waiting plate; its seats use
      // that same physical oval, not a second CSS-generated tabletop.
      const anchors = measurements.compact
        ? seatCount >= 9 ? COMPACT_TWELVE_SEATS : COMPACT_EIGHT_SEATS
        : seatCount >= 9 ? ACTIVE_TWELVE_SEATS : ACTIVE_EIGHT_SEATS;
      return Array.from({ length: seatCount }, (_, index): SeatLayoutItem => {
        const anchor = anchors[Math.floor(index * anchors.length / seatCount)]!;
        const x = measurements.sceneWidth * anchor[0];
        const y = measurements.sceneHeight * anchor[1];
        const size = measurements.compact ? seatCount >= 9 ? 60 : 66 : seatCount >= 9 ? 82 : 104;
        return { index, x, y, visualSize: size, hitSize: size, scale: 1, zIndex: 100 + Math.round(y),
          menuPlacement: { x: x < measurements.sceneWidth / 2 ? "right" : "left", y: y > measurements.sceneHeight / 2 ? "up" : "down" } };
      });
    }
    if (phase === "lobby" && measurements.mode !== "mobile-table-grid" && seatCount <= 12 && seatCount >= 3) {
      // The waiting-room plate has a fixed oval; only public seats are overlaid.
      return Array.from({ length: seatCount }, (_, index): SeatLayoutItem => {
        const anchors = seatCount >= 9 ? LOBBY_TWELVE_SEATS : LOBBY_EIGHT_SEATS;
        const anchor = anchors[Math.floor(index * anchors.length / seatCount)]!;
        const x = measurements.sceneWidth * anchor[0];
        const y = measurements.sceneHeight * anchor[1];
        const size = seatCount >= 9 ? 76 : 96;
        return { index, x, y, visualSize: size, hitSize: size, scale: 1, zIndex: 100 + Math.round(y),
          menuPlacement: { x: x < measurements.sceneWidth / 2 ? "right" : "left", y: y > measurements.sceneHeight / 2 ? "up" : "down" } };
      });
    }
    return [];
  }, [measurements, seatCount, phase]);
  const measuredMode: LayoutMode = seatLayout.length === seatCount && seatCount >= 3
    ? measurements.mode
    : measurements.mode === "mobile-table-grid"
      ? "mobile-table-grid"
      : "dense-table-grid";
  const effectiveMode: LayoutMode = !hasMeasured ? "mobile-table-grid"
    : measurements.mode === "crowded-table" ? "crowded-table"
    : phase === "lobby" && measurements.mode !== "mobile-table-grid"
      ? seatCount >= 3 && seatCount <= 12 && measurements.sceneTop <= 280 ? "lobby-table" : "dense-table-grid"
      : measuredMode;
  const mobileGridColumns = seatCount <= 6 ? 2 : seatCount <= 9 ? 3 : 4;

  useLayoutEffect(() => {
    setOpenMenuUserId("");
  }, [phase]);

  useLayoutEffect(() => {
    if (!openMenuEligible) setOpenMenuUserId("");
  }, [openMenuEligible]);

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
    if (!openMenuEligible) {
      return;
    }
    // Clamp the rendered menu, including grids whose columns change in CSS.
    const controls = stageRef.current?.querySelector<HTMLElement>("[data-seat-menu-root][data-open='true'] [data-seat-menu-controls]");
    if (controls) {
      controls.style.transform = "";
      const { left, right } = controls.getBoundingClientRect();
      const offset = Math.max(8 - left, Math.min(0, document.documentElement.clientWidth - 8 - right));
      controls.style.transform = `translateX(${offset}px)`;
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
      if (controls) controls.style.transform = "";
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, openMenuUserId, openMenuEligible, measurements]);

  const stageStyle = {
    "--seat-count": Math.max(seatCount, 1),
    "--table-scene-top": `${measurements.sceneTop}px`,
    "--table-scene-height": `${measurements.sceneHeight}px`,
  } as CSSProperties;

  return (
    <section
      ref={stageRef}
      className={`${styles.stage} ${phase !== "lobby" ? styles.activeStage : ""} play-stage play-section`}
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
      <div ref={hudRef} className={styles.hud} data-stage-hud>
        <div className={styles.copy}>
          <p className={styles.kicker}>
            {phase === "lobby"
              ? `${modeBg(mode)} · ${mode === "mafia_sport" ? "Спортен формат" : "Класическа игра"}`
              : phase === "role_reveal"
                ? `${modeBg(mode)} · преди първата нощ`
                : `${modeBg(mode)} · ${isNight ? "нощ" : "ден"} ${round}`}
          </p>
          <h1 id={titleId} className={styles.title}>{phase === "lobby" ? "Масата се събира" : phaseBg(phase, mode)}</h1>
          {phase === "voting" ? <p className={styles.phaseQuestion}>
            {family === "mafia" ? "Кой ще напусне масата?" : "Кой ще напусне селото?"}
          </p> : null}
          {phase === "lobby" ? <>
            <p className="play-waiting-settings" aria-label="Настройки на масата">
              <span>{participants.length} участници</span><span>{narratorBg(narratorMode)}</span><span>{communicationBg(communicationMode)}</span>
            </p>
            {ownPlayer?.host ? <p className="play-waiting-host"><Crown aria-hidden="true" />Ти си домакин</p> : null}
          </> : null}
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
        {phase === "lobby" ? lobbyInvitation : <div className={styles.activeLedger} data-stage-ledger>
          <span className={styles.roomLabel}>Код на стаята</span>
          <div className={styles.roomCode}><strong>{code}</strong>{activeRoomAction}</div>
          <span className={styles.activeCounts} data-stage-counts>
            {`${aliveCount} ${aliveCount === 1 ? "жив" : "живи"}`}
            {eliminatedCount > 0 ? ` · ${eliminatedCount} ${eliminatedCount === 1 ? "елиминиран" : "елиминирани"}` : ""}
          </span>
        </div>}
      </div>

      <div ref={sceneRef} className={styles.tableScene} data-table-scene role="group" aria-label="Игрална маса">
        {phase === "lobby" ? <div className={styles.tableSurface} aria-hidden="true" /> : null}
        {phase !== "lobby" ? <div className={styles.core} data-table-core role="group" aria-label="Център на масата">
          <Timer endsAt={phaseEndsAt} presentation="instrument" />
        </div> : null}

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
            const menuOpen = openMenuEligible && openMenuUserId === player.userId;
            const menuId = `seat-menu-${index}`;
            const lobbyStatus = LOBBY_STATUSES[!player.connected ? "disconnected"
              : !player.playing ? (player.narrator ? "narrator" : "observer")
                : player.ready ? "ready" : "waiting"];
            const LobbySeatIcon = lobbyStatus.Icon;
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
                  canManageNarrator={canManageNarrator}
                  canManageMayor={canManageMayor(player)}
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
                {phase === "lobby" ? (
                  <span className={styles.lobbySeatStatus} data-lobby-seat-status
                    data-state={lobbyStatus.state}
                    title={`${player.displayName}${player.host ? " · Домакин" : ""} · ${lobbyStatus.label}`}
                  >
                    {player.host ? <Crown aria-label="Домакин" role="img" /> : null}
                    <LobbySeatIcon aria-hidden="true" />
                    <span>{lobbyStatus.label}</span>
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
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
