"use client";

import { useEffect, useState } from "react";

export type TimerCountdownResult = {
  remainingSeconds: number;
  minutes: string;
  seconds: string;
  isActive: boolean;
};

export function useTimerCountdown(endsAt: number): TimerCountdownResult {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let timer: number | undefined;

    const tick = () => {
      const next = Date.now();
      setNow(next);
      const remainingMs = endsAt - next;
      if (remainingMs > 0) {
        // Align to the deadline's second boundaries, including the final partial second.
        timer = window.setTimeout(tick, remainingMs % 1000 || 1000);
      }
    };
    tick();

    return () => window.clearTimeout(timer);
  }, [endsAt]);

  const remainingSeconds = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const minutes = Math.floor(remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");

  return {
    remainingSeconds,
    minutes,
    seconds,
    isActive: Boolean(endsAt) && remainingSeconds > 0,
  };
}
