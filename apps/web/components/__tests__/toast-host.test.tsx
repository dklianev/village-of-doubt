import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushToast } from "@/lib/toast";
import { ToastHost } from "../toast-host";

describe("ToastHost", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the polite live region in the document before the first message", () => {
    const { container } = render(<ToastHost />);
    const region = container.querySelector("[aria-live='polite']");

    expect(region).not.toBeNull();
    expect(region).toBeEmptyDOMElement();

    act(() => pushToast({ message: "Кодът е копиран.", kind: "success" }));
    expect(region).toHaveTextContent("Кодът е копиран.");
  });

  it("pauses dismissal while the pointer or keyboard focus is on a message", () => {
    render(<ToastHost />);
    act(() => pushToast({ message: "Гласът е приет.", kind: "success" }));
    const card = screen.getByText("Гласът е приет.").closest("article")!;
    const close = screen.getByRole("button", { name: "Затвори" });

    act(() => vi.advanceTimersByTime(3_000));
    act(() => {
      card.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(card).toHaveAttribute("data-paused");
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText("Гласът е приет.")).toBeInTheDocument();

    act(() => close.focus());
    act(() => {
      card.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
    });
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText("Гласът е приет.")).toBeInTheDocument();

    act(() => close.blur());
    expect(card).not.toHaveAttribute("data-paused");
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByText("Гласът е приет.")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2));
    expect(screen.queryByText("Гласът е приет.")).not.toBeInTheDocument();
  });

  it("keeps errors on screen longer than confirmations", () => {
    render(<ToastHost />);
    act(() => {
      pushToast({ message: "Готово.", kind: "success" });
      pushToast({ message: "Не успяхме да копираме поканата.", kind: "error" });
    });

    act(() => vi.advanceTimersByTime(4_001));
    expect(screen.queryByText("Готово.")).not.toBeInTheDocument();
    expect(screen.getByText("Не успяхме да копираме поканата.")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.queryByText("Не успяхме да копираме поканата.")).not.toBeInTheDocument();
  });

  it("stacks room toasts above the cookie notice and keeps the notice's privacy link readable", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    const room = 'body:has(.site-chrome[data-room="true"])';
    const ruleBody = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      expect(start, selector).toBeGreaterThan(-1);
      return css.slice(start, css.indexOf("}", start));
    };
    const zIndex = (body: string) => Number(/z-index:\s*(\d+)/.exec(body)?.[1]);

    const banner = ruleBody(`${room} [data-cookie-banner]`);
    const toasts = ruleBody(`${room}:has([data-cookie-banner]) .toast-host`);
    expect(zIndex(toasts)).toBeGreaterThan(zIndex(banner));
    expect(toasts).toMatch(/bottom:\s*calc\(/);

    const roomBannerRules = css.split("\n").filter((line) => line.includes(room) && line.includes("[data-cookie-banner] p"));
    expect(roomBannerRules.length).toBeGreaterThan(0);
    for (const line of roomBannerRules) {
      expect(ruleBody(line.replace(/\s*\{\s*$/, "").trim())).not.toMatch(/line-clamp/);
    }
  });

  it("gives every kind label a readable light-theme colour and pauses its progress bar", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");
    const lightLabel = /html\[data-theme="light"\] \.toast-copy span\s*\{[^}]*color:\s*var\(--toast-ink\)/;
    expect(css).toMatch(lightLabel);
    for (const kind of ["success", "warning", "error", "info"]) {
      expect(css).toMatch(new RegExp(`html\\[data-theme="light"\\] \\.toast-card\\[data-kind="${kind}"\\]\\s*\\{[^}]*--toast-ink:`));
    }
    expect(css).toMatch(/\.toast-card\[data-paused\] \.toast-progress\s*\{[^}]*animation-play-state:\s*paused/);
  });
});
