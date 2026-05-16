import { render, screen } from "@testing-library/react";
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
    render(<LobbyWizard family="werewolves" />);

    for (const label of ["Стая", "Роли", "Стил", "Преглед"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
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
});
