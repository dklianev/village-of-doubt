import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LobbyWizard } from "../LobbyWizard";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/sound", () => ({
  playCue: vi.fn(),
}));

describe("LobbyWizard", () => {
  it("shows the four setup steps", () => {
    const { container } = render(<LobbyWizard family="werewolves" />);

    for (const label of ["Стая", "Роли", "Стил", "Преглед"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(container.querySelector("main")).not.toBeInTheDocument();
  });

  it("navigates forward and backward between steps", async () => {
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);

    await user.click(screen.getByRole("button", { name: /Напред/ }));
    expect(screen.getByRole("button", { name: /Назад/ })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /Назад/ }));
    expect(screen.getByRole("button", { name: /Назад/ })).toBeDisabled();
  });

  it("validates the room name before advancing", async () => {
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);
    const input = screen.getAllByRole("textbox")[0];
    if (!input) {
      throw new Error("Липсва поле за име на стаята.");
    }

    await user.clear(input);
    await user.click(screen.getByRole("button", { name: /Напред/ }));

    expect(screen.getByText("Провери името на стаята и кода.")).toBeInTheDocument();
  });

  it("applies the classic lovers recipe with Cupid from the first screen", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    render(<LobbyWizard family="werewolves" />);

    const recipe = screen.getByRole("button", { name: /Класика с Влюбени/ });
    expect(recipe).toHaveAttribute("aria-pressed", "true");
    await user.click(recipe);

    const previewHeading = screen.getByRole("heading", { name: "Върколак" });
    expect(previewHeading).toBeInTheDocument();
    await waitFor(() => expect(previewHeading).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(recipe).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Купидон").length).toBeGreaterThan(0);
    expect(screen.getByText("Включен")).toBeInTheDocument();
  });

  it("shows Cupid and Lovers as a visible role choice", async () => {
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);

    await user.click(screen.getByRole("button", { name: /Напред/ }));

    expect(screen.getByText("Купидон и Влюбени")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Включено" })).toBeEnabled();
  });

  it("opens manual tempo controls and updates the preview", async () => {
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);

    await user.click(screen.getByRole("button", { name: /Ръчно/ }));

    expect(screen.getByRole("region", { name: "Ръчно темпо" })).toBeInTheDocument();
    expect(screen.getByText("Ти водиш ритъма")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Увеличи: Обсъждане през деня" }));

    expect(screen.getAllByText(/Ден 195/).length).toBeGreaterThan(0);
  });
});
