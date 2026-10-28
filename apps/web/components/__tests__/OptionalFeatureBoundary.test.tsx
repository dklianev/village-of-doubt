import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureClientException } from "@/lib/sentry-client";
import { CookieNoticeFallback } from "../CookieNoticeFallback";
import { OptionalFeatureBoundary } from "../OptionalFeatureBoundary";

vi.mock("@/lib/sentry-client", () => ({ captureClientException: vi.fn() }));

function Fragile({ broken }: { broken: boolean }) {
  if (broken) throw new Error("Synthetic widget failure");
  return <p>Работи</p>;
}

describe("OptionalFeatureBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(captureClientException).mockClear();
  });

  it("reports a contained failure once and keeps the page usable", () => {
    render(
      <>
        <button type="button">Страница</button>
        <OptionalFeatureBoundary fallback={<p>Резерва</p>}><Fragile broken /></OptionalFeatureBoundary>
      </>,
    );

    expect(screen.getByText("Резерва")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Страница" })).toBeEnabled();
    expect(captureClientException).toHaveBeenCalledOnce();
    expect(captureClientException).toHaveBeenCalledWith(expect.objectContaining({ message: "Synthetic widget failure" }));
  });

  it("tries the feature again only when its reset key changes", () => {
    const { rerender } = render(
      <OptionalFeatureBoundary resetKey="/" fallback={<p>Резерва</p>}><Fragile broken /></OptionalFeatureBoundary>,
    );
    expect(screen.getByText("Резерва")).toBeInTheDocument();

    rerender(<OptionalFeatureBoundary resetKey="/" fallback={<p>Резерва</p>}><Fragile broken={false} /></OptionalFeatureBoundary>);
    expect(screen.getByText("Резерва")).toBeInTheDocument();

    rerender(<OptionalFeatureBoundary resetKey="/privacy" fallback={<p>Резерва</p>}><Fragile broken={false} /></OptionalFeatureBoundary>);
    expect(screen.getByText("Работи")).toBeInTheDocument();
    expect(screen.queryByText("Резерва")).not.toBeInTheDocument();
  });

  it("falls back to a styled cookie notice that still links to the privacy policy", () => {
    render(<OptionalFeatureBoundary fallback={<CookieNoticeFallback />}><Fragile broken /></OptionalFeatureBoundary>);

    const notice = screen.getByRole("region", { name: "Бисквитки" });
    expect(within(notice).getByRole("link", { name: "политиката за поверителност" })).toHaveAttribute("href", "/privacy");
    expect(notice).toHaveAttribute("data-cookie-banner");
    expect(notice).not.toHaveAttribute("style");
    expect(notice.querySelector("[style]")).toBeNull();
  });
});
