import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhaseTransitionOverlay } from "../PhaseTransitionOverlay";

describe("PhaseTransitionOverlay", () => {
  it("does not cover the lobby with an introduction", () => {
    const { container } = render(<PhaseTransitionOverlay phase="lobby" mode="werewolves_classic" narratorVoice="classic" pulseKey={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces the finale without covering it with a second introduction", () => {
    const { container } = render(<PhaseTransitionOverlay phase="game_over" mode="werewolves_classic" narratorVoice="classic" pulseKey={1} />);
    expect(screen.getByRole("status")).toHaveClass("sr-only");
    expect(screen.getByRole("status")).toHaveTextContent("Край на играта");
    expect(container.querySelector(".phase-transition-overlay")).toBeNull();
  });

  it("does not animate the initial phase after loading or reconnecting", () => {
    const { container } = render(<PhaseTransitionOverlay phase="night" mode="mafia_free" narratorVoice="classic" pulseKey={0} />);
    expect(container).toBeEmptyDOMElement();
  });

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
