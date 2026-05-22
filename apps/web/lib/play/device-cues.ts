import type { CueMode } from "@/lib/play/types";

export function isCueMode(value: string | null): value is CueMode {
  return value === "silent" || value === "visual" || value === "audio_vibration";
}

export function triggerDeviceCue(phase: string, forceSilent = false) {
  if (typeof window === "undefined") {
    return;
  }

  if (!forceSilent && "vibrate" in navigator) {
    const pattern = phase === "voting" ? [90, 50, 90] : phase === "night" || phase === "first_night" ? [130] : [70];
    navigator.vibrate(pattern);
  }
}
