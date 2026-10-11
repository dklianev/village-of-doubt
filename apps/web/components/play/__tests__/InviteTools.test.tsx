import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteTools } from "../InviteTools";

describe("InviteTools", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "share");
  });

  it("opens the native share sheet with the public lobby link", async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    const copy = vi.fn();
    render(<InviteTools code="WOLF42" onCopyInvite={copy} />);

    fireEvent.click(screen.getByRole("button", { name: "Сподели поканата" }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: `${window.location.origin}/lobby/WOLF42` }));
    expect(copy).not.toHaveBeenCalled();
  });

  it("copies instead when sharing is unavailable, but not when the player cancels", async () => {
    const copy = vi.fn();
    const { rerender } = render(<InviteTools code="WOLF42" onCopyInvite={copy} />);
    fireEvent.click(screen.getByRole("button", { name: "Сподели поканата" }));
    await waitFor(() => expect(copy).toHaveBeenCalledTimes(1));

    Object.defineProperty(navigator, "share", { configurable: true, value: () => Promise.reject(new DOMException("cancelled", "AbortError")) });
    rerender(<InviteTools code="WOLF42" onCopyInvite={copy} />);
    fireEvent.click(screen.getByRole("button", { name: "Сподели поканата" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(copy).toHaveBeenCalledTimes(1);
  });

  it("shows a scannable QR code with the room code as a fallback", async () => {
    render(<InviteTools code="WOLF42" onCopyInvite={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Покажи QR код за масата" }));

    const qr = await screen.findByRole("img", { name: "QR код за стая WOLF42" });
    expect(qr.querySelector("path")?.getAttribute("d")?.length).toBeGreaterThan(100);
    expect(screen.getByText("WOLF42")).toBeInTheDocument();
  });

  it.each(["escape", "close"])("returns focus to the QR trigger after %s", async (method) => {
    render(<InviteTools code="WOLF42" onCopyInvite={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Покажи QR код за масата" });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Покана с QR код" });
    if (method === "escape") fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });
    else fireEvent.click(screen.getByRole("button", { name: "Затвори" }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
