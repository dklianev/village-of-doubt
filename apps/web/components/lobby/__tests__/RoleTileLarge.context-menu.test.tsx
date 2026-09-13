import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { RoleTileLarge } from "../RoleTileLarge";

function Tile({ readonly = false, reserve = false, count: initialCount = 1 }) {
  const [count, setCount] = useState(initialCount);
  return <RoleTileLarge
    family="werewolves"
    role={reserve ? "ordinary_villager" : "healer"}
    count={count}
    readonly={readonly}
    reserve={reserve}
    onDecrement={() => setCount((value) => value - 1)}
    onOpen={() => {}}
  />;
}

describe("RoleTileLarge context menu", () => {
  it.each([
    { name: "readonly", readonly: true, reserve: false, count: 1 },
    { name: "reserve", readonly: false, reserve: true, count: 2 },
    { name: "empty", readonly: false, reserve: false, count: 0 },
  ])("does not mutate a $name role and leaves the native menu available", ({ readonly, reserve, count }) => {
    render(<Tile readonly={readonly} reserve={reserve} count={count} />);
    const tile = screen.getByRole("button", { name: reserve ? /Селянин/ : /^\d+\s*Лечител/ });
    const nativeMenuAllowed = fireEvent.contextMenu(tile);
    expect(within(tile).getByText(String(count), { exact: true })).toBeInTheDocument();
    expect(nativeMenuAllowed).toBe(true);
  });

  it("removes an editable role once and does not decrement below zero", () => {
    render(<Tile />);
    const tile = screen.getByRole("button", { name: /^1\s*Лечител/ });
    expect(fireEvent.contextMenu(tile)).toBe(false);
    expect(within(tile).getByText("0", { exact: true })).toBeInTheDocument();
    expect(fireEvent.contextMenu(tile)).toBe(true);
    expect(within(tile).getByText("0", { exact: true })).toBeInTheDocument();
  });

  it("leaves the native menu available when no decrement action is supplied", () => {
    render(<RoleTileLarge family="werewolves" role="healer" count={1} onOpen={() => {}} />);
    const tile = screen.getByRole("button", { name: /^1\s*Лечител/ });
    expect(fireEvent.contextMenu(tile)).toBe(true);
    expect(within(tile).getByText("1", { exact: true })).toBeInTheDocument();
  });
});
