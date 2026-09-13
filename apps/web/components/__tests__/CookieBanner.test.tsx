import { StrictMode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookieBanner } from "../CookieBanner";

const route = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}));

function PageHarness({ mounted = true }: { mounted?: boolean }) {
  return (
    <>
      <div className="site-chrome-boundary"><header>Navigation</header></div>
      <div id="main-content"><main><h1>Homepage heading</h1></main></div>
      <footer>Footer</footer>
      {mounted ? <CookieBanner /> : null}
    </>
  );
}

describe("CookieBanner homepage placement", () => {
  beforeEach(() => {
    route.pathname = "/";
    window.localStorage.clear();
  });

  it("places the fresh notice after main content and before the footer", async () => {
    render(<StrictMode><PageHarness /></StrictMode>);

    const notice = await screen.findByRole("region", { name: "Бисквитки" });
    const header = screen.getByRole("banner");
    const main = screen.getByRole("main");
    expect(header.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(main.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notice.compareDocumentPosition(screen.getByRole("contentinfo")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelector(".site-chrome-boundary")?.nextElementSibling).toHaveAttribute("id", "main-content");
    expect(document.querySelector(".site-chrome-boundary")).not.toContainElement(notice);
    expect(screen.getAllByRole("region", { name: "Бисквитки" })).toHaveLength(1);
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent("Homepage heading");
  });

  it("removes its reserved space on dismissal and persists that choice across remounts", async () => {
    const user = userEvent.setup();
    const view = render(<PageHarness />);
    const notice = await screen.findByRole("region", { name: "Бисквитки" });
    const slot = notice.parentElement;
    expect(slot).not.toBe(view.container);

    await user.click(within(notice).getByRole("button", { name: "Разбрах" }));
    expect(screen.queryByRole("region", { name: "Бисквитки" })).not.toBeInTheDocument();
    expect(slot).not.toBeInTheDocument();
    expect(localStorage.getItem("cookie-consent")).toBe("1");
    expect(document.querySelector(".site-chrome-boundary")?.nextElementSibling).toHaveAttribute("id", "main-content");

    view.rerender(<PageHarness mounted={false} />);
    view.rerender(<PageHarness />);
    expect(screen.queryByRole("region", { name: "Бисквитки" })).not.toBeInTheDocument();
  });

  it.each(["/privacy", "/werewolf", "/mafia", "/play/ROOM"])(
    "preserves the existing mount on %s",
    async (pathname) => {
      route.pathname = pathname;
      const { container } = render(<PageHarness />);
      const notice = await screen.findByRole("region", { name: "Бисквитки" });
      expect(notice.parentElement).toBe(container);
      expect(screen.getByRole("contentinfo").compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(notice).toHaveAttribute("data-cookie-banner");
      expect(document.querySelector(".site-chrome-boundary")?.nextElementSibling).toHaveAttribute("id", "main-content");
    },
  );

  it("cleans up homepage space when navigating away and restores it on return", async () => {
    const view = render(<PageHarness />);
    const firstNotice = await screen.findByRole("region", { name: "Бисквитки" });
    const firstSlot = firstNotice.parentElement;
    expect(firstSlot).not.toBe(view.container);

    route.pathname = "/play/ROOM";
    view.rerender(<PageHarness />);
    expect(firstSlot).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Бисквитки" }).parentElement).toBe(view.container);

    route.pathname = "/";
    view.rerender(<PageHarness />);
    await waitFor(() => {
      const notice = screen.getByRole("region", { name: "Бисквитки" });
      expect(screen.getByRole("main").compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(notice.compareDocumentPosition(screen.getByRole("contentinfo")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(screen.getAllByRole("region", { name: "Бисквитки" })).toHaveLength(1);
  });

  it("removes its own slot on unmount without removing page content", async () => {
    const view = render(<PageHarness />);
    const notice = await screen.findByRole("region", { name: "Бисквитки" });
    const slot = notice.parentElement;
    expect(slot).not.toBe(view.container);

    view.rerender(<PageHarness mounted={false} />);
    expect(slot).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("still dismisses when browser storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    const user = userEvent.setup();
    render(<PageHarness />);

    const notice = await screen.findByRole("region", { name: "Бисквитки" });
    const slot = notice.parentElement;
    expect(slot).not.toBe(document.getElementById("main-content")?.parentElement);
    await user.click(within(notice).getByRole("button", { name: "Разбрах" }));
    expect(screen.queryByRole("region", { name: "Бисквитки" })).not.toBeInTheDocument();
    expect(slot).not.toBeInTheDocument();
  });
});
