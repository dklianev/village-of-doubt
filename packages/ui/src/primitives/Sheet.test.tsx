import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("composes a local tool surface without replacing dialog semantics", () => {
    const { getByRole } = render(
      <Sheet open onOpenChange={() => {}} title="Правила" className="room-reference" style={{ maxWidth: 640 }}>
        Съдържание
      </Sheet>,
    );
    const dialog = getByRole("dialog", { name: "Правила" });
    expect(dialog.classList.contains("ds-sheet")).toBe(true);
    expect(dialog.classList.contains("room-reference")).toBe(true);
    expect(dialog.style.maxWidth).toBe("640px");
  });
  it("renders an accessible dialog when open and titled", () => {
    const { container, getByRole } = render(
      <Sheet open onOpenChange={() => {}} title="Писма">
        Съдържание
      </Sheet>,
    );
    expect(getByRole("dialog", { name: "Писма" }).classList.contains("ds-sheet")).toBe(true);
    expect(container.ownerDocument.head.textContent + container.ownerDocument.body.textContent).toContain(
      "@keyframes ds-sheet-open",
    );
  });

  it("renders children", () => {
    const { getByText } = render(
      <Sheet open onOpenChange={() => {}} title="Писма">
        Съдържание
      </Sheet>,
    );
    expect(getByText("Съдържание")).toBeDefined();
  });

  it("exposes the workspace size as an additive primitive variant", () => {
    const { getByRole } = render(
      <Sheet open onOpenChange={() => {}} title="Писма" size="workspace" closeLabel="Затвори писмата">
        Съдържание
      </Sheet>,
    );

    expect(getByRole("dialog", { name: "Писма" }).getAttribute("data-size")).toBe("workspace");
    expect(getByRole("button", { name: "Затвори писмата" })).toBeDefined();
  });

  it("locks both page scroll containers while a workspace is open", () => {
    const { unmount } = render(
      <Sheet open onOpenChange={() => {}} title="Писма" size="workspace">
        Съдържание
      </Sheet>,
    );

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");

    unmount();
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.position).toBe("");
  });

  it("does not render content when closed", () => {
    const { container, queryByText } = render(
      <Sheet open={false} onOpenChange={() => {}} title="Писма">
        Съдържание
      </Sheet>,
    );
    expect(queryByText("Съдържание")).toBeNull();
    expect(container.ownerDocument.getElementById("werewolf-ui-sheet-styles")?.textContent).toContain(
      "@keyframes ds-sheet-close",
    );
  });

  it("forwards close requests through onOpenChange", () => {
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange} title="Писма">
        Съдържание
      </Sheet>,
    );
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onOpenChange).toHaveBeenCalled();
  });

  it("lets a controlled sheet restore focus to its external trigger on close", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const restoreFocus = (event: Event) => {
      event.preventDefault();
      trigger.focus();
    };
    const { rerender, unmount } = render(
      <Sheet open onOpenChange={() => {}} onCloseAutoFocus={restoreFocus} title="Писма">
        <button>Съдържание</button>
      </Sheet>,
    );
    try {
      rerender(<Sheet open={false} onOpenChange={() => {}} onCloseAutoFocus={restoreFocus} title="Писма">Съдържание</Sheet>);
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    } finally {
      unmount();
      trigger.remove();
    }
  });
});
