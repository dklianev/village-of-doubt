import { describe, expect, it, vi } from "vitest";
import { createNavigationTransitionTracker, telemetryRoute } from "../navigation-telemetry";

describe("navigation telemetry", () => {
  it("measures a completed router transition without exposing room codes", () => {
    const now = vi.fn()
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_245);
    const tracker = createNavigationTransitionTracker({ now });

    tracker.start({
      id: "transition-1",
      targetUrl: "https://senkite.com/play/WOLF42?visualGame=1",
      navigationType: "push",
      fromRoutes: ["/create"],
      prefetchIntent: "auto",
    });

    expect(tracker.complete("/play/WOLF42")).toEqual({
      durationMs: 245,
      fromRoute: "/create",
      navigationType: "push",
      prefetchIntent: "auto",
      targetRoute: "/play/[code]",
      transitionId: "transition-1",
    });
  });

  it("replaces an interrupted transition and ignores stale measurements", () => {
    const now = vi.fn()
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_100)
      .mockReturnValueOnce(122_000);
    const tracker = createNavigationTransitionTracker({ now, maxDurationMs: 120_000 });

    tracker.start({
      id: "transition-1",
      targetUrl: "/history",
      navigationType: "push",
      fromRoutes: ["/"],
      prefetchIntent: "full",
    });
    tracker.start({
      id: "transition-2",
      targetUrl: "/leaderboard",
      navigationType: "replace",
      fromRoutes: ["/history"],
      prefetchIntent: null,
    });

    expect(tracker.complete("/leaderboard")).toBeNull();
  });

  it("normalizes private dynamic route segments before reporting", () => {
    expect(telemetryRoute("/lobby/SECRET7")).toBe("/lobby/[code]");
    expect(telemetryRoute("/history/game-private-id/replay")).toBe("/history/[gameId]/replay");
    expect(telemetryRoute("/mafia/rules")).toBe("/mafia/rules");
  });
});
