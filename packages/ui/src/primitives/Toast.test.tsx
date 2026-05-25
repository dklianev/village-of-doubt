import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toast } from "./Toast";

describe("Toast", () => {
  it("renders message when open", () => {
    const { getByText } = render(<Toast open message="Писмото е изпратено." />);
    expect(getByText("Писмото е изпратено.")).toBeDefined();
  });

  it("does not render message when closed", () => {
    const { queryByText } = render(<Toast open={false} message="Писмото е изпратено." />);
    expect(queryByText("Писмото е изпратено.")).toBeNull();
  });

  it("marks tone via data attribute", () => {
    const { getByRole } = render(<Toast open tone="error" message="Нещо прекъсна." />);
    expect(getByRole("status").dataset.dsToast).toBe("error");
  });

  it("marks stack index for stagger timing", () => {
    const { getByRole } = render(<Toast open index={2} message="Писмо" />);
    expect(getByRole("status").dataset.dsToastIndex).toBe("2");
  });

  it("normalizes invalid stack index values", () => {
    const { getByRole } = render(<Toast open index={-3} message="Писмо" />);
    expect(getByRole("status").dataset.dsToastIndex).toBe("0");
  });

  it("calls onDismiss from the close button", () => {
    const onDismiss = vi.fn();
    const { getByRole } = render(<Toast open message="Писмо" onDismiss={onDismiss} />);
    fireEvent.click(getByRole("button", { name: "Затвори" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
