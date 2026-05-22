import { EyeOff, Play, Settings, Volume2 } from "lucide-react";
import { triggerDeviceCue } from "@/lib/play/device-cues";
import type { CueMode } from "@/lib/play/types";

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
  return (
    <section className={`cue-panel cue-${cueMode} ${liveMode ? "is-live" : ""} mt-6 rounded-[2rem] p-4`}>
      <div className="cue-orb" aria-hidden="true">
        <span key={pulseKey} />
      </div>
      <div>
        <p className="section-kicker play-section-kicker">
          <Volume2 className="play-section-icon" aria-hidden strokeWidth={1.8} />
          <span>събуждане</span>
        </p>
        <h2 className="mt-1 text-2xl font-black">Лични сигнали за фазите</h2>
        <p className="mt-2 text-sm text-[#ead9ba]">
          {liveMode
            ? "Игра на живо: звукът и вибрацията са изключени по подразбиране, защото телефоните са близо един до друг."
            : "Онлайн игра: визуалният pulse е включен по подразбиране; звук/вибрация се включват само от това устройство."}
        </p>
      </div>
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
          className="btn btn-primary"
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
    </section>
  );
}
