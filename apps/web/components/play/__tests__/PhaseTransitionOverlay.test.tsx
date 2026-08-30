import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhaseTransitionOverlay } from "../PhaseTransitionOverlay";

describe("PhaseTransitionOverlay", () => {
  it("announces the new phase without exposing the decorative sigil", () => {
    const { container } = render(
      <PhaseTransitionOverlay
        phase="night"
        mode="werewolves_classic"
        narratorVoice="classic"
        pulseKey={1}
      />,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByRole("status")).toHaveTextContent("Нощ");
    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });
});
