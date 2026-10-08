import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { RoleRevealGate, RoleRevealRitual } from "../RoleRevealRitual";

describe("RoleRevealRitual", () => {
  it("keeps the dealt card face down until the player turns it", () => {
    render(<RoleRevealRitual role={{ role: "seer", roleNameBg: "Гадателка" }} family="werewolves" onDone={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Твоята тайна карта" });
    expect(dialog).toHaveAttribute("data-flipped", "false");
    expect(dialog).not.toHaveAttribute("data-team");
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

  it("hands focus to the card once a delayed deal becomes visible", () => {
    vi.useFakeTimers();
    try {
      render(<RoleRevealRitual role={{ role: "seer", roleNameBg: "Гадателка" }} family="werewolves" enterDelayMs={1750} onDone={vi.fn()} />);
      (document.activeElement as HTMLElement | null)?.blur();
      act(() => { vi.advanceTimersByTime(1900); });
      expect(screen.getByRole("button", { name: "Обърни картата" })).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats Escape as acknowledging the card", () => {
    const onDone = vi.fn();
    render(<RoleRevealRitual role={{ role: "seer", roleNameBg: "Гадателка" }} family="werewolves" onDone={onDone} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("returns focus to this room's toggle even when an older route is retained", () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    try {
      const currentToggle = createRef<HTMLButtonElement>();
      render(<>
        <button className="play-personal-toggle">Предишна стая</button>
        <button ref={currentToggle} className="play-personal-toggle">Текуща стая</button>
        <RoleRevealGate role={{ role: "seer", roleNameBg: "Гадателка" }} family="werewolves" transitioning={false} seatKey="focus:u1" returnFocusRef={currentToggle} />
      </>);
      fireEvent.keyDown(document, { key: "Escape" });
      act(() => { vi.advanceTimersByTime(50); });
      expect(screen.getByRole("button", { name: "Текуща стая" })).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not deal the card again after a reload in the same tab, and never stores the role", () => {
    sessionStorage.clear();
    const role = { role: "seer", roleNameBg: "Гадателка" } as const;
    const first = render(<RoleRevealGate role={role} family="werewolves" transitioning={false} seatKey="ROOM1:u1" />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();

    render(<RoleRevealGate role={role} family="werewolves" transitioning={false} seatKey="ROOM1:u1" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(JSON.stringify({ ...sessionStorage })).not.toMatch(/seer|Гадателка/);
  });

  it.each(["seer", "werewolf", "jester", "don"] as const)("keeps %s's faction concealed until the turn", (role) => {
    render(<RoleRevealRitual role={{ role, roleNameBg: "Учебна роля" }} family={role === "don" ? "mafia" : "werewolves"} onDone={vi.fn()} />);
    expect(screen.getByRole("dialog")).not.toHaveAttribute("data-team");
    fireEvent.click(screen.getByRole("button", { name: "Обърни картата" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("data-team");
  });

  it("deals a new room instance even when it reuses the invite code and role", () => {
    sessionStorage.clear();
    const props = { role: { role: "seer", roleNameBg: "Гадателка" } as const, family: "werewolves" as const, transitioning: false };
    const first = render(<RoleRevealGate {...props} seatKey="instance-1:u1" />);
    fireEvent.keyDown(document, { key: "Escape" });
    first.unmount();
    render(<RoleRevealGate {...props} seatKey="instance-2:u1" />);
    expect(screen.getByRole("dialog", { name: "Твоята тайна карта" })).toBeInTheDocument();
  });

  it("remains usable with unavailable session storage", () => {
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
    try {
      render(<RoleRevealGate role={{ role: "seer", roleNameBg: "Гадателка" }} family="werewolves" transitioning={false} seatKey="blocked:u1" />);
      fireEvent.click(screen.getByRole("button", { name: "Обърни картата" }));
      fireEvent.click(screen.getByRole("button", { name: "Запомних" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      read.mockRestore();
      write.mockRestore();
    }
  });
});
