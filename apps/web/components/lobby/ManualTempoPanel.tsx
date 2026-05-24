import type { Dispatch } from "react";
import type { PhaseTimers } from "@werewolf/shared";
import {
  estimatedDurationSeconds,
  formatEstimatedDuration,
  type LobbyFormAction,
  type LobbyFormState,
} from "@/lib/lobby-form";

const MANUAL_TIMER_FIELDS: {
  key: "dayDiscussionSeconds" | "factionNightActionSeconds" | "voteSeconds";
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  presets: number[];
}[] = [
  {
    key: "dayDiscussionSeconds",
    label: "Обсъждане през деня",
    hint: "Колко време има селото или градът да говори преди гласуване.",
    min: 0,
    max: 600,
    step: 15,
    presets: [90, 180, 300],
  },
  {
    key: "factionNightActionSeconds",
    label: "Нощни действия",
    hint: "Време за Върколаци, Мафия и специални роли.",
    min: 15,
    max: 240,
    step: 15,
    presets: [30, 60, 90],
  },
  {
    key: "voteSeconds",
    label: "Гласуване",
    hint: "Финалният прозорец за присъда.",
    min: 15,
    max: 180,
    step: 15,
    presets: [30, 60, 90],
  },
];

export function ManualTempoPanel({
  state,
  dispatch,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
}) {
  const timers = state.customTimers;
  return (
    <section className="manual-tempo-panel" aria-label="Ръчно темпо">
      <div className="manual-tempo-heading">
        <div>
          <p className="section-kicker">режисьорско темпо</p>
          <h3>Ти водиш ритъма</h3>
          <p>Остави кратки фази за бърза онлайн игра или дай повече въздух на маса на живо.</p>
        </div>
        <div className="manual-tempo-estimate">
          <span>Очаквана игра</span>
          <strong>{formatEstimatedDuration(estimatedDurationSeconds(state))}</strong>
        </div>
      </div>

      <div className="manual-tempo-grid">
        {MANUAL_TIMER_FIELDS.map((field) => (
          <ManualTimerControl
            key={field.key}
            field={field}
            value={timers[field.key]}
            dispatch={dispatch}
          />
        ))}
      </div>

      <label className="manual-tempo-ready">
        <input
          type="checkbox"
          checked={timers.autoAdvanceWhenReady}
          onChange={(event) =>
            dispatch({ type: "SET_CUSTOM_TIMER", key: "autoAdvanceWhenReady", value: event.target.checked })
          }
        />
        <span>
          <strong>Продължавай автоматично, когато всички са готови</strong>
          <small>Ако всички действат или гласуват по-рано, фазата не чака таймера.</small>
        </span>
      </label>
    </section>
  );
}

function ManualTimerControl({
  field,
  value,
  dispatch,
}: {
  field: (typeof MANUAL_TIMER_FIELDS)[number];
  value: number;
  dispatch: Dispatch<LobbyFormAction>;
}) {
  function setValue(nextValue: number) {
    dispatch({ type: "SET_CUSTOM_TIMER", key: field.key, value: nextValue });
  }

  return (
    <article className="manual-timer-card">
      <div className="manual-timer-card-top">
        <div>
          <strong>{field.label}</strong>
          <span>{field.hint}</span>
        </div>
        <b>{formatSeconds(value)}</b>
      </div>
      <div className="manual-timer-control">
        <button type="button" aria-label={`Намали: ${field.label}`} onClick={() => setValue(value - field.step)}>
          -
        </button>
        <input
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          aria-label={field.label}
          onChange={(event) => setValue(Number(event.target.value))}
        />
        <button type="button" aria-label={`Увеличи: ${field.label}`} onClick={() => setValue(value + field.step)}>
          +
        </button>
      </div>
      <div className="manual-timer-presets" aria-label={`Бързи стойности за ${field.label}`}>
        {field.presets.map((preset) => (
          <button
            key={preset}
            type="button"
            data-active={value === preset ? "true" : "false"}
            onClick={() => setValue(preset)}
          >
            {formatSeconds(preset)}
          </button>
        ))}
      </div>
    </article>
  );
}

export function tempoSummary(timers: PhaseTimers) {
  return `Д ${formatSeconds(timers.dayDiscussionSeconds)} · Н ${formatSeconds(timers.factionNightActionSeconds)} · Г ${formatSeconds(timers.voteSeconds)}`;
}

export function formatSeconds(seconds: number) {
  if (seconds === 0) {
    return "без пауза";
  }
  if (seconds % 60 === 0) {
    return `${seconds / 60} мин`;
  }
  if (seconds > 60) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}:${String(rest).padStart(2, "0")} мин`;
  }
  return `${seconds} сек`;
}
