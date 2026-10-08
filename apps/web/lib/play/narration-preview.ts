import { NARRATOR_VOICES, type NarratorVoice } from "@werewolf/shared";
import { getSoundEnabled, SOUND_CHANGE_EVENT, SOUND_STORAGE_KEY } from "@/lib/sound";
import type { createNarrationPlayer } from "./narration-player";

export type NarrationPreviewCue = "preview.night" | "preview.finale";
export type NarrationPreviewStatus = "idle" | "loading" | "playing" | "unavailable";
export const NARRATION_PREVIEW_CHANGE_EVENT = "senkite-narration-preview-change";
let stopCurrentPreview: (() => void) | null = null;

/** Created lazily by the first preview gesture, never by selection or focus. */
export function createNarrationPreview(onStatus: (status: NarrationPreviewStatus) => void) {
  let context: AudioContext | null = null;
  let player: ReturnType<typeof createNarrationPlayer> | null = null;
  let controller: AbortController | null = null;
  let cancelPending: (() => void) | null = null;
  let revision = 0;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const allowed = () => !disposed && !document.hidden && getSoundEnabled();
  function notify(status: NarrationPreviewStatus) {
    if (!disposed) onStatus(status);
  }
  function release() {
    if (stopCurrentPreview === stop) {
      stopCurrentPreview = null;
      window.dispatchEvent(new CustomEvent(NARRATION_PREVIEW_CHANGE_EVENT, { detail: { active: false } }));
    }
  }
  function stop() {
    revision += 1;
    clearTimeout(timer);
    controller?.abort();
    controller = null;
    cancelPending?.();
    cancelPending = null;
    player?.stop();
    release();
    notify("idle");
  }
  function onSoundChange() {
    if (!getSoundEnabled()) stop();
  }
  function onStorage(event: StorageEvent) {
    if (event.key === SOUND_STORAGE_KEY || event.key === null) onSoundChange();
  }
  function onVisibilityChange() {
    if (document.hidden) stop();
  }
  window.addEventListener(SOUND_CHANGE_EVENT, onSoundChange);
  window.addEventListener("storage", onStorage);
  window.addEventListener("pagehide", stop);
  document.addEventListener("visibilitychange", onVisibilityChange);

  async function play(voice: NarratorVoice, cue: NarrationPreviewCue) {
    stop();
    if (!allowed() || !NARRATOR_VOICES.includes(voice) || (cue !== "preview.night" && cue !== "preview.finale")) return;
    stopCurrentPreview?.();
    const requestRevision = revision;
    controller = new AbortController();
    const signal = controller.signal;
    const current = () => revision === requestRevision && !signal.aborted && allowed();
    try {
      // Both construction and resume happen inside the click, before any import/fetch.
      const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) { notify("unavailable"); return; }
      context ??= new Constructor();
      const resumed = context.state === "suspended" ? context.resume() : Promise.resolve();
      // Attach a rejection handler before waiting on the lazy modules.
      const resumeResult = resumed.then(() => true, () => false);
      stopCurrentPreview = stop;
      window.dispatchEvent(new CustomEvent(NARRATION_PREVIEW_CHANGE_EVENT, { detail: { active: true } }));
      notify("loading");
      const cancellation = new Promise<void>((resolve) => { cancelPending = resolve; });
      timer = setTimeout(() => { if (current()) { stop(); notify("unavailable"); } }, 5_000);
      const prepare = async () => {
        const [{ createNarrationPlayer: createPlayer }, { loadNarrationClip }] = await Promise.all([
          import("./narration-player"), import("./narration-assets"),
        ]);
        if (!current()) return;
        if (!await resumeResult || !current() || context!.state !== "running") {
          if (current()) { release(); notify("unavailable"); }
          return;
        }
        player ??= createPlayer({ context: context!, destination: context!.destination, canPlay: allowed,
          onSpeakingChange: (speaking) => {
            if (speaking) notify("playing");
            else { release(); notify("idle"); }
          } });
        const clip = await loadNarrationClip(voice, cue, signal);
        if (!current()) return;
        if (!clip) { release(); notify("unavailable"); return; }
        const result = await player.play(clip, `preview:${requestRevision}:${voice}:${cue}`);
        if (current() && result !== "started") {
          release();
          notify(result === "unavailable" || result === "skipped" ? "unavailable" : "idle");
        }
      };
      await Promise.race([prepare(), cancellation]);
    } catch {
      if (current()) { release(); notify("unavailable"); }
    } finally {
      if (revision === requestRevision) { clearTimeout(timer); cancelPending = null; }
    }
  }

  function dispose() {
    disposed = true;
    stop();
    player?.dispose();
    if (context && context.state !== "closed") void context.close().catch(() => {});
    window.removeEventListener(SOUND_CHANGE_EVENT, onSoundChange);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pagehide", stop);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }
  return { play, stop, dispose };
}
