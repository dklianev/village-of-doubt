import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignInStage } from "../SignInStage";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("invitation sign-in", () => {
  it("renders the server-provided provider marks and password controls", async () => {
    const user = userEvent.setup();
    render(<SignInStage redirectTo="/" />);
    expect(screen.getByRole("button", { name: "Продължи с Google" }).querySelector("img"))
      .toHaveAttribute("src", "/brand/google-g.svg");
    expect(screen.getByRole("button", { name: "Продължи с Discord" }).querySelector("img"))
      .toHaveAttribute("src", "/brand/discord-mark.svg");
    const showPassword = screen.getByRole("button", { name: "Покажи паролата" });
    expect(showPassword.querySelector("svg")).toBeInTheDocument();
    await user.click(showPassword);
    expect(screen.getByRole("button", { name: "Скрий паролата" }).querySelector("svg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Влез" }).querySelector("svg")).toBeInTheDocument();
  });

  it("changes the single page heading when registration is selected", async () => {
    const user = userEvent.setup();
    render(<SignInStage redirectTo="/" />);
    await user.click(screen.getByRole("tab", { name: "Регистрация" }));
    expect(screen.getByRole("heading", { level: 1, name: "Създай профил" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await user.click(screen.getByRole("tab", { name: "Вход" }));
    expect(screen.getByRole("heading", { level: 1, name: "Влез в Сенките" })).toBeInTheDocument();
  });
  it.each(["/werewolf/join", "/mafia/join", "/werewolf/join/ABC234", "/mafia/join/ABC234"])(
    "explains account authentication before joining through %s",
    (redirectTo) => {
      render(<SignInStage redirectTo={redirectTo} />);

      expect(screen.getByRole("heading", { level: 1, name: "Вход в играта" })).toBeInTheDocument();
      expect(screen.getByText("Влез или създай профил, за да продължиш към поканата.")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Имейл" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Регистрация" })).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Код на стаята" })).not.toBeInTheDocument();
    },
  );

  it.each([
    ["/", "Влез в Сенките"],
    ["/mafia/create?mode=mafia_sport", "Събери компанията"],
    ["/werewolf/create", "Събери компанията"],
    ["/play/ABC234", "Върни се в играта"],
  ])("preserves the non-join heading for %s", (redirectTo, title) => {
    render(<SignInStage redirectTo={redirectTo} />);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
  });
});
