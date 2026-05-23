import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("renders an accessible dialog when open and titled", () => {
    const { getByRole } = render(
      <Sheet open onOpenChange={() => {}} title="Писма">
        Съдържание
      </Sheet>,
    );
    expect(getByRole("dialog", { name: "Писма" })).toBeDefined();
  });

  it("renders children", () => {
    const { getByText } = render(
      <Sheet open onOpenChange={() => {}} title="Писма">
        Съдържание
      </Sheet>,
    );
    expect(getByText("Съдържание")).toBeDefined();
  });

  it("does not render content when closed", () => {
    const { queryByText } = render(
      <Sheet open={false} onOpenChange={() => {}} title="Писма">
        Съдържание
      </Sheet>,
    );
    expect(queryByText("Съдържание")).toBeNull();
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
});
