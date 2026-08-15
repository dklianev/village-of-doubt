import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureBrowserNavigationMetric } from "../sentry-client-runtime";

const { distribution } = vi.hoisted(() => ({ distribution: vi.fn() }));

vi.mock("@sentry/browser", () => ({
  BrowserClient: class {},
  breadcrumbsIntegration: vi.fn(),
  captureException: vi.fn(),
  dedupeIntegration: vi.fn(),
  defaultStackParser: vi.fn(),
  getCurrentScope: vi.fn(),
  globalHandlersIntegration: vi.fn(),
  linkedErrorsIntegration: vi.fn(),
  makeFetchTransport: vi.fn(),
  metrics: { distribution },
}));

describe("browser navigation metrics", () => {
  beforeEach(() => {
    distribution.mockClear();
  });

  it("records duration with route templates and transition context", () => {
    captureBrowserNavigationMetric({
      durationMs: 245,
      fromRoute: "/create",
      navigationType: "push",
      prefetchIntent: "auto",
      targetRoute: "/play/[code]",
      transitionId: "transition-1",
    });

    expect(distribution).toHaveBeenCalledWith("ui.navigation.duration", 245, {
      unit: "millisecond",
      attributes: {
        from_route: "/create",
        navigation_type: "push",
        prefetch_intent: "auto",
        target_route: "/play/[code]",
      },
    });
  });
});
