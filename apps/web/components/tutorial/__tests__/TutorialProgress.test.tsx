import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TutorialProgress, TUTORIAL_SCENE_LABELS } from "../TutorialProgress";

describe("compact tutorial progress", () => {
  it("keeps every scene available through a labeled native selector", async () => {
    const onJump = vi.fn();
    const { rerender } = render(<TutorialProgress current={2} onJump={onJump} continueHref={null} ready />);
    const selector = screen.getByRole("combobox", { name: "Сцена" });
    expect(selector).toHaveValue("2");
    expect(within(selector).getAllByRole("option")).toHaveLength(TUTORIAL_SCENE_LABELS.length);
    await userEvent.setup().selectOptions(selector, "4");
    expect(onJump).toHaveBeenCalledExactlyOnceWith(4);
    rerender(<TutorialProgress current={4} onJump={onJump} continueHref={null} ready />);
    expect(selector).toHaveValue("4");
    expect(screen.getByRole("button", { name: "4. Глас" })).toHaveAttribute("aria-current", "step");
  });

  it("keeps the selector disabled until practice is ready and preserves the skip destination", () => {
    render(<TutorialProgress current={2} onJump={vi.fn()} continueHref="/play?code=TEST" ready={false} />);
    expect(screen.getByRole("combobox", { name: "Сцена" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Към поканата" })).toHaveAttribute("href", "/play?code=TEST");
  });
});
