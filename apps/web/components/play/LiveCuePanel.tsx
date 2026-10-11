import { useRef, useState } from "react";
import type { NarratorVoice } from "@werewolf/shared";
import type { CueMode } from "@/lib/play/types";
import { PlayToolSheet } from "./PlayToolSheet";
import { CUE_MODES } from "./cue-modes";
import styles from "./PlayTools.module.css";

export function LiveCuePanel({ cueMode, liveMode, phase, pulseKey, onChange, narratorVoice }: {
  cueMode: CueMode;
  liveMode: boolean;
  phase: string;
  pulseKey: number;
  onChange: (mode: CueMode) => void;
  narratorVoice?: NarratorVoice;
}) {
  const [open, setOpen] = useState(false);
  const [testPulse, setTestPulse] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const activeMode = liveMode ? "silent" : cueMode;
  const { label, icon: ModeIcon } = CUE_MODES.find((mode) => mode.value === activeMode)!;

  return (
    <>
      <button ref={trigger} type="button" className={`${styles.tool} ${styles.cueTool}`} title="Сигнали за фазите" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <ModeIcon key={pulseKey} data-cue={activeMode} aria-hidden="true" size={18} />
        <span>Сигнали <small>{label}</small></span>
      </button>
      <PlayToolSheet open={open} onOpenChange={setOpen} title="Сигнали за фазите" trigger={trigger} compact
        activeMode={activeMode} liveMode={liveMode} phase={phase} pulseKey={pulseKey} testPulse={testPulse}
        narratorVoice={narratorVoice}
        onChange={onChange} onTest={() => setTestPulse((current) => current + 1)} />
    </>
  );
}
