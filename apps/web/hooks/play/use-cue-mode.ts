"use client";

import { useEffect, useState } from "react";
import type { GamePhase } from "@werewolf/shared";
import { playCue, setSoundEnabled } from "@/lib/sound";
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

export function useCueMode({ tempoProfile, phase, liveMode }: UseCueModeOptions): UseCueModeResult {
  const [cueMode, setCueMode] = useState<CueMode>("silent");
  const forceSilent = liveMode || tempoProfile === "live";

  useEffect(() => {
    const saved = safeLocalStorage.getItem(CUE_MODE_STORAGE_KEY);
    const nextMode = forceSilent ? "silent" : isCueMode(saved) ? saved : "visual";
    setCueMode(nextMode);
    setSoundEnabled(nextMode === "audio_vibration");
  }, [forceSilent, tempoProfile]);

  function changeCueMode(mode: CueMode) {
    if (forceSilent) {
      setCueMode("silent");
      setSoundEnabled(false);
      return;
    }
    setCueMode(mode);
    safeLocalStorage.setItem(CUE_MODE_STORAGE_KEY, mode);
    setSoundEnabled(mode === "audio_vibration");
    if (mode === "audio_vibration") {
      triggerDeviceCue(phase, liveMode);
      playCue("phase-change", { forceSilent: liveMode });
    }
  }

  return { cueMode, changeCueMode };
}
