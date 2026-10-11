import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SlideVote } from "../SlideVote";
import type { TutorialMode, TutorialPractice } from "../tutorial-scenario";

const EMPTY: TutorialPractice = { night: null, vote: null, visited: [] };

function Vote({ mode = "werewolves_classic", initial = EMPTY, onChange = () => {} }: {
  mode?: TutorialMode;
  initial?: TutorialPractice;
  onChange?: (practice: TutorialPractice) => void;
}) {
  const [practice, setPractice] = useState(initial);
  return <SlideVote mode={mode} practice={practice} continueHref={null}
    onPracticeChange={(value) => { onChange(value); setPractice(value); }} />;
}

describe("tutorial vote exercise", () => {
  it("does not present a working vote before its handlers are ready", () => {
    const document = new DOMParser().parseFromString(renderToString(<Vote />), "text/html");
    expect(document.querySelector("fieldset")?.hasAttribute("disabled")).toBe(true);
    expect(document.querySelector('button[type="submit"]')?.hasAttribute("disabled")).toBe(true);
  });
  it("distinguishes selection from confirmation and announces the result", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Vote onChange={onChange} />);

    const submit = screen.getByRole("button", { name: "Потвърди гласа" });
    const result = screen.getByRole("status");
    expect(submit).toBeDisabled();
    expect(screen.getByRole("group", { name: "Примерно гласуване" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Борис" }));
    expect(submit).toBeEnabled();
    expect(result).toHaveTextContent("Гласът се отчита след потвърждение.");
    expect(screen.getByText("Избран играч:")).toHaveTextContent("Борис");
    expect(onChange).not.toHaveBeenCalled();

    await user.click(submit);
    expect(result).toHaveTextContent("Гласът ти за Борис е потвърден.");
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "Галя" }));
    expect(result).toHaveTextContent("Последният потвърден глас е за Борис.");
    expect(result).toHaveTextContent("Новият избор още не е изпратен.");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(result).toHaveTextContent("Гласът ти за Галя е потвърден.");
    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY, vote: "galya" });
  });

  it("ignores a submit without a player and leaves the exercise local", () => {
    const onChange = vi.fn();
    const { container } = render(<Vote onChange={onChange} />);
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByRole("status")).toHaveTextContent("Гласът се отчита след потвърждение.");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("supports native radio keyboard selection and keyboard submission", async () => {
    const user = userEvent.setup();
    render(<Vote />);

    await user.tab();
    expect(screen.getByText("Изборът не е потвърждение")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("radio", { name: "Анна" })).toHaveFocus();
    await user.keyboard(" ");
    expect(screen.getByRole("radio", { name: "Анна" })).toBeChecked();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Борис" })).toBeChecked();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("Гласът ти за Борис е потвърден.");
  });

  it("restores a committed vote and preserves the night result and read clues on replacement", async () => {
    const onChange = vi.fn();
    render(<Vote initial={{ night: "boris", vote: "anna", visited: ["galya"] }} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "Анна" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Потвърди гласа" })).toBeDisabled();
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Галя" }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Потвърди гласа" }));
    expect(onChange).toHaveBeenCalledWith({ night: "boris", vote: "galya", visited: ["galya"] });
  });

  it("limits sport voting to the example nominees and explains nomination timing", () => {
    render(<Vote mode="mafia_sport" />);
    expect(screen.getByRole("group", { name: "Номинираните на масата" })).toBeInTheDocument();
    expect(screen.getByText(/номинираш по време на своята реч/)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });
});
