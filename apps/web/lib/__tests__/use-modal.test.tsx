import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Fragment, StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useModal } from "../use-modal";

function ModalHarness({
  onClose,
  open = true,
}: {
  onClose: () => void;
  open?: boolean;
}) {
  const { ref } = useModal<HTMLElement>({ open, onClose });
  if (!open) {
    return null;
  }
  return (
    <section ref={ref}>
      <button type="button">Вътрешно действие</button>
      <button type="button">Last action</button>
    </section>
  );
}

describe("useModal", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("не рестартира focus trap-а, когато onClose callback-ът се смени", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    const restoreFocus = vi.spyOn(outside, "focus");

    const initialClose = vi.fn();
    const updatedClose = vi.fn();
    const { rerender, unmount } = render(<ModalHarness onClose={initialClose} />);
    expect(screen.getByRole("button", { name: "Вътрешно действие" })).toHaveFocus();
    restoreFocus.mockClear();

    rerender(<ModalHarness onClose={updatedClose} />);

    expect(restoreFocus).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Вътрешно действие" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(initialClose).not.toHaveBeenCalled();
    expect(updatedClose).toHaveBeenCalledOnce();

    unmount();
    expect(outside).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
    outside.remove();
  });

  it("does not acquire a lock or listen for Escape while closed", () => {
    document.body.style.overflow = "auto";
    const onClose = vi.fn();
    const { unmount } = render(<ModalHarness open={false} onClose={onClose} />);

    expect(document.body.style.overflow).toBe("auto");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  describe.each([false, true])("scroll ownership (StrictMode: %s)", (strictMode) => {
    const wrapper = strictMode ? StrictMode : Fragment;

    it.each(["", "auto", "scroll", "hidden", "clip"])(
      "restores the original overflow %j after the final owner unmounts",
      (overflow) => {
        document.body.style.overflow = overflow;
        const first = render(<ModalHarness onClose={vi.fn()} />, { wrapper });
        const second = render(<ModalHarness onClose={vi.fn()} />, { wrapper });
        expect(document.body.style.overflow).toBe("hidden");

        first.unmount();
        expect(document.body.style.overflow).toBe("hidden");
        second.unmount();
        expect(document.body.style.overflow).toBe(overflow);
      },
    );

    it("keeps the lock when the most recent modal unmounts first", () => {
      document.body.style.overflow = "scroll";
      const first = render(<ModalHarness onClose={vi.fn()} />, { wrapper });
      const second = render(<ModalHarness onClose={vi.fn()} />, { wrapper });

      second.unmount();
      expect(document.body.style.overflow).toBe("hidden");
      first.unmount();
      expect(document.body.style.overflow).toBe("scroll");
    });

    it.each(["rerender", "unmount"] as const)(
      "releases both owners after their DOM is disconnected by %s",
      (removal) => {
        document.body.style.overflow = "auto";
        const modals = render(
          <>
            <ModalHarness onClose={vi.fn()} />
            <ModalHarness onClose={vi.fn()} />
          </>,
          { wrapper },
        );
        const roots = Array.from(modals.container.querySelectorAll("section"));
        expect(roots).toHaveLength(2);
        expect(document.body.style.overflow).toBe("hidden");

        if (removal === "rerender") {
          modals.rerender(<></>);
        } else {
          modals.unmount();
        }

        expect(roots.every((root) => !root.isConnected)).toBe(true);
        expect(document.body.style.overflow).toBe("auto");
        modals.unmount();
        expect(document.body.style.overflow).toBe("auto");
      },
    );

    it("releases on close and captures the current overflow on reopen", () => {
      document.body.style.overflow = "auto";
      const onClose = vi.fn();
      const first = render(<ModalHarness onClose={onClose} />, { wrapper });
      const second = render(<ModalHarness onClose={onClose} />, { wrapper });

      first.rerender(<ModalHarness open={false} onClose={onClose} />);
      expect(document.body.style.overflow).toBe("hidden");
      second.rerender(<ModalHarness open={false} onClose={onClose} />);
      expect(document.body.style.overflow).toBe("auto");
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();

      document.body.style.overflow = "scroll";
      first.rerender(<ModalHarness onClose={onClose} />);
      expect(document.body.style.overflow).toBe("hidden");
      first.unmount();
      second.unmount();
      expect(document.body.style.overflow).toBe("scroll");
    });

    it("preserves focus, Tab wrapping, and keydown cleanup", () => {
      const outside = document.createElement("button");
      document.body.append(outside);
      outside.focus();
      const onClose = vi.fn();
      const { unmount } = render(<ModalHarness onClose={onClose} />, { wrapper });
      const first = screen.getByRole("button", { name: "Вътрешно действие" });
      const last = screen.getByRole("button", { name: "Last action" });

      expect(first).toHaveFocus();
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
      expect(last).toHaveFocus();
      fireEvent.keyDown(document, { key: "Tab" });
      expect(first).toHaveFocus();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledOnce();

      unmount();
      expect(outside).toHaveFocus();
      expect(document.body.style.overflow).toBe("");
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledOnce();
      outside.remove();
    });
  });
});
