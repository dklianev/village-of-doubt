import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReplayPage from "./page";

describe("replay presentation", () => {
  it("uses a dictionary-aligned numeric case reference and the scene primitive", async () => {
    const view = await ReplayPage({
      params: Promise.resolve({ gameId: "fixture-game-1" }),
      searchParams: Promise.resolve({ visualReplay: "fixture" }),
    });
    const { container } = render(view);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Запис на дело №\d{4,}\.$/);
    expect(container.querySelector('[data-ds-scene-card="lg"]')).toBeInTheDocument();
    expect(container.querySelector("[data-ds-scene-card-background]")).toHaveStyle({
      backgroundImage: expect.stringContaining("var(--art-replay)"),
    });
  });

  it("renders Bulgarian fallbacks for unknown stored codes without exposing the raw values", async () => {
    const view = await ReplayPage({
      params: Promise.resolve({ gameId: "fixture-game-unknown" }),
      searchParams: Promise.resolve({ visualReplay: "unknown-codes" }),
    });
    const { container } = render(view);

    expect(container).toHaveTextContent("Неизвестна фаза");
    expect(container).toHaveTextContent("Друго събитие");
    expect(container).toHaveTextContent("неуточнена видимост");
    expect(container).toHaveTextContent("Неизвестна роля");
    expect(container.textContent).not.toMatch(/future_(winner|phase|event|visibility|role|payload)/);
  });
});
