import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Timer } from "@/components/play/Timer";

describe("Timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T20:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a placeholder when there is no active deadline", () => {
    render(<Timer endsAt={0} />);

    expect(screen.getByText("таймер")).toBeInTheDocument();
    expect(screen.getByText("--:--")).toBeInTheDocument();
  });

  it("formats the remaining deadline as minutes and seconds", () => {
    render(<Timer endsAt={Date.now() + 65_000} />);

    expect(screen.getByText("01:05")).toBeInTheDocument();
  });

  it("ticks down once per second", () => {
    render(<Timer endsAt={Date.now() + 65_000} />);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText("01:04")).toBeInTheDocument();
  });
});
