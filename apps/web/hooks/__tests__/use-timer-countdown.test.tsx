import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTimerCountdown } from "@/hooks/use-timer-countdown";

describe("useTimerCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns zeroed strings when endsAt is 0", () => {
    const { result } = renderHook(() => useTimerCountdown(0));

    expect(result.current.minutes).toBe("00");
    expect(result.current.seconds).toBe("00");
    expect(result.current.isActive).toBe(false);
  });

  it("counts down each second", () => {
    const endsAt = Date.now() + 65_000;
    const { result } = renderHook(() => useTimerCountdown(endsAt));

    expect(result.current.minutes).toBe("01");
    expect(result.current.seconds).toBe("05");

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.minutes).toBe("00");
    expect(result.current.seconds).toBe("55");
  });

  it("stops at zero", () => {
    const endsAt = Date.now() + 2_000;
    const { result } = renderHook(() => useTimerCountdown(endsAt));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.isActive).toBe(false);
  });
});
