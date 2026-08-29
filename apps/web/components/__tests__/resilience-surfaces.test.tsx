import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookieBanner } from "@/components/CookieBanner";
import { OfflineClient } from "@/components/offline-client";

describe("resilience surfaces", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes the cookie notice as a named non-modal region", async () => {
    render(<CookieBanner />);

    const notice = await screen.findByRole("region", { name: "Бисквитки" });

    expect(notice).toBeInTheDocument();
    expect(notice).toHaveAttribute("aria-describedby");
    expect(document.getElementById(notice.getAttribute("aria-describedby") ?? "")).toHaveTextContent(
      "само необходими бисквитки",
    );
    expect(screen.getByRole("link", { name: "политиката за поверителност" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("button", { name: "Разбрах" })).toBeEnabled();
    expect(screen.queryByRole("dialog", { name: "Бисквитки" })).not.toBeInTheDocument();
  });

  it("bounds automatic connection checks and backs them off", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    render(<OfflineClient />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(fetch).toHaveBeenCalledTimes(8);
    expect(screen.getByRole("status")).toHaveTextContent("опит 9");
    expect(vi.getTimerCount()).toBe(0);
  });
});
