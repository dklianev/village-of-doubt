import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Activity, Fragment, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function NamedModal({ name, open = true }: { name: string; open?: boolean }) {
  const { ref } = useModal<HTMLElement>({ open, onClose: () => {} });
  if (!open) return null;
  return (
    <section ref={ref} role="dialog" aria-modal="true" aria-label={name}>
      <button type="button">{name} действие</button>
    </section>
  );
}

describe("useModal page isolation", () => {
  let page: HTMLElement;

  beforeEach(() => {
    page = document.createElement("main");
    page.innerHTML = '<button type="button">Страница</button>';
    document.body.append(page);
  });

  afterEach(() => {
    cleanup();
    page.remove();
    document.body.style.overflow = "";
  });

  describe.each([false, true])("StrictMode: %s", (strictMode) => {
    const wrapper = strictMode ? StrictMode : Fragment;

    it("hides the page behind from pointer, keyboard and assistive tech until close", () => {
      const { rerender } = render(<NamedModal name="Първи" />, { wrapper });

      expect(page).toHaveAttribute("inert");
      expect(page).toHaveAttribute("aria-hidden", "true");
      expect(screen.queryByRole("button", { name: "Страница" })).toBeNull();
      expect(screen.getByRole("dialog", { name: "Първи" }).closest("[inert]")).toBeNull();

      rerender(<NamedModal name="Първи" open={false} />);
      expect(page).not.toHaveAttribute("inert");
      expect(page).not.toHaveAttribute("aria-hidden");
      expect(screen.getByRole("button", { name: "Страница" })).toBeInTheDocument();
    });

    it.each(["older", "newer"])("keeps only the topmost modal usable when the %s one closes first", (closesFirst) => {
      const older = render(<NamedModal name="Първи" />, { wrapper });
      const newer = render(<NamedModal name="Втори" />, { wrapper });

      expect(page).toHaveAttribute("inert");
      expect(older.container).toHaveAttribute("inert");
      expect(newer.container.closest("[inert]")).toBeNull();

      if (closesFirst === "older") {
        older.unmount();
        expect(page).toHaveAttribute("inert");
        expect(newer.container.closest("[inert]")).toBeNull();
        newer.unmount();
      } else {
        newer.unmount();
        expect(page).toHaveAttribute("inert");
        expect(older.container).not.toHaveAttribute("inert");
        expect(older.container).not.toHaveAttribute("aria-hidden");
        older.unmount();
      }

      expect(page).not.toHaveAttribute("inert");
      expect(page).not.toHaveAttribute("aria-hidden");
    });
  });

  it("restores only the attributes it added", () => {
    const authorInert = document.createElement("div");
    authorInert.setAttribute("inert", "");
    const authorExposed = document.createElement("div");
    authorExposed.setAttribute("aria-hidden", "false");
    document.body.append(authorInert, authorExposed);

    const { unmount } = render(<NamedModal name="Първи" />);
    expect(authorInert).toHaveAttribute("aria-hidden", "true");
    expect(authorExposed).toHaveAttribute("inert");
    unmount();

    expect(authorInert).toHaveAttribute("inert", "");
    expect(authorInert).not.toHaveAttribute("aria-hidden");
    expect(authorExposed).toHaveAttribute("aria-hidden", "false");
    expect(authorExposed).not.toHaveAttribute("inert");
    authorInert.remove();
    authorExposed.remove();
  });

  it("lets a modal opened inside the isolated page take over", () => {
    const portaled = render(<NamedModal name="Първи" />);
    const slot = page.appendChild(document.createElement("div"));
    const inPage = render(<NamedModal name="Втори" />, { container: slot });
    const pageButton = page.querySelector("button")!;

    expect(page).not.toHaveAttribute("inert");
    expect(screen.getByRole("dialog", { name: "Втори" }).closest("[inert]")).toBeNull();
    expect(pageButton).toHaveAttribute("inert");
    expect(portaled.container).toHaveAttribute("inert");

    inPage.unmount();
    expect(page).toHaveAttribute("inert");
    expect(pageButton).not.toHaveAttribute("inert");
    portaled.unmount();
    expect(page).not.toHaveAttribute("inert");
  });

  it("leaves an open native dialog, such as a lost connection, usable", () => {
    const connection = document.createElement("div");
    connection.innerHTML = '<dialog open><button type="button">Опитай пак</button></dialog>';
    document.body.append(connection);

    const { unmount } = render(<NamedModal name="Първи" />);
    expect(page).toHaveAttribute("inert");
    expect(connection).not.toHaveAttribute("inert");
    expect(connection).not.toHaveAttribute("aria-hidden");
    unmount();
    connection.remove();
  });

  it("releases the page while a retained route hides the modal and isolates again when it returns", () => {
    const { rerender } = render(<Activity mode="visible"><NamedModal name="Първи" /></Activity>);
    expect(page).toHaveAttribute("inert");

    rerender(<Activity mode="hidden"><NamedModal name="Първи" /></Activity>);
    expect(page).not.toHaveAttribute("inert");
    expect(page).not.toHaveAttribute("aria-hidden");

    rerender(<Activity mode="visible"><NamedModal name="Първи" /></Activity>);
    expect(page).toHaveAttribute("inert");
  });
});
