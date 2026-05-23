import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("renders an accessible dialog when open", () => {
    const { getByRole } = render(
      <Dialog open onOpenChange={() => {}} title="Потвърди">
        Съдържание
      </Dialog>,
    );
    expect(getByRole("dialog", { name: "Потвърди" })).toBeDefined();
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
    expect(onOpenChange).toHaveBeenCalled();
  });
});
