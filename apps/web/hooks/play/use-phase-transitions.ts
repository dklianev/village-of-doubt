"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Room } from "@colyseus/sdk";
import type { GamePhase } from "@werewolf/shared";
import { playCue } from "@/lib/sound";
import { triggerDeviceCue } from "@/lib/play/device-cues";
import type { CueMode, PublicEvent } from "@/lib/play/types";

interface UsePhaseTransitionsOptions {
  room: Room | null;
  connected: boolean;
  phase: GamePhase | null;
  publicEvents: PublicEvent[];
  winnerTeam: string;
  liveMode: boolean;
  cueMode: CueMode;
  suppressNextPhasePulseRef: MutableRefObject<boolean>;
}

export interface UsePhaseTransitionsResult {
  phasePulse: number;
  showPhaseTransition: boolean;
  startCountdown: number | null;
  requestStartGame: () => void;
}

export function usePhaseTransitions({
  room,
  connected,
  phase,
  publicEvents,
  winnerTeam,
  liveMode,
  cueMode,
  suppressNextPhasePulseRef,
}: UsePhaseTransitionsOptions): UsePhaseTransitionsResult {
  const [phasePulse, setPhasePulse] = useState(0);
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const previousCuePhaseRef = useRef<string | null>(null);
  const observedRef = useRef<{ room: Room | null; eventIds: Set<string>; winnerTeam: string } | null>(null);
  const startGameTimersRef = useRef<number[]>([]);
  const forceSilent = liveMode || cueMode !== "audio_vibration";

  const clearStartGameTimers = useCallback(() => {
    for (const timeout of startGameTimersRef.current) {
      window.clearTimeout(timeout);
    }
    startGameTimersRef.current = [];
  }, []);

  useEffect(() => {
    setStartCountdown(null);
    return () => clearStartGameTimers();
  }, [clearStartGameTimers, connected, phase, room]);

  useEffect(() => {
    if (!phase) {
      return;
    }

    if (!previousCuePhaseRef.current) {
      previousCuePhaseRef.current = phase;
      setShowPhaseTransition(false);
      return;
    }
    if (previousCuePhaseRef.current === phase) {
      suppressNextPhasePulseRef.current = false;
      setShowPhaseTransition(false);
      return;
    }

    if (suppressNextPhasePulseRef.current) {
      suppressNextPhasePulseRef.current = false;
      previousCuePhaseRef.current = phase;
      setShowPhaseTransition(false);
      return;
    }

    previousCuePhaseRef.current = phase;
    setShowPhaseTransition(true);
    setPhasePulse((current) => current + 1);
    playCue("phase-change", { forceSilent });
    if (!forceSilent) {
      triggerDeviceCue(phase, liveMode);
    }
  }, [forceSilent, liveMode, phase, suppressNextPhasePulseRef]);

  // The first snapshot of each connected room (join, reload, reconnect) is history, not news.
  useEffect(() => {
    const previous = observedRef.current;
    const observing = connected && phase !== null;
    observedRef.current = observing ? { room, eventIds: new Set(publicEvents.map((event) => event.id)), winnerTeam } : null;
    if (!observing || !previous || previous.room !== room) {
      return;
    }

    if (publicEvents.some((event) => !previous.eventIds.has(event.id) && (event.type === "death" || event.type === "hunter_shot"))) {
      playCue("kill", { forceSilent });
    }
    if (winnerTeam && winnerTeam !== previous.winnerTeam) {
      playCue("win", { forceSilent });
    }
  }, [connected, forceSilent, phase, publicEvents, room, winnerTeam]);

  const requestStartGame = useCallback(() => {
    if (!connected || !room?.connection?.isOpen || phase !== "lobby" || startCountdown !== null) {
      return;
    }

    const roomAtStart = room;
    clearStartGameTimers();
    setStartCountdown(3);
    startGameTimersRef.current.push(window.setTimeout(() => setStartCountdown(2), 620));
    startGameTimersRef.current.push(window.setTimeout(() => setStartCountdown(1), 1240));
    startGameTimersRef.current.push(window.setTimeout(() => {
      // A transport drop can precede the connection-status render; never buffer a start.
      if (roomAtStart.connection.isOpen) roomAtStart.send("startGame");
      setStartCountdown(null);
      clearStartGameTimers();
    }, 1860));
  }, [clearStartGameTimers, connected, phase, room, startCountdown]);

  return {
    phasePulse,
    showPhaseTransition,
    startCountdown,
    requestStartGame,
  };
}
