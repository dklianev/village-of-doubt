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

  useEffect(() => {
    if (tempoProfile === "live") {
      setCueMode("silent");
      return;
    }

    const saved = safeLocalStorage.getItem(CUE_MODE_STORAGE_KEY);
    if (isCueMode(saved)) {
      setCueMode(saved);
      return;
    }

    setCueMode("visual");
  }, [tempoProfile]);

  function changeCueMode(mode: CueMode) {
    setCueMode(mode);
    safeLocalStorage.setItem(CUE_MODE_STORAGE_KEY, mode);
    if (mode === "audio_vibration") {
      setSoundEnabled(true);
      triggerDeviceCue(phase, liveMode);
      playCue("phase-change", { forceSilent: liveMode });
    }
    if (mode === "silent") {
      setSoundEnabled(false);
    }
  }

  return { cueMode, changeCueMode };
}
