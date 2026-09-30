import { useEffect, useRef } from "react";
import type { GameMode, GamePhase, NarratorVoice } from "@werewolf/shared";
import { playSoundStinger, setSoundScene } from "@/lib/play/soundscape-bridge";
import type { CueMode, PublicEvent } from "@/lib/play/types";

/**
 * Feeds the table soundscape from public state only. Lazy, so neither this wiring nor the
 * synthesiser sits in the play room's entry chunk. Live tables stay silent: a sound at night
 * could reveal who is acting. Like the phase cues, it plays only when this device chose
 * "Звук и вибрация" for the table.
 */
export function SoundscapeHost({
  mode,
  phase,
  narratorVoice,
  liveMode,
  cueMode,
  publicEvents,
}: {
  mode: GameMode;
  phase: GamePhase;
  narratorVoice: NarratorVoice | undefined;
  liveMode: boolean;
  cueMode: CueMode;
  publicEvents: readonly PublicEvent[];
}) {
  const seenEventIds = useRef<Set<string> | null>(null);
  const silent = liveMode || cueMode !== "audio_vibration";

  useEffect(() => {
    setSoundScene(silent ? null : { mode, phase, narratorVoice: narratorVoice ?? "classic" });
  }, [silent, mode, narratorVoice, phase]);

  useEffect(() => () => setSoundScene(null), []);

  // Events already present when the table mounts (join, reconnect) are history, not news.
  useEffect(() => {
    const previous = seenEventIds.current;
    seenEventIds.current = new Set(publicEvents.map((event) => event.id));
    if (!previous || silent) return;
    if (publicEvents.some((event) => !previous.has(event.id) && (event.type === "death" || event.type === "hunter_shot"))) {
      playSoundStinger("death");
    }
  }, [silent, publicEvents]);

  return null;
}
