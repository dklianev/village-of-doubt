import { act, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameRulesContents } from "../GameRulesPhaseTimeline";

const ids = ["rules-objective", "rules-basics", "rules-phases", "rules-details"];
let measure: () => void;

function Page() {
  return <><GameRulesContents familyPath="mafia" />{ids.map(id => <section id={id} key={id} />)}</>;
}

describe("rules contents orientation", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/mafia/rules");
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { measure = callback; }
      observe() {}
      disconnect() {}
    });
  });

  it("uses the existing rules client boundary without moving the page to the client", () => {
    const source = (file: string) => readFileSync(resolve(process.cwd(), "components/games", file), "utf8");
    expect(source("GameRulesPhaseTimeline.tsx")).toMatch(/^"use client";/);
    expect(source("GameRulesPhaseTimeline.tsx")).toContain('export { GameRulesContents } from "./GameRulesContents"');
    expect(source("GameRulesContents.tsx")).not.toMatch(/^"use client";/);
    expect(source("game-rules-page.tsx")).not.toMatch(/^"use client";/);
    expect(source("game-rules-page.tsx")).not.toContain('from "./GameRulesContents"');
    expect(source("game-rules-page.tsx")).toMatch(/import\s*\{\s*GameRulesContents,\s*GameRulesPhaseTimeline,/);
  });

  it.each(["mafia", "werewolf"] as const)("server-renders the complete %s index before hydration", (familyPath) => {
    const markup = renderToStaticMarkup(<GameRulesContents familyPath={familyPath} />);
    const document = new DOMParser().parseFromString(markup, "text/html");
    const links = [...document.querySelectorAll("nav a")];
    expect(links.map(link => link.getAttribute("href"))).toEqual([
      ...ids.map(id => `#${id}`), `/${familyPath}/roles`,
    ]);
    expect(document.querySelector('a[aria-current="location"]')?.textContent).toBe("Цел на играта");
  });

  it("marks the direct-link section and follows hash back/forward", () => {
    window.history.replaceState(null, "", "/mafia/rules#rules-phases");
    render(<Page />);
    expect(screen.getByRole("link", { name: "Ход на играта" })).toHaveAttribute("aria-current", "location");
    act(() => {
      window.history.replaceState(null, "", "#rules-basics");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByRole("link", { name: "Преди началото" })).toHaveAttribute("aria-current", "location");
    expect(document.querySelectorAll('[aria-current="location"]')).toHaveLength(1);
  });

  it("tracks the reading position without moving keyboard focus", () => {
    render(<Page />);
    ids.forEach((id, index) => vi.spyOn(document.getElementById(id)!, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, (index - 2) * 500 + 100, 600, 450)));
    const link = screen.getByRole("link", { name: "Всички роли" });
    link.focus();
    fireEvent.scroll(window);
    expect(screen.getByRole("link", { name: "Ход на играта" })).toHaveAttribute("aria-current", "location");
    expect(link).toHaveFocus();
  });

  it("exposes bounded scroll controls when the rail overflows", () => {
    const { container } = render(<Page />);
    const rail = container.querySelector<HTMLElement>(".rules-contents-rail")!;
    Object.defineProperties(rail, { scrollWidth: { value: 700 }, clientWidth: { value: 250 } });
    rail.scrollBy = vi.fn();
    act(() => measure());
    expect(screen.getByRole("navigation")).toHaveAttribute("data-overflow", "true");
    expect(screen.getByRole("button", { name: "Предишни раздели" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Следващи раздели" }));
    expect(rail.scrollBy).toHaveBeenCalledWith({ left: 187.5, behavior: "instant" });
    rail.scrollLeft = 450;
    fireEvent.scroll(rail);
    expect(screen.getByRole("button", { name: "Следващи раздели" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Предишни раздели" })).toBeEnabled();
  });
});
