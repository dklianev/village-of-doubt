"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { GamePhase } from "@werewolf/shared";
import { getSoundEnabled, playCue, setSoundEnabled, subscribeSoundEnabled } from "@/lib/sound";
import { safeLocalStorage } from "@/lib/safe-storage";
import { isCueMode, triggerDeviceCue } from "@/lib/play/device-cues";
import type { CueMode } from "@/lib/play/types";

const CUE_MODE_STORAGE_KEY = "werewolf-cue-mode";

export interface UseCueModeOptions {
  tempoProfile: string | undefined;
  phase: GamePhase;
  liveMode: boolean;
}

export interface UseCueModeResult {
  cueMode: CueMode;
  changeCueMode: (mode: CueMode) => void;
}

/**
 * The device sound preference (shared with the header toggle) decides whether the table plays
 * audio; the saved cue mode only chooses between the visual and silent quiet modes.
 */
export function useCueMode({ tempoProfile, phase, liveMode }: UseCueModeOptions): UseCueModeResult {
  const [savedMode, setSavedMode] = useState<CueMode>("visual");
  const soundEnabled = useSyncExternalStore(subscribeSoundEnabled, getSoundEnabled, () => false);
  const forceSilent = liveMode || tempoProfile === "live";

  useEffect(() => {
    const saved = safeLocalStorage.getItem(CUE_MODE_STORAGE_KEY);
    if (isCueMode(saved)) setSavedMode(saved);
  }, []);

  const cueMode: CueMode = forceSilent
    ? "silent"
    : soundEnabled ? "audio_vibration" : savedMode === "silent" ? "silent" : "visual";

  function changeCueMode(mode: CueMode) {
    if (forceSilent) return;
    setSavedMode(mode);
    safeLocalStorage.setItem(CUE_MODE_STORAGE_KEY, mode);
    setSoundEnabled(mode === "audio_vibration");
    if (mode === "audio_vibration") {
      triggerDeviceCue(phase, liveMode);
      playCue("phase-change", { forceSilent: liveMode });
    }
  }

  return { cueMode, changeCueMode };
}
