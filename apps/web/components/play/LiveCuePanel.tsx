import { useId, useRef, useState } from "react";
import { Eye, EyeOff, Play, Volume2 } from "lucide-react";
import { triggerDeviceCue } from "@/lib/play/device-cues";
import type { CueMode } from "@/lib/play/types";
import { PlayToolSheet } from "./PlayToolSheet";
import styles from "./PlayTools.module.css";

const MODES = [
  { value: "silent", label: "Тихо", icon: EyeOff },
  { value: "visual", label: "Визуално", icon: Eye },
  { value: "audio_vibration", label: "Звук и вибрация", icon: Volume2 },
] as const;

export function LiveCuePanel({ cueMode, liveMode, phase, pulseKey, onChange }: {
  cueMode: CueMode;
  liveMode: boolean;
  phase: string;
  pulseKey: number;
  onChange: (mode: CueMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [testPulse, setTestPulse] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const activeMode = liveMode ? "silent" : cueMode;
  const { label, icon: ModeIcon } = MODES.find((mode) => mode.value === activeMode)!;

  return (
    <>
      <button ref={trigger} type="button" className={`${styles.tool} ${styles.cueTool}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <ModeIcon key={pulseKey} data-cue={activeMode} aria-hidden="true" size={18} />
        <span>Сигнали <small>{label}</small></span>
      </button>
      <PlayToolSheet open={open} onOpenChange={setOpen} title="Сигнали за фазите" trigger={trigger} compact>
        <div className={styles.cueBody}>
          <fieldset className={styles.modes}>
            <legend className="sr-only">Режим на сигналите</legend>
            {MODES.map(({ value, label, icon: Icon }) => (
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
              setTestPulse((current) => current + 1);
              if (activeMode === "audio_vibration") triggerDeviceCue(phase, liveMode);
            }}><Play size={16} aria-hidden="true" />Пробвай</button>
          </div>
        </div>
      </PlayToolSheet>
    </>
  );
}
