import { useId } from "react";
import { useTimerCountdown } from "@/hooks/use-timer-countdown";
import styles from "./Timer.module.css";

const COUNTDOWN_TRACK = "M 42.02 157.98 A 82 82 0 1 1 157.98 157.98";

export function Timer({ endsAt, presentation = "plain" }: { endsAt: number; presentation?: "plain" | "instrument" }) {
  const { minutes, remainingSeconds, seconds } = useTimerCountdown(endsAt);
  const progressId = useId();
  const instrument = presentation === "instrument";
  const hasDeadline = endsAt > 0;
  const isFinished = hasDeadline && remainingSeconds === 0;
  const isUrgent = hasDeadline && remainingSeconds > 0 && remainingSeconds <= 10;
  const state = !hasDeadline ? "unlimited" : isFinished ? "finished" : isUrgent ? "urgent" : "running";
  const value = `${minutes}:${seconds}`;
  const label = !hasDeadline ? "без таймер" : isFinished ? "Времето изтече" : "Остава";
  const ariaLabel = !hasDeadline
    ? "Свободен ход. Фазата продължава без времево ограничение."
    : isFinished
      ? "Времето изтече"
      : `Оставащо време ${value}`;

  return (
    <div
      className={`timer-dial ${styles.chronometer}${instrument ? ` ${styles.instrument}` : ""}`}
      role="timer"
      aria-label={ariaLabel}
      data-has-deadline={hasDeadline ? "true" : "false"}
      data-state={state}
      data-presentation={presentation}
    >
      {instrument ? (
        // The small, pre-optimized sprite does not need an image-loader runtime.
        <img className={styles.plate} src="/game-art/play/chronometer-brass-v1.webp"
          alt="" width={448} height={448} decoding="async" draggable={false} />
      ) : null}
      {instrument ? (
        <svg className={styles.track} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
          <defs>
            <mask id={progressId}>
              {/* The sixty marks show the final minute, not an invented phase percentage. */}
              <path d={COUNTDOWN_TRACK} pathLength="60" stroke="white" strokeWidth="12" fill="none" strokeDasharray={`${hasDeadline ? Math.min(60, remainingSeconds) : 0} 60`} />
            </mask>
          </defs>
          <path className={styles.trackRest} d={COUNTDOWN_TRACK} pathLength="60" />
          <path className={styles.trackLit} d={COUNTDOWN_TRACK} pathLength="60" mask={`url(#${progressId})`} />
        </svg>
      ) : null}
      <span className={`timer-dial-label ${styles.label}`}>{label}</span>
      <strong className={styles.value}>{hasDeadline ? value : "Свободен ход"}</strong>
    </div>
  );
}
