import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TutorialPlayerChoice } from "../TutorialPlayerChoice";
import type { PlayerId } from "../tutorial-scenario";

describe("tutorial player choice", () => {
  it("renders three named native radios with distinct decorative portraits", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <TutorialPlayerChoice name="night" legend="Примерна проверка" selected={null} onSelect={onSelect} />,
    );
    expect(screen.getByRole("group", { name: "Примерна проверка" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    for (const name of ["Анна", "Борис", "Галя"]) {
      const radio = screen.getByRole("radio", { name });
      expect(radio).toHaveAttribute("type", "radio");
      expect(radio).toHaveAttribute("name", "night");
      expect(radio).not.toBeChecked();
      expect(radio.closest("label")?.querySelector("img")).toHaveAttribute("alt", "");
    }
    expect(new Set([...container.querySelectorAll("img")].map((image) => image.src)).size).toBe(3);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("offers one keyboard tab stop and arrow-key selection without implicit confirmation", async () => {
    const onSelect = vi.fn();
    function Choice() {
      const [selected, setSelected] = useState<PlayerId | null>(null);
      return <TutorialPlayerChoice name="vote" legend="Примерно гласуване" selected={selected}
        onSelect={(id) => { onSelect(id); setSelected(id); }} />;
    }
    render(<Choice />);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("radio", { name: "Анна" })).toHaveFocus();
    await user.keyboard(" ");
    expect(screen.getByRole("radio", { name: "Анна" })).toBeChecked();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Борис" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Анна" })).not.toBeChecked();
    expect(onSelect.mock.calls).toEqual([["anna"], ["boris"]]);
  });
});
