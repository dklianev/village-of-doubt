import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TutorialFlipbook } from "../TutorialFlipbook";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
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

    expect(screen.getByRole("heading", { level: 1, name: "Очите се затварят." })).toBeInTheDocument();
    expect(container.querySelector('[data-tutorial-scene="night"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Нощ/ })).toHaveAttribute("aria-current", "step");
    expect(back).toBeEnabled();
  });

  it("keeps the final family and reference destinations keyboard reachable", async () => {
    const user = userEvent.setup();
    render(<TutorialFlipbook />);

    await user.click(screen.getByRole("button", { name: /Начало/ }));

    expect(screen.getByRole("link", { name: /Започни Върколак/ })).toHaveAttribute("href", "/werewolf/create");
    expect(screen.getByRole("link", { name: /Започни Мафия/ })).toHaveAttribute("href", "/mafia/create");
    expect(screen.getByRole("link", { name: /Всички роли/ })).toHaveAttribute("href", "/roles");
    expect(screen.getByRole("button", { name: "Следваща сцена" })).toBeDisabled();
  });
});
