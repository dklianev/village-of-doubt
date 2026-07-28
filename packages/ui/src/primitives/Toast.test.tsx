import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toast } from "./Toast";

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
    const toast = getByRole("status");
    expect(toast.dataset.dsToastIndex).toBe("2");
    expect(toast.style.getPropertyValue("--ds-toast-delay")).toBe("0.12s");
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

  it("keeps a closing toast mounted until its exit safety timeout", () => {
    vi.useFakeTimers();
    const { getByRole, queryByRole, rerender } = render(<Toast open message="Писмо" />);

    rerender(<Toast open={false} message="Писмо" />);
    const closingToast = getByRole("status");
    expect(closingToast.dataset.state).toBe("closed");

    act(() => {
      vi.advanceTimersByTime(191);
    });
    expect(queryByRole("status")).toBeNull();
  });
});
