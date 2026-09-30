import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RoleRevealRitual } from "../RoleRevealRitual";

describe("RoleRevealRitual", () => {
  it("keeps the dealt card face down until the player turns it", () => {
    render(<RoleRevealRitual role={{ role: "seer", roleNameBg: "Гадателка" }} family="werewolves" onDone={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Твоята тайна карта" });
    expect(dialog).toHaveAttribute("data-flipped", "false");
    expect(screen.queryByRole("heading", { name: "Гадателка" })).not.toBeInTheDocument();
    // Face down is concealed in the DOM too: no role name, no role art until the turn.
    expect(document.body).not.toHaveTextContent("Гадателка");
    expect(document.body.innerHTML).not.toContain("seer");
    expect(screen.getByRole("button", { name: "Обърни картата" })).toHaveFocus();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("reveals the role, its side and goal, then hands focus to the acknowledgement", () => {
    const onDone = vi.fn();
    render(<RoleRevealRitual role={{ role: "seer", roleNameBg: "Гадателка" }} family="werewolves" onDone={onDone} />);

    fireEvent.click(screen.getByRole("button", { name: "Обърни картата" }));

    const dialog = screen.getByRole("dialog", { name: "Гадателка" });
    expect(dialog).toHaveAttribute("data-flipped", "true");
    expect(dialog).toHaveAttribute("data-team", "village");
    expect(screen.getByText("Селяни")).toBeInTheDocument();
    expect(screen.getByText("Цел")).toBeInTheDocument();
    const done = screen.getByRole("button", { name: "Запомних" });
    expect(done).toHaveFocus();

    fireEvent.click(done);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("uses the city label and the faction accent for a Mafia role", () => {
    render(<RoleRevealRitual role={{ role: "don", roleNameBg: "Кръстник" }} family="mafia" onDone={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Обърни картата" }));

    expect(screen.getByRole("dialog", { name: "Кръстник" })).toHaveAttribute("data-team", "mafia");
    expect(screen.getByText("Мафия")).toBeInTheDocument();
  });

  it("treats Escape as acknowledging the card", () => {
    const onDone = vi.fn();
    render(<RoleRevealRitual role={{ role: "seer", roleNameBg: "Гадателка" }} family="werewolves" onDone={onDone} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
