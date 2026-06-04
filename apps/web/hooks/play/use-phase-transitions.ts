"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Room } from "@colyseus/sdk";
import type { GamePhase } from "@werewolf/shared";
import { playCue } from "@/lib/sound";
import { triggerDeviceCue } from "@/lib/play/device-cues";
import { eventLineClass } from "@/lib/play/event-log";
import type { CueMode, PublicEvent } from "@/lib/play/types";

interface UsePhaseTransitionsOptions {
  room: Room | null;
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
  const previousEventIdsRef = useRef<Set<string>>(new Set());
  const hasSeenEventsRef = useRef(false);
  const previousWinnerTeamRef = useRef("");
  const startGameTimersRef = useRef<number[]>([]);

  const clearStartGameTimers = useCallback(() => {
    for (const timeout of startGameTimersRef.current) {
      window.clearTimeout(timeout);
    }
    startGameTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearStartGameTimers();
  }, [clearStartGameTimers]);

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
    playCue("phase-change", { forceSilent: liveMode || cueMode === "silent" });
    if (cueMode === "audio_vibration") {
      triggerDeviceCue(phase, liveMode);
    }
  }, [cueMode, liveMode, phase, suppressNextPhasePulseRef]);

  useEffect(() => {
    if (!hasSeenEventsRef.current) {
      previousEventIdsRef.current = new Set(publicEvents.map((event) => event.id));
      hasSeenEventsRef.current = true;
      return;
    }

    const previousIds = previousEventIdsRef.current;
    const newEvents = publicEvents.filter((event) => !previousIds.has(event.id));
    previousEventIdsRef.current = new Set(publicEvents.map((event) => event.id));

    if (newEvents.some((event) => eventLineClass(event.messageBg) === "event-death")) {
      playCue("kill", { forceSilent: liveMode });
    }
  }, [liveMode, publicEvents]);

  useEffect(() => {
    if (!winnerTeam || previousWinnerTeamRef.current === winnerTeam) {
      return;
    }
    previousWinnerTeamRef.current = winnerTeam;
    playCue("win", { forceSilent: liveMode });
  }, [liveMode, winnerTeam]);

  const requestStartGame = useCallback(() => {
    if (!room || startCountdown !== null) {
      return;
    }

    const roomAtStart = room;
    clearStartGameTimers();
    setStartCountdown(3);
    startGameTimersRef.current.push(window.setTimeout(() => setStartCountdown(2), 620));
    startGameTimersRef.current.push(window.setTimeout(() => setStartCountdown(1), 1240));
    startGameTimersRef.current.push(window.setTimeout(() => {
      roomAtStart.send("startGame");
      setStartCountdown(null);
      clearStartGameTimers();
    }, 1860));
  }, [clearStartGameTimers, room, startCountdown]);

  return {
    phasePulse,
    showPhaseTransition,
    startCountdown,
    requestStartGame,
  };
}
