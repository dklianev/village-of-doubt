import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignInStage } from "../SignInStage";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("invitation sign-in", () => {
  it.each(["/werewolf/join", "/mafia/join", "/werewolf/join/ABC234", "/mafia/join/ABC234"])(
    "explains account authentication before joining through %s",
    (redirectTo) => {
      render(<SignInStage redirectTo={redirectTo} />);

      expect(screen.getByRole("heading", { level: 1, name: "Вход в играта" })).toBeInTheDocument();
      expect(screen.getByText("След това ще продължиш към стаята с код. Нямаш профил? Създай нов.")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Имейл" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Ново досие" })).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Код на стаята" })).not.toBeInTheDocument();
    },
  );

  it.each([
    ["/", "Покажи се на масата"],
    ["/mafia/create?mode=mafia_sport", "Стани стопанин"],
    ["/werewolf/create", "Стани стопанин"],
    ["/play/ABC234", "Върни се в играта"],
  ])("preserves the non-join heading for %s", (redirectTo, title) => {
    render(<SignInStage redirectTo={redirectTo} />);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
  });
});
