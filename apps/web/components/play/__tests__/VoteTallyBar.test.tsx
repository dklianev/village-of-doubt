import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VoteTallyBar } from "@/components/play/VoteTallyBar";

describe("VoteTallyBar", () => {
  it("shows the empty vote state before anyone votes", () => {
    render(<VoteTallyBar items={[]} maxVotes={3} />);

    expect(screen.getByText("Още няма подадени гласове. Първият глас често задава посоката на целия ден.")).toBeInTheDocument();
  });

  it("renders current vote counts in a non-focusable live region", () => {
    render(
      <VoteTallyBar
        maxVotes={4}
        items={[
          { targetUserId: "u2", targetName: "Борис", count: 2, hasMayorVote: false },
          { targetUserId: "u3", targetName: "Вяра", count: 1, hasMayorVote: true },
        ]}
      />,
    );

    const tally = screen.getByRole("region", { name: "Текущо броене на гласовете" });
    expect(tally).not.toHaveAttribute("tabindex");
    expect(tally).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Борис")).toBeInTheDocument();
    expect(screen.getByText("Вяра")).toBeInTheDocument();
    expect(screen.getByText("кметски глас при равенство")).toBeInTheDocument();
  });
});
