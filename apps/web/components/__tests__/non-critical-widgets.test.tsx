import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NonCriticalWidgets } from "../non-critical-widgets";

const navigation = vi.hoisted(() => ({ pathname: "/", failWidgets: false }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

vi.mock("next/dynamic", () => ({
  default: () => function DynamicWidget() {
    if (navigation.failWidgets) throw new Error("Synthetic chunk unavailable");
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
    navigation.pathname = "/";
    navigation.failWidgets = false;
    vi.useFakeTimers();
    storageValues.clear();
    storageValues.set("cookie-consent", "accepted");
    useAuthSession.mockReturnValue({
      data: { user: { id: "user-1", name: "Анна" } },
      isPending: false,
      refresh: vi.fn(),
    });
  });

  it("does not promote the tutorial from the tutorial route, including client navigation", () => {
    navigation.pathname = "/tutorial";
    const { rerender } = render(<NonCriticalWidgets initialSession={null} />);
    act(() => { vi.advanceTimersByTime(1_500); vi.runOnlyPendingTimers(); });
    expect(useAuthSession).toHaveBeenCalled();
    expect(screen.queryByTestId("dynamic-widget")).not.toBeInTheDocument();

    navigation.pathname = "/mafia/join/ABC234";
    rerender(<NonCriticalWidgets initialSession={null} />);
    expect(screen.getAllByTestId("dynamic-widget")).toHaveLength(1);

    navigation.pathname = "/tutorial";
    rerender(<NonCriticalWidgets initialSession={null} />);
    expect(screen.queryByTestId("dynamic-widget")).not.toBeInTheDocument();
  });

  it.each(["/", "/offline"])("contains failed widgets on %s without acknowledging consent", (pathname) => {
    navigation.pathname = pathname;
    navigation.failWidgets = true;
    storageValues.clear();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(<><main>Working page</main><NonCriticalWidgets initialSession={null} cookieFallback={
        <aside aria-label="Бисквитки"><a href="/privacy">политиката за поверителност</a></aside>
      } /></>);
      act(() => { vi.advanceTimersByTime(1_500); vi.runOnlyPendingTimers(); });
      expect(screen.getByText("Working page")).toBeInTheDocument();
      expect(screen.getByRole("complementary", { name: "Бисквитки" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "политиката за поверителност" })).toHaveAttribute("href", "/privacy");
      expect(storageValues.has("cookie-consent")).toBe(false);
      expect(storageValues.has("welcome-modal-shown")).toBe(false);
    } finally { error.mockRestore(); }
  });

  it("mounts a failed widget again after navigation", () => {
    navigation.failWidgets = true;
    storageValues.clear();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { rerender } = render(<NonCriticalWidgets initialSession={null} cookieFallback={<p>Резервна бележка</p>} />);
      act(() => { vi.advanceTimersByTime(1_500); vi.runOnlyPendingTimers(); });
      expect(screen.getByText("Резервна бележка")).toBeInTheDocument();

      navigation.failWidgets = false;
      navigation.pathname = "/privacy";
      rerender(<NonCriticalWidgets initialSession={null} cookieFallback={<p>Резервна бележка</p>} />);
      expect(screen.queryByText("Резервна бележка")).not.toBeInTheDocument();
      expect(screen.getAllByTestId("dynamic-widget").length).toBeGreaterThan(0);
    } finally { error.mockRestore(); }
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("изчаква критичния render прозорец преди да монтира динамичните widgets", () => {
    render(<NonCriticalWidgets initialSession={null} />);

    act(() => {
      vi.advanceTimersByTime(1_499);
    });

    expect(useAuthSession).not.toHaveBeenCalled();
    expect(screen.queryByTestId("dynamic-widget")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
      vi.runOnlyPendingTimers();
    });

    expect(useAuthSession).toHaveBeenCalledWith(null);
    expect(screen.getAllByTestId("dynamic-widget")).toHaveLength(1);
  });
});
