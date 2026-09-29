import { useEffect, useRef } from "react";
import type { GameMode, GamePhase, NarratorVoice } from "@werewolf/shared";
import { playSoundStinger, setSoundScene } from "@/lib/play/soundscape-bridge";
import type { PublicEvent } from "@/lib/play/types";

/**
 * Feeds the table soundscape from public state only. Lazy, so neither this wiring nor the
 * synthesiser sits in the play room's entry chunk. Live tables stay silent: a sound at night
 * could reveal who is acting.
 */
export function SoundscapeHost({
  mode,
  phase,
  narratorVoice,
  liveMode,
  publicEvents,
}: {
  mode: GameMode;
  phase: GamePhase;
  narratorVoice: NarratorVoice | undefined;
  liveMode: boolean;
  publicEvents: readonly PublicEvent[];
}) {
  const seenEventIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    setSoundScene(liveMode ? null : { mode, phase, narratorVoice: narratorVoice ?? "classic" });
  }, [liveMode, mode, narratorVoice, phase]);

  useEffect(() => () => setSoundScene(null), []);

  // Events already present when the table mounts (join, reconnect) are history, not news.
  useEffect(() => {
    const previous = seenEventIds.current;
    seenEventIds.current = new Set(publicEvents.map((event) => event.id));
    if (!previous || liveMode) return;
    if (publicEvents.some((event) => !previous.has(event.id) && (event.type === "death" || event.type === "hunter_shot"))) {
      playSoundStinger("death");
    }
  }, [liveMode, publicEvents]);

  return null;
}
