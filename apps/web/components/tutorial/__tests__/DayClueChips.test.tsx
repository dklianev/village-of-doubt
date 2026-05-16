import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DayClueChips } from "../DayClueChips";

describe("DayClueChips", () => {
  it("shows five face-down chips", () => {
    render(<DayClueChips />);

    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("flips a chip and reveals its clue", async () => {
    const user = userEvent.setup();
    render(<DayClueChips />);

    await user.click(screen.getByLabelText("Разкрий Анна"));

    expect(screen.getByText(/Говори спокойно/)).toBeInTheDocument();
  });

  it("counts revealed chips", async () => {
    const user = userEvent.setup();
    render(<DayClueChips />);

    expect(screen.getByText(/Посетени: 0/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("Разкрий Анна"));
    expect(screen.getByText(/Посетени: 1/)).toBeInTheDocument();
  });
});
