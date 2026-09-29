import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SlideNight } from "../SlideNight";
import { TUTORIAL_MODES, type TutorialMode, type TutorialPractice } from "../tutorial-scenario";

function Night({ mode = "werewolves_classic", onChange = () => {} }: {
  mode?: TutorialMode;
  onChange?: (practice: TutorialPractice) => void;
}) {
  const [practice, setPractice] = useState<TutorialPractice>({ night: null, vote: "galya", visited: ["anna"] });
  return <SlideNight mode={mode} practice={practice} continueHref={null}
    onPracticeChange={(value) => { onChange(value); setPractice(value); }} />;
}

describe("tutorial night exercise", () => {
  it("does not accept a radio choice before its handlers are ready", () => {
    const document = new DOMParser().parseFromString(renderToString(<Night />), "text/html");
    expect(document.querySelector("fieldset")?.hasAttribute("disabled")).toBe(true);
    expect(document.querySelector('button[type="submit"]')?.hasAttribute("disabled")).toBe(true);
  });

  it.each(TUTORIAL_MODES)("shows a private authored result only after confirmation in %s", async (mode) => {
    const onChange = vi.fn();
    render(<Night mode={mode} onChange={onChange} />);
    const user = userEvent.setup();
    const confirm = screen.getByRole("button", { name: "Потвърди проверката" });
    expect(confirm).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "Борис" }));
    expect(confirm).toBeEnabled();
    expect(screen.getByRole("status")).not.toHaveTextContent("Личен резултат");
    expect(onChange).not.toHaveBeenCalled();
    await user.click(confirm);
    expect(screen.getByRole("status")).toHaveTextContent("Личен резултат");
    expect(screen.getByRole("status")).toHaveTextContent(mode === "werewolves_classic" ? "Борис е нощна заплаха." : "Борис е от Мафията.");
    expect(onChange).toHaveBeenCalledWith({ night: "boris", vote: "galya", visited: ["anna"] });
    expect(confirm).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "Анна" }));
    expect(screen.getByRole("status")).not.toHaveTextContent("Личен резултат");
    expect(onChange).toHaveBeenCalledTimes(1);
    await user.click(confirm);
    expect(screen.getByRole("status")).toHaveTextContent(mode === "werewolves_classic" ? "Анна не е нощна заплаха." : "Анна не е от Мафията.");
  });

  it("ignores submission without a selected player", () => {
    const onChange = vi.fn();
    const { container } = render(<Night onChange={onChange} />);
    fireEvent.submit(container.querySelector("form")!);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).not.toHaveTextContent("Личен резултат");
  });
});
