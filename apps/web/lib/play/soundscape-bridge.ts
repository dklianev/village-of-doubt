import { getSoundEnabled, SOUND_CHANGE_EVENT } from "@/lib/sound";
import type { SoundScene } from "./soundscape";

type Soundscape = typeof import("./soundscape");

let loading: Promise<void> | null = null;
let loaded: Soundscape | null = null;
let scene: SoundScene | null = null;
let listening = false;
let previewActive = false;

function syncScene() {
  if (loaded) {
    if (scene && getSoundEnabled() && !previewActive) loaded.enterPhase(scene);
    else loaded.stopAll();
    return;
  }
  if (loading || !scene || !getSoundEnabled() || previewActive) return;
  // A failed chunk request must not lock sound off for the rest of the session.
  loading = import("./soundscape").then((soundscape) => {
    loaded = soundscape;
    // Import completion reconciles the current table, never a captured phase or old room.
    syncScene();
  }).catch(() => {
    loading = null;
  });
}

/**
 * Keeps the play room's entry chunk light: the synthesiser loads only once sound is enabled.
 * Pass null to silence the table (live mode, leaving the room).
 */
export function setSoundScene(next: SoundScene | null) {
  scene = next;
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener(SOUND_CHANGE_EVENT, syncScene);
    // Keep preview imports out of the table entry path. A preview owns speech even while loading.
    window.addEventListener("senkite-narration-preview-change", (event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!detail || typeof detail !== "object" || !("active" in detail) || typeof detail.active !== "boolean") return;
      previewActive = detail.active;
      syncScene();
    });
  }
  syncScene();
}

export function playSoundStinger(kind: "death") {
  if (scene && getSoundEnabled() && !previewActive) loaded?.stinger(kind);
}
