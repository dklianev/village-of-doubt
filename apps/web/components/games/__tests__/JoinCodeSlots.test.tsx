import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { JoinCodeSlots } from "../join-code-slots";

function Fixture({ initial = "", invalid = false, autoFocus = false }) {
  const [value, setValue] = useState(initial);
  return <>
    <JoinCodeSlots value={value} onChange={setValue} invalid={invalid} describedBy="code-error" autoFocus={autoFocus} />
    <output data-testid="value">{value}</output>
    <p id="code-error">Провери кода.</p>
  </>;
}

const slot = (index: number) => screen.getByRole("textbox", { name: `Символ ${index} от 6` });
const values = () => screen.getAllByRole("textbox").map((input) => (input as HTMLInputElement).value);

describe("JoinCodeSlots", () => {
  it("does not steal focus or open a touch keyboard on mount, even with the optional autofocus hint", () => {
    render(<Fixture autoFocus />);
    expect(document.body).toHaveFocus();
  });

  it("accepts sequential lowercase typing and advances through the six slots", async () => {
    render(<Fixture />);
    await userEvent.type(slot(1), "abc234");
    expect(values()).toEqual(["A", "B", "C", "2", "3", "4"]);
    expect(slot(6)).toHaveFocus();
  });

  it("clears the current symbol without shifting later symbols and allows replacement", async () => {
    render(<Fixture initial="ABC234" />);
    await userEvent.click(slot(3));
    await userEvent.keyboard("{Backspace}");
    expect(values()).toEqual(["A", "B", "", "2", "3", "4"]);
    expect(screen.getByTestId("value")).toHaveTextContent("AB 234");
    expect(slot(3)).toHaveFocus();
    await userEvent.keyboard("d");
    expect(values()).toEqual(["A", "B", "D", "2", "3", "4"]);
    expect(slot(4)).toHaveFocus();
  });

  it("backspaces from an empty slot to the previous symbol without collapsing positions", async () => {
    render(<Fixture initial="ABC234" />);
    await userEvent.click(slot(3));
    await userEvent.keyboard("{Backspace}{Backspace}");
    expect(values()).toEqual(["A", "", "", "2", "3", "4"]);
    expect(slot(2)).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}{Backspace}{Backspace}");
    expect(values()).toEqual(["", "", "", "2", "3", "4"]);
    expect(slot(1)).toHaveFocus();
  });

  it("supports Delete and touch clearing in the middle without shifting symbols", async () => {
    render(<Fixture initial="ABC234" />);
    await userEvent.click(slot(2));
    await userEvent.keyboard("{Delete}");
    expect(values()).toEqual(["A", "", "C", "2", "3", "4"]);
    fireEvent.change(slot(4), { target: { value: "" } });
    expect(values()).toEqual(["A", "", "C", "", "3", "4"]);
  });

  it("selects the focused symbol for replacement using pointer or arrow navigation", async () => {
    render(<Fixture initial="ABC234" />);
    await userEvent.click(slot(3));
    await userEvent.keyboard("{ArrowLeft}z{ArrowRight}8");
    expect(values()).toEqual(["A", "Z", "C", "8", "3", "4"]);
  });

  it.each(["abc234", "ABC-234", "https://example.test/werewolf/join/ABC234"])("pastes a full code or invitation %s", async (code) => {
    render(<Fixture initial="DEF567" />);
    await userEvent.click(slot(4));
    await userEvent.paste(code);
    expect(values()).toEqual(["A", "B", "C", "2", "3", "4"]);
    expect(slot(6)).toHaveFocus();
  });

  it("pastes partial codes and focuses the next empty slot", async () => {
    render(<Fixture />);
    await userEvent.click(slot(1));
    await userEvent.paste("abc");
    expect(values()).toEqual(["A", "B", "C", "", "", ""]);
    expect(slot(4)).toHaveFocus();
  });

  it.each([1, 3, 6])("accepts six-character autofill at slot %s", (index) => {
    render(<Fixture />);
    fireEvent.change(slot(index), { target: { value: "abc234" } });
    expect(values()).toEqual(["A", "B", "C", "2", "3", "4"]);
    expect(slot(1)).toHaveAttribute("autocomplete", "one-time-code");
    expect(slot(1)).toHaveAttribute("maxlength", "6");
  });

  it("ignores invalid characters and invalid paste without destroying existing symbols", async () => {
    render(<Fixture initial="ABC234" />);
    await userEvent.click(slot(2));
    await userEvent.keyboard("01io!");
    await userEvent.paste("01io!");
    expect(values()).toEqual(["A", "B", "C", "2", "3", "4"]);
  });

  it("keeps trailing typing confined to the last slot", async () => {
    render(<Fixture />);
    await userEvent.type(slot(1), "abc2345");
    expect(values()).toEqual(["A", "B", "C", "2", "3", "5"]);
  });

  it("focuses and describes invalid code after an explicit submit", () => {
    const { rerender } = render(<Fixture />);
    rerender(<Fixture invalid />);
    expect(slot(1)).toHaveFocus();
    expect(slot(1)).toHaveAttribute("aria-invalid", "true");
    expect(slot(1)).toHaveAccessibleDescription("Провери кода.");
  });
});
