import { useId } from "react";
import { Play } from "lucide-react";
import { NARRATOR_VOICE_LABELS_BG, type NarratorVoice } from "@werewolf/shared";
import { NarrationPreview } from "@/components/narration/NarrationPreview";
import { triggerDeviceCue } from "@/lib/play/device-cues";
import type { CueMode } from "@/lib/play/types";
import PlayToolSurface, { type PlayToolSheetProps } from "./PlayToolSurface";
import { CUE_MODES } from "./cue-modes";
import styles from "./PlayTools.module.css";

export interface LiveCueSettingsProps extends Omit<PlayToolSheetProps, "children"> {
  activeMode: CueMode;
  liveMode: boolean;
  phase: string;
  pulseKey: number;
  testPulse: number;
  onChange: (mode: CueMode) => void;
  onTest: () => void;
  narratorVoice?: NarratorVoice | undefined;
}

export default function LiveCueSettings({ activeMode, liveMode, phase, pulseKey, testPulse, onChange, onTest, narratorVoice, ...sheet }: LiveCueSettingsProps) {
  const id = useId();
  const { icon: ModeIcon } = CUE_MODES.find((mode) => mode.value === activeMode)!;

  return (
    <PlayToolSurface {...sheet}>
      <div className={styles.cueBody}>
        <fieldset className={styles.modes}>
          <legend className="sr-only">Режим на сигналите</legend>
          {CUE_MODES.map(({ value, label, icon: Icon }) => (
            <label key={value}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              <input type="radio" name={id} value={value} checked={activeMode === value} onChange={() => onChange(value)} disabled={liveMode && value !== "silent"} />
            </label>
          ))}
        </fieldset>
        <p className={styles.note}>{liveMode ? "При игра на живо е достъпен само тихият режим." : "Настройката важи само за това устройство."}</p>
        <div className={styles.preview}>
          <span className={styles.cuePreview} data-cue={activeMode} aria-hidden="true"><ModeIcon key={`${pulseKey}:${testPulse}`} size={20} /></span>
          <button type="button" className={styles.testCue} disabled={activeMode === "silent"} onClick={() => {
            onTest();
            if (activeMode === "audio_vibration") triggerDeviceCue(phase, liveMode);
          }}><Play size={16} aria-hidden="true" />Пробвай</button>
        </div>
        {narratorVoice ? <section className={styles.narrator} aria-label="Глас на стаята">
          <h3>{NARRATOR_VOICE_LABELS_BG[narratorVoice]}</h3>
          <NarrationPreview key={`${narratorVoice}:${phase}:${pulseKey}:${sheet.open}`} voice={narratorVoice}
            disabled={!sheet.open || liveMode || activeMode !== "audio_vibration"} />
        </section> : null}
      </div>
    </PlayToolSurface>
  );
}
