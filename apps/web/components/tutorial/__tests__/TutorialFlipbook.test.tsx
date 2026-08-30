import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TutorialFlipbook } from "../TutorialFlipbook";

const navigationState = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigationState.searchParams,
}));

const storedValues = new Map<string, string>();

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    clear: () => storedValues.clear(),
    getItem: (key: string) => storedValues.get(key) ?? null,
    removeItem: (key: string) => storedValues.delete(key),
    setItem: (key: string, value: string) => storedValues.set(key, value),
  },
});

describe("TutorialFlipbook", () => {
  beforeEach(() => {
    navigationState.searchParams = new URLSearchParams();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/tutorial");
  });

  it("presents the six rehearsal scenes as an accessible progress rail", () => {
    const { container } = render(<TutorialFlipbook />);

    const progress = screen.getByRole("navigation", { name: "Ход на репетицията" });
    expect(progress).toBeInTheDocument();

    for (const label of ["Събиране", "Нощ", "Ден", "Глас", "Развръзка", "Начало"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }

    expect(screen.getByRole("button", { name: /Събиране/ })).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("link", { name: "Продължи към игра" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Масата се събира." })).toBeInTheDocument();
    expect(container.querySelector(".tutorial-slide-copy")).toContainElement(
      screen.getByRole("heading", { level: 1, name: "Масата се събира." }),
    );
  });

  it("moves through the rehearsal while keeping the stage and controls in sync", async () => {
    const user = userEvent.setup();
    const { container } = render(<TutorialFlipbook />);

    const back = screen.getByRole("button", { name: "Предишна сцена" });
    expect(back).toBeDisabled();
    expect(container.querySelector('[data-tutorial-scene="setup"]')).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Следваща сцена" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Очите се затварят." })).toBeInTheDocument();
    const nightStage = container.querySelector('[data-tutorial-scene="night"]');
    expect(nightStage).toBeInTheDocument();
    expect(nightStage).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Сцена 2 от 6: Нощ");
    expect(screen.getByRole("button", { name: /Нощ/ })).toHaveAttribute("aria-current", "step");
    expect(back).toBeEnabled();
  });

  it("keeps the final family and reference destinations keyboard reachable", async () => {
    const user = userEvent.setup();
    render(<TutorialFlipbook />);

    await user.click(screen.getByRole("button", { name: /Начало/ }));

    expect(await screen.findByRole("link", { name: /Започни Върколак/ })).toHaveAttribute("href", "/werewolf/create");
    expect(screen.getByRole("link", { name: /Започни Мафия/ })).toHaveAttribute("href", "/mafia/create");
    expect(screen.getByRole("link", { name: /Всички роли/ })).toHaveAttribute("href", "/roles");
    expect(screen.queryByRole("button", { name: "Следваща сцена" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Продължи към игра" })).toBeInTheDocument();
  });

  it("keeps the requested game destination when the tutorial is skipped", () => {
    navigationState.searchParams = new URLSearchParams({ redirect: "/mafia/create" });

    render(<TutorialFlipbook />);

    expect(screen.getByRole("link", { name: "Прескочи" })).toHaveAttribute("href", "/mafia/create");
  });

  it.each([
    [2, "Очите се затварят."],
    [3, "Денят се буди. Какво остана?"],
    [4, "Гласът оставя следа."],
    [5, "Какво остава, когато утрото дойде."],
    [6, "Изборът сега е твой."],
  ])("renders direct step %i without falling back to the setup scene", async (step, heading) => {
    navigationState.searchParams = new URLSearchParams({ step: String(step) });

    render(<TutorialFlipbook />);

    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(`^${step}\\.`) })).toHaveAttribute(
      "aria-current",
      "step",
    );
  });
});
