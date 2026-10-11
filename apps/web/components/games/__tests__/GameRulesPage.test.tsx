import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameRulesPage } from "../game-rules-page";

vi.mock("next/link", () => ({
  default: ({ prefetch: _prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => <a {...props} />,
}));

describe("rules reading flow", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  });
  it.each(["werewolves", "mafia"] as const)("puts the %s objective before phases and details", (family) => {
    render(<GameRulesPage family={family} />);
    const objective = screen.getByRole("heading", { name: "Цел на играта" });
    const phases = screen.getByRole("heading", { name: "Ход на играта" });
    expect(objective.compareDocumentPosition(phases) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "В правилата" });
    for (const link of within(nav).getAllByRole("link")) {
      const href = link.getAttribute("href")!;
      if (href.startsWith("#")) expect(document.querySelector(href)).not.toBeNull();
    }
    const basics = screen.getByRole("heading", { name: "Преди първата игра" });
    const details = screen.getByRole("region", { name: "Особености на играта" });
    expect(objective.compareDocumentPosition(basics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(basics.compareDocumentPosition(phases) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(phases.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelector("details")).toBeNull();
    expect(screen.getByRole("link", { name: "Кратък наръчник" })).toHaveAttribute("href", `/tutorial?game=${family === "mafia" ? "mafia_free" : "werewolves_classic"}&redirect=%2F${family === "mafia" ? "mafia" : "werewolf"}%2Fcreate`);
  });

  it("uses canonical role names and updates the selected phase", () => {
    render(<GameRulesPage family="mafia" />);
    fireEvent.click(screen.getByRole("radio", { name: "Спортна" }));
    fireEvent.click(document.querySelector('[data-phase="night"]')!);
    const details = document.getElementById("phase-detail-panel")!;
    expect(details).toHaveTextContent("Кръстникът");
    expect(details).not.toHaveTextContent("Донът");
    expect(screen.getByRole("status")).toHaveTextContent("Нощ, Нощни договорки");
    expect(document.querySelectorAll('.phase-node[aria-pressed="true"]')).toHaveLength(1);
    fireEvent.click(document.querySelector('[data-phase="voting"]')!);
    expect(within(details).getByRole("heading", { level: 3 })).toHaveTextContent("Гласуване");
    expect(details).toHaveTextContent("Обвинение");
  });

  it.each(["werewolves", "mafia"] as const)("focuses the %s result and only scrolls when it is outside the reading area", (family) => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
    render(<GameRulesPage family={family} />);
    const heading = document.getElementById("phase-detail-title")!;
    const button = document.querySelector<HTMLButtonElement>('[data-phase="voting"]')!;
    const focus = vi.spyOn(heading, "focus");
    const scroll = vi.fn();
    heading.scrollIntoView = scroll;
    expect(heading).toHaveAttribute("tabindex", "-1");

    for (const top of [100, -40, window.innerHeight + 30]) {
      scroll.mockClear();
      vi.spyOn(heading, "getBoundingClientRect").mockReturnValue(new DOMRect(24, top, 300, 35));
      button.focus();
      fireEvent.click(button);
      act(() => frames.shift()!(0));

      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(heading).toHaveFocus();
      expect(heading).toHaveTextContent("Гласуване");
      expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
      if (top === 100) expect(scroll).not.toHaveBeenCalled();
      else expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
    }
  });

  it.each(["werewolves", "mafia"] as const)("provides a player action and bounded previous/next navigation for %s", (family) => {
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
    render(<GameRulesPage family={family} />);
    const previous = screen.getByRole("button", { name: "Предишна фаза" });
    const next = screen.getByRole("button", { name: "Следваща фаза" });
    expect(previous).toBeDisabled();
    for (let index = 0; index < 6; index++) {
      const details = document.getElementById("phase-detail-panel")!;
      expect(within(details).getByRole("heading", { name: "Какво правиш ти" })).toBeVisible();
      expect(details.querySelector(".phase-player-action p")!.textContent!.length).toBeGreaterThan(40);
      expect(document.querySelectorAll('.phase-node[aria-pressed="true"]')).toHaveLength(1);
      if (index < 5) fireEvent.click(next);
    }
    expect(next).toBeDisabled();
    fireEvent.click(previous);
    expect(document.getElementById("phase-detail-title")).toHaveTextContent("Гласуване");
  });

  it("distinguishes the actual free and sport Mafia day flows and keeps the tutorial context", () => {
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
    render(<GameRulesPage family="mafia" />);
    const details = document.getElementById("phase-detail-panel")!;
    expect(screen.getByRole("radio", { name: "Свободна" })).toBeChecked();
    expect(document.querySelectorAll(".phase-node")).toHaveLength(6);
    fireEvent.click(document.querySelector('[data-phase="day_discussion"]')!);
    expect(details).toHaveTextContent("без отделни номинации и защити");

    fireEvent.click(screen.getByRole("radio", { name: "Спортна" }));
    expect(document.querySelectorAll(".phase-node")).toHaveLength(8);
    expect(details).toHaveTextContent("Само текущият говорител може да номинира");
    expect(screen.getByRole("link", { name: "Наръчник за спортна Мафия" })).toHaveAttribute("href", "/tutorial?game=mafia_sport&redirect=%2Fmafia%2Fcreate%3Fmode%3Dmafia_sport");
    fireEvent.click(screen.getByRole("button", { name: "Следваща фаза" }));
    expect(document.getElementById("phase-detail-title")).toHaveTextContent("Номинации");
    expect(details).toHaveTextContent("Тук не се подават нови");
    expect(details).toHaveTextContent("без защити и гласуване");
    fireEvent.click(screen.getByRole("button", { name: "Следваща фаза" }));
    expect(document.getElementById("phase-detail-title")).toHaveTextContent("Защита");
    fireEvent.click(screen.getByRole("button", { name: "Следваща фаза" }));
    expect(details).toHaveTextContent("няма пропускане на вот");
    fireEvent.click(screen.getByRole("button", { name: "Предишна фаза" }));
    fireEvent.click(screen.getByRole("radio", { name: "Свободна" }));
    expect(document.getElementById("phase-detail-title")).toHaveTextContent("Дневно обсъждане");
    expect(document.querySelector('[data-phase="defense"]')).toBeNull();
  });

  it("does not add sport nomination or defense phases to Werewolf", () => {
    render(<GameRulesPage family="werewolves" />);
    fireEvent.click(document.querySelector('[data-phase="day_discussion"]')!);
    expect(document.getElementById("phase-detail-panel")).toHaveTextContent("директно гласуване");
    expect(document.querySelector('[data-phase="nomination"]')).toBeNull();
    expect(document.querySelector('[data-phase="defense"]')).toBeNull();
    expect(screen.queryByRole("group", { name: "Формат на Мафия" })).toBeNull();
  });
});
