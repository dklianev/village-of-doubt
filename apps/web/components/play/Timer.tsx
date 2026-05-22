import { useTimerCountdown } from "@/hooks/use-timer-countdown";

export function Timer({ endsAt }: { endsAt: number }) {
  const { minutes, seconds } = useTimerCountdown(endsAt);

  return (
    <div className="timer-dial">
      <span className="block text-xs uppercase tracking-[0.25em] text-[#c18a38]">таймер</span>
      <strong className="text-3xl">{endsAt ? `${minutes}:${seconds}` : "--:--"}</strong>
    </div>
  );
}
