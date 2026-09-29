import { getSoundEnabled, SOUND_CHANGE_EVENT } from "@/lib/sound";
import type { SoundScene } from "./soundscape";

type Soundscape = typeof import("./soundscape");

let loading: Promise<Soundscape | null> | null = null;
let scene: SoundScene | null = null;
let listening = false;

function load() {
  // A failed chunk request must not lock sound off for the rest of the session.
  loading ??= import("./soundscape").catch(() => {
    loading = null;
    return null;
  });
  return loading;
}

/**
 * Keeps the play room's entry chunk light: the synthesiser loads only once sound is enabled.
 * Pass null to silence the table (live mode, leaving the room).
 */
export function setSoundScene(next: SoundScene | null) {
  scene = next;
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener(SOUND_CHANGE_EVENT, () => {
      if (scene && !loading && getSoundEnabled()) void load().then((soundscape) => scene && soundscape?.enterPhase(scene));
    });
  }
  if (!next) {
    void loading?.then((soundscape) => soundscape?.stopAll());
    return;
  }
  if (loading || getSoundEnabled()) void load().then((soundscape) => soundscape?.enterPhase(next));
}

export function playSoundStinger(kind: "death") {
  void loading?.then((soundscape) => soundscape?.stinger(kind));
}
