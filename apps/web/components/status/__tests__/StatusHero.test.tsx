import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusHero } from "../StatusHero";

describe("StatusHero", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("formats the timestamp in Europe/Sofia without a server/client hydration mismatch", async () => {
    const NativeDateTimeFormat = Intl.DateTimeFormat;
    let environmentTimeZone = "America/Los_Angeles";
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function DateTimeFormat(locales, options) {
      return new NativeDateTimeFormat(locales, {
        ...options,
        timeZone: options?.timeZone ?? environmentTimeZone,
      });
    });

    const props = {
      overall: "ok" as const,
      lastCheckedAt: "2026-01-15T22:30:45.000Z",
      refreshing: false,
      onRefresh: vi.fn(),
    };
    const container = document.createElement("div");
    container.innerHTML = renderToString(<StatusHero {...props} />);
    document.body.append(container);
    environmentTimeZone = "Asia/Tokyo";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <StatusHero {...props} />);
    });

    expect(container.querySelector("time")).toHaveTextContent("00:30:45");
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/hydration|did not match/i);
    expect(container.querySelector('[data-ds-scene-card="lg"]')).toBeInTheDocument();
    expect(container.querySelector("[data-ds-scene-card-background]")).toHaveStyle({
      backgroundImage: expect.stringContaining("var(--art-status)"),
    });

    await act(async () => root?.unmount());
  });
});
