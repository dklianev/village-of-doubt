import { useTimerCountdown } from "@/hooks/use-timer-countdown";
import styles from "./Timer.module.css";

export function Timer({ endsAt }: { endsAt: number }) {
  const { minutes, remainingSeconds, seconds } = useTimerCountdown(endsAt);
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
      className={`timer-dial ${styles.chronometer}`}
      role="timer"
      aria-label={ariaLabel}
      data-has-deadline={hasDeadline ? "true" : "false"}
      data-state={state}
    >
      <span className={`timer-dial-label ${styles.label}`}>{label}</span>
      <strong className={styles.value}>{hasDeadline ? value : "Свободен ход"}</strong>
    </div>
  );
}
