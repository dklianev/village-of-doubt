import { fireEvent, render, waitFor } from "@testing-library/react";
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

  it("announces only a description the caller gave", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getByRole, unmount } = render(
      <Dialog open onOpenChange={() => {}} title="Потвърди">
        Съдържание
      </Dialog>,
    );
    const bare = getByRole("dialog", { name: "Потвърди" });
    expect(bare).not.toHaveAttribute("aria-describedby");
    expect(bare).not.toHaveTextContent("Диалогов прозорец");
    expect(warn).not.toHaveBeenCalled();
    unmount();

    const described = render(
      <Dialog open onOpenChange={() => {}} title="Потвърди" description="Действието е окончателно.">
        Съдържание
      </Dialog>,
    ).getByRole("dialog", { name: "Потвърди" });
    expect(described).toHaveAccessibleDescription("Действието е окончателно.");
    warn.mockRestore();
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

  it("constrains the scroll surface to the dynamic viewport and safe-area gutters", () => {
    render(<Dialog open onOpenChange={() => {}} title="Long content">Content</Dialog>);
    const sheet = document.querySelector<HTMLStyleElement>("#werewolf-ui-dialog-styles")!.sheet!;
    const rule = [...sheet.cssRules].find((item) => (item as CSSStyleRule).selectorText === ".ds-dialog") as CSSStyleRule;
    expect(rule.style.getPropertyValue("max-height")).toBe("calc(100dvh - 2 * var(--ds-dialog-block-gutter))");
    expect(rule.style.getPropertyValue("--ds-dialog-block-gutter")).toContain("safe-area-inset-top");
    expect(rule.style.getPropertyValue("--ds-dialog-block-gutter")).toContain("safe-area-inset-bottom");
    expect(rule.style.getPropertyValue("overflow-y")).toBe("auto");
    expect(rule.style.getPropertyValue("overscroll-behavior")).toBe("contain");
    expect(rule.style.getPropertyValue("grid-template-columns")).toBe("minmax(0, 1fr)");
    expect(rule.style.getPropertyValue("overflow-wrap")).toBe("anywhere");
  });

  it("disables dialog and overlay enter/exit animations for reduced motion", () => {
    render(<Dialog open onOpenChange={() => {}} title="Reduced motion">Content</Dialog>);
    const sheet = document.querySelector<HTMLStyleElement>("#werewolf-ui-dialog-styles")!.sheet!;
    const media = [...sheet.cssRules].find((rule) => (rule as CSSMediaRule).conditionText === "(prefers-reduced-motion: reduce)") as CSSMediaRule;
    expect(media).toBeDefined();
    const rule = media.cssRules[0] as CSSStyleRule;
    for (const surface of ["ds-dialog", "ds-dialog-overlay"]) {
      const element = document.createElement("div");
      element.className = surface;
      for (const state of ["open", "closed"]) {
        element.dataset.state = state;
        expect(element.matches(rule.selectorText)).toBe(true);
      }
    }
    expect(rule.style.getPropertyValue("animation")).toBe("none");
  });

  it("keeps both content and footer controls in the keyboard focus loop", async () => {
    const { getByRole } = render(
      <Dialog open onOpenChange={() => {}} title="Confirm" description={"Long description. ".repeat(30)}
        footer={<><button>Cancel</button><button>Confirm action</button></>}>
        <button>Close dialog</button>
      </Dialog>,
    );
    const first = getByRole("button", { name: "Close dialog" });
    const last = getByRole("button", { name: "Confirm action" });
    await waitFor(() => expect(first).toHaveFocus());
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
  });

  it("reveals offscreen controls when Radix wraps focus without scrolling", async () => {
    const { getByRole } = render(
      <Dialog open onOpenChange={() => {}} title="Confirm" footer={<button>Confirm action</button>}>
        <button style={{ position: "absolute", top: 14 }}>Close dialog</button>
      </Dialog>,
    );
    const dialog = getByRole("dialog");
    const first = getByRole("button", { name: "Close dialog" });
    const last = getByRole("button", { name: "Confirm action" });
    await waitFor(() => expect(first).toHaveFocus());
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({ top: 24, bottom: 366 } as DOMRect);
    const firstBounds = vi.spyOn(first, "getBoundingClientRect").mockReturnValue({ top: -504, bottom: -460 } as DOMRect);
    vi.spyOn(last, "getBoundingClientRect").mockReturnValue({ top: 800, bottom: 844 } as DOMRect);
    const revealFirst = vi.fn();
    const revealLast = vi.fn();
    first.scrollIntoView = revealFirst;
    last.scrollIntoView = revealLast;
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    expect(revealLast).toHaveBeenCalledExactlyOnceWith({ block: "nearest" });
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
    expect(revealFirst).toHaveBeenCalledExactlyOnceWith({ block: "nearest" });
    firstBounds.mockReturnValue({ top: 38, bottom: 82 } as DOMRect);
    fireEvent.focus(first);
    expect(revealFirst).toHaveBeenCalledTimes(1);
  });
});
