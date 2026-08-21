import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useModal } from "../use-modal";

function ModalHarness({ onClose }: { onClose: () => void }) {
  const { ref } = useModal<HTMLElement>({ open: true, onClose });
  return (
    <section ref={ref}>
      <button type="button">Вътрешно действие</button>
    </section>
  );
}

describe("useModal", () => {
  it("не рестартира focus trap-а, когато onClose callback-ът се смени", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    const restoreFocus = vi.spyOn(outside, "focus");

    const { rerender, unmount } = render(<ModalHarness onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Вътрешно действие" })).toHaveFocus();
    restoreFocus.mockClear();

    rerender(<ModalHarness onClose={vi.fn()} />);

    expect(restoreFocus).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Вътрешно действие" })).toHaveFocus();

    unmount();
    outside.remove();
  });
});
