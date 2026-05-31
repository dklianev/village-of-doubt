import { useEffect, useState } from "react";
import { EyeOff, Play, Settings, Volume2 } from "lucide-react";
import { triggerDeviceCue } from "@/lib/play/device-cues";
import type { CueMode } from "@/lib/play/types";

const CUE_MODE_LABEL: Record<CueMode, string> = {
  silent: "Тихо",
  visual: "Визуално",
  audio_vibration: "Звук + вибрация",
};

export function LiveCuePanel({
  cueMode,
  liveMode,
  phase,
  pulseKey,
  onChange,
}: {
  cueMode: CueMode;
  liveMode: boolean;
  phase: string;
  pulseKey: number;
  onChange: (mode: CueMode) => void;
}) {
  const [isOpen, setIsOpen] = useState(liveMode);

  useEffect(() => {
    if (liveMode) {
      setIsOpen(true);
    }
  }, [liveMode]);

  return (
    <details
      className={`cue-panel cue-${cueMode} ${liveMode ? "is-live" : ""}`}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="cue-summary">
        <span className="cue-summary-row">
          <span className="cue-orb" aria-hidden="true">
            <span key={pulseKey} />
          </span>
          <span className="cue-summary-copy">
            <span className="cue-summary-label">Сигнали за фазите</span>
            <span className="cue-summary-mode">{CUE_MODE_LABEL[cueMode]}</span>
          </span>
          <span className="cue-summary-chevron" aria-hidden="true" />
        </span>
      </summary>
      <div className="cue-body">
        <p className="cue-note">
          {liveMode
            ? "Игра на живо: звукът и вибрацията са изключени по подразбиране, защото телефоните са близо един до друг."
            : "Онлайн игра: визуалният pulse е включен по подразбиране; звук/вибрация се включват само от това устройство."}
        </p>
        <div className="cue-actions">
          <button className="btn btn-secondary" type="button" aria-pressed={cueMode === "silent"} onClick={() => onChange("silent")}>
            <EyeOff className="play-button-icon" aria-hidden strokeWidth={1.8} />
            Тихо
          </button>
          <button className="btn btn-secondary" type="button" aria-pressed={cueMode === "visual"} onClick={() => onChange("visual")}>
            <Settings className="play-button-icon" aria-hidden strokeWidth={1.8} />
            Визуално
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            aria-pressed={cueMode === "audio_vibration"}
            onClick={() => onChange("audio_vibration")}
          >
            <Volume2 className="play-button-icon" aria-hidden strokeWidth={1.8} />
            Звук + вибрация
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => triggerDeviceCue(phase)} disabled={cueMode === "silent"}>
            <Play className="play-button-icon" aria-hidden strokeWidth={1.8} />
            Тест
          </button>
        </div>
      </div>
    </details>
  );
}
