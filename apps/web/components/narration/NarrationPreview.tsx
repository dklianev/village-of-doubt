import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Play, Square } from "lucide-react";
import { NARRATOR_VOICE_LABELS_BG, type NarratorVoice } from "@werewolf/shared";
import { getSoundEnabled, SOUND_CHANGE_EVENT } from "@/lib/sound";
import { createNarrationPreview, type NarrationPreviewStatus } from "@/lib/play/narration-preview";
import styles from "./NarrationPreview.module.css";

const TRANSCRIPT = "Добре дошли в Сенките. Нощта започва, а разговорът около масата стихва. Запазете тайните си до утрото. Тогава ще чуем всяка версия. На кого ще повярвате?";

function subscribeSound(listener: () => void) {
  window.addEventListener(SOUND_CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(SOUND_CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function NarrationPreview({ voice, disabled = false }: { voice: NarratorVoice; disabled?: boolean }) {
  const enabled = useSyncExternalStore(subscribeSound, getSoundEnabled, () => false);
  const [status, setStatus] = useState<NarrationPreviewStatus>("idle");
  const [showTranscript, setShowTranscript] = useState(false);
  const controller = useRef<ReturnType<typeof createNarrationPreview> | null>(null);
  useEffect(() => () => { controller.current?.dispose(); controller.current = null; }, []);
  useEffect(() => { controller.current?.stop(); setStatus("idle"); setShowTranscript(false); }, [voice, disabled]);
  const busy = status === "loading" || status === "playing";
  const Icon = busy ? Square : Play;
  const label = busy ? "Спри прослушването" : "Прослушай гласа";
  return <div className={styles.root}>
    <div className={styles.controls} role="group" aria-label={`Прослушване: ${NARRATOR_VOICE_LABELS_BG[voice]}`}>
      <button type="button" className={styles.button} disabled={disabled || !enabled}
        aria-label={`${label}: ${NARRATOR_VOICE_LABELS_BG[voice]}`}
        aria-pressed={busy} onClick={() => {
          if (busy) { controller.current?.stop(); return; }
          controller.current ??= createNarrationPreview(setStatus);
          setShowTranscript(true);
          void controller.current.play(voice, "preview.night");
        }}><Icon size={16} aria-hidden="true" />{label}</button>
    </div>
    <p className={styles.status} role="status" aria-live="polite">
      {!enabled ? "Звукът е изключен." : disabled ? "Прослушването е недостъпно в този режим." : status === "unavailable" ? "Записът още не е достъпен." : status === "loading" ? "Зареждаме записа..." : status === "playing" ? "Възпроизвеждане" : ""}
    </p>
    {showTranscript ? <p className={styles.transcript}>{TRANSCRIPT}</p> : null}
  </div>;
}
