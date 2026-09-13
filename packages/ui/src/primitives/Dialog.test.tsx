import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("renders an accessible dialog when open", () => {
    const { container, getByRole } = render(
      <Dialog open onOpenChange={() => {}} title="Потвърди">
        Съдържание
      </Dialog>,
    );
    expect(getByRole("dialog", { name: "Потвърди" }).classList.contains("ds-dialog")).toBe(true);
    expect(container.ownerDocument.head.textContent + container.ownerDocument.body.textContent).toContain(
      "@keyframes ds-dialog-open",
    );
  });

  it("renders description when provided", () => {
    const { getByText } = render(
      <Dialog open onOpenChange={() => {}} title="Потвърди" description="Описание">
        Съдържание
      </Dialog>,
    );
    expect(getByText("Описание")).toBeDefined();
  });

  it("does not render content when closed", () => {
    const { queryByText } = render(
      <Dialog open={false} onOpenChange={() => {}} title="Потвърди">
        Съдържание
      </Dialog>,
    );
    expect(queryByText("Съдържание")).toBeNull();
  });

  it("forwards close requests through onOpenChange", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange} title="Потвърди">
        Съдържание
      </Dialog>,
    );
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(document.querySelector("[data-ds-dialog]")).toHaveAttribute("data-state", "open");
  });

  it("keeps one document-owned stylesheet across closed and unmounted instances", () => {
    const { unmount } = render(
      <>
        <Dialog open={false} onOpenChange={() => {}} title="First">First content</Dialog>
        <Dialog open={false} onOpenChange={() => {}} title="Second">Second content</Dialog>
      </>,
    );
    const styles = document.head.querySelectorAll("#werewolf-ui-dialog-styles");
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toContain("@keyframes ds-dialog-close");
    expect(styles[0]?.textContent).toContain("@keyframes ds-dialog-overlay-close");
    unmount();
    expect(styles[0]?.isConnected).toBe(true);
  });

  it("restores the external opener only after the controlled dialog closes", async () => {
    const onOpenChange = vi.fn();
    const view = (open: boolean) => (
      <>
        <button>Open dialog</button>
        <Dialog open={open} onOpenChange={onOpenChange} title="Confirm">
          <button>Confirm action</button>
        </Dialog>
      </>
    );
    const { getByRole, rerender } = render(view(false));
    const opener = getByRole("button", { name: "Open dialog" });
    for (let cycle = 0; cycle < 2; cycle++) {
      opener.focus();
      rerender(view(true));
      const action = getByRole("button", { name: "Confirm action" });
      await waitFor(() => expect(action).toHaveFocus());
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(action).toHaveFocus();
      expect(getByRole("dialog")).toHaveAttribute("data-state", "open");
      rerender(view(false));
      await waitFor(() => expect(opener).toHaveFocus());
      expect(document.body).not.toHaveAttribute("data-scroll-locked");
    }
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });
});
