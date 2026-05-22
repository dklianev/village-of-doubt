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
    setNow(Date.now());

    if (!endsAt) {
      return;
    }

    const timer = window.setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next >= endsAt) {
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
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
