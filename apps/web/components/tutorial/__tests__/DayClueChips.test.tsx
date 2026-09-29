import { useState } from "react";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DayClueChips } from "../DayClueChips";
import type { TutorialPractice } from "../tutorial-scenario";

function Clues({ initial = { night: null, vote: null, visited: [] }, onChange = () => {} }: {
  initial?: TutorialPractice;
  onChange?: (practice: TutorialPractice) => void;
}) {
  const [practice, setPractice] = useState(initial);
  return <DayClueChips practice={practice} onPracticeChange={(value) => { onChange(value); setPractice(value); }} />;
}

describe("DayClueChips", () => {
  it("keeps clue buttons disabled until their handlers are ready", () => {
    const document = new DOMParser().parseFromString(renderToString(<Clues />), "text/html");
    const buttons = [...document.querySelectorAll("button")];
    expect(buttons).toHaveLength(3);
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });

  it("offers the same three named participants as the night and vote exercises", () => {
    render(<Clues />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    for (const name of ["Анна", "Борис", "Галя"]) {
      expect(screen.getByRole("button", { name: `Чуй ${name}` })).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.getByText("Прочетени: 0 / 3")).toBeInTheDocument();
  });

  it("reveals a clue without presenting it as a private role check", async () => {
    render(<Clues />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Чуй Анна" }));
    expect(screen.getByText(/Борис първо подозираше Галя/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Чуй Анна" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Личен резултат")).not.toBeInTheDocument();
  });

  it("never decreases the read count or duplicates a player when rereading clues", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Clues initial={{ night: "boris", vote: "anna", visited: [] }} onChange={onChange} />);
    for (const [name, count] of [["Анна", 1], ["Анна", 1], ["Борис", 2], ["Анна", 2], ["Галя", 3]] as const) {
      await user.click(screen.getByRole("button", { name: `Чуй ${name}` }));
      expect(screen.getByText(`Прочетени: ${count} / 3`)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Чуй Анна" })).toHaveAttribute("aria-pressed", "false");
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenLastCalledWith({ night: "boris", vote: "anna", visited: ["anna", "boris", "galya"] });
  });

  it("restores read progress independently of the currently open clue", async () => {
    const onChange = vi.fn();
    render(<Clues initial={{ night: null, vote: null, visited: ["anna", "galya"] }} onChange={onChange} />);
    expect(screen.getByText("Прочетени: 2 / 3")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Чуй Анна" }));
    expect(screen.getByText(/Борис първо подозираше Галя/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
