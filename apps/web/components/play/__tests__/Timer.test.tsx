import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Timer } from "@/components/play/Timer";
import { parseVisualGameFixture } from "@/hooks/play/visual-game-fixture";

describe("Timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T20:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a Bulgarian free-move status instead of an infinity symbol", () => {
    render(<Timer endsAt={0} />);

    expect(screen.getByRole("timer", { name: "Свободен ход. Фазата продължава без времево ограничение." })).toHaveAttribute(
      "data-state",
      "unlimited",
    );
    expect(screen.getByText("без таймер")).toBeInTheDocument();
    expect(screen.getByText("Свободен ход")).toBeInTheDocument();
    expect(screen.queryByText("∞")).not.toBeInTheDocument();
  });

  it("formats timed phases as tabular minutes and seconds", () => {
    render(<Timer endsAt={Date.now() + 65_000} />);

    expect(screen.getByRole("timer", { name: "Оставащо време 01:05" })).toHaveAttribute("data-state", "running");
    expect(screen.getByText("01:05").className).toContain("value");
  });

  it("ticks down once per second", () => {
    render(<Timer endsAt={Date.now() + 65_000} />);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText("01:04")).toBeInTheDocument();
  });

  it("marks the last ten seconds as urgent", () => {
    render(<Timer endsAt={Date.now() + 8_000} />);

    expect(screen.getByRole("timer", { name: "Оставащо време 00:08" })).toHaveAttribute("data-state", "urgent");
  });

  it("marks an elapsed phase as finished", () => {
    render(<Timer endsAt={Date.now()} />);

    expect(screen.getByRole("timer", { name: "Времето изтече" })).toHaveAttribute("data-state", "finished");
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it.each([
    ["none", null, "unlimited", "Свободен ход. Фазата продължава без времево ограничение."],
    ["90", 90_000, "running", "Оставащо време 01:30"],
    ["20", 20_000, "running", "Оставащо време 00:20"],
    ["8", 8_000, "urgent", "Оставащо време 00:08"],
    ["0", 0, "finished", "Времето изтече"],
  ])("maps and renders the dev visual timer fixture %s", (timer, offset, state, accessibleName) => {
    const fixture = parseVisualGameFixture(`?visualGame=1&timer=${timer}`, "VISUAL", undefined, "test");
    const phaseEndsAt = offset === null ? 0 : Date.now() + offset;

    expect(fixture?.snapshot.phaseEndsAt).toBe(phaseEndsAt);

    render(<Timer endsAt={phaseEndsAt} />);
    expect(screen.getByRole("timer", { name: accessibleName })).toHaveAttribute("data-state", state);
  });

  it.each(["", "unknown", "-1", "9"])("keeps unsupported timer query state %j unlimited", (timer) => {
    const fixture = parseVisualGameFixture(`?visualGame=1&timer=${timer}`, "VISUAL", undefined, "test");

    expect(fixture?.snapshot.phaseEndsAt).toBe(0);
  });

  it("keeps timer fixtures disabled in production", () => {
    expect(parseVisualGameFixture("?visualGame=1&timer=8", "VISUAL", undefined, "production")).toBeNull();
  });
});
