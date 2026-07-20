import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NonCriticalWidgets } from "../non-critical-widgets";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/dynamic", () => ({
  default: () => function DynamicWidget() {
    return <div data-testid="dynamic-widget" />;
  },
}));

const { storageValues, useAuthSession } = vi.hoisted(() => ({
  storageValues: new Map<string, string>(),
  useAuthSession: vi.fn(),
}));
vi.mock("@/lib/use-auth-session", () => ({ useAuthSession }));

vi.mock("@/lib/safe-storage", () => ({
  safeLocalStorage: {
    getItem: (key: string) => storageValues.get(key) ?? null,
    setItem: (key: string, value: string) => storageValues.set(key, value),
  },
}));

vi.mock("@/components/feedback/route-policy", () => ({
  shouldMountFeedback: () => false,
}));

describe("NonCriticalWidgets", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storageValues.clear();
    storageValues.set("cookie-consent", "accepted");
    useAuthSession.mockReturnValue({
      data: { user: { id: "user-1", name: "Анна" } },
      isPending: false,
      refresh: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("показва welcome modal след client session refresh при статичен root layout", () => {
    render(<NonCriticalWidgets initialSession={null} />);

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(useAuthSession).toHaveBeenCalledWith(null);
    expect(screen.getAllByTestId("dynamic-widget")).toHaveLength(1);
  });
});
