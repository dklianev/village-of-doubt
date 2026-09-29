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

  it.each([1, 250, 1_500, 1_999])("expires at the deadline with %i ms remaining", (duration) => {
    const endsAt = Date.now() + duration;
    const { result } = renderHook(() => useTimerCountdown(endsAt));

    act(() => vi.advanceTimersByTime(duration - 1));
    expect(result.current.remainingSeconds).toBe(1);
    expect(result.current.isActive).toBe(true);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.isActive).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aligns second changes to a deadline between interval ticks", () => {
    const endsAt = Date.now() + 1_500;
    const { result } = renderHook(() => useTimerCountdown(endsAt));
    expect(result.current.remainingSeconds).toBe(2);

    act(() => vi.advanceTimersByTime(499));
    expect(result.current.remainingSeconds).toBe(2);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.remainingSeconds).toBe(1);
    act(() => vi.advanceTimersByTime(999));
    expect(result.current.remainingSeconds).toBe(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.remainingSeconds).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([375, 2_250])("reschedules a changed deadline with %i ms remaining", (duration) => {
    const { result, rerender } = renderHook(({ endsAt }) => useTimerCountdown(endsAt), {
      initialProps: { endsAt: Date.now() + 1_500 },
    });
    act(() => vi.advanceTimersByTime(250));
    rerender({ endsAt: Date.now() + duration });
    expect(vi.getTimerCount()).toBe(1);

    act(() => vi.advanceTimersByTime(duration - 1));
    expect(result.current.remainingSeconds).toBe(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.remainingSeconds).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels ticking in unlimited mode and restarts for a new deadline", () => {
    const { result, rerender } = renderHook(({ endsAt }) => useTimerCountdown(endsAt), {
      initialProps: { endsAt: Date.now() + 1_500 },
    });
    act(() => vi.advanceTimersByTime(250));
    rerender({ endsAt: 0 });
    expect(result.current.isActive).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    act(() => vi.advanceTimersByTime(5_000));
    rerender({ endsAt: Date.now() + 500 });
    expect(result.current.isActive).toBe(true);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.remainingSeconds).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses the current clock after a delayed tick instead of replaying missed seconds", () => {
    const endsAt = Date.now() + 1_500;
    const { result } = renderHook(() => useTimerCountdown(endsAt));
    vi.setSystemTime(Date.now() + 5_000);
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.remainingSeconds).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not schedule a timer for an expired deadline", () => {
    const { result } = renderHook(() => useTimerCountdown(Date.now() - 500));
    expect(result.current.remainingSeconds).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up its pending tick on unmount", () => {
    const { unmount } = renderHook(() => useTimerCountdown(Date.now() + 1_500));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
