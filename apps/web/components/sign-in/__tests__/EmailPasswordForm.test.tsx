import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailPasswordForm } from "../EmailPasswordForm";

const { signInEmail, signUpEmail, sendVerificationEmail, push } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => signInEmail(...args) },
    signUp: { email: (...args: unknown[]) => signUpEmail(...args) },
    sendVerificationEmail: (...args: unknown[]) => sendVerificationEmail(...args),
  },
}));

describe("EmailPasswordForm", () => {
  beforeEach(() => {
    signInEmail.mockReset();
    signUpEmail.mockReset();
    sendVerificationEmail.mockReset();
    push.mockReset();
    window.localStorage.clear();
  });

  it("preserves a safe invitation when opening password recovery", () => {
    render(<EmailPasswordForm redirectTo="/mafia/join/ABC234?source=invite&mode=mafia_free" />);
    expect(screen.getByRole("link", { name: "Забравена парола?" })).toHaveAttribute(
      "href", "/forgot-password?redirect=%2Fmafia%2Fjoin%2FABC234%3Fsource%3Dinvite%26mode%3Dmafia_free",
    );
    expect(signInEmail).not.toHaveBeenCalled();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("falls back to the home destination for an unsafe recovery redirect", () => {
    render(<EmailPasswordForm redirectTo="//outside.invalid" />);
    expect(screen.getByRole("link", { name: "Забравена парола?" })).toHaveAttribute(
      "href", "/forgot-password?redirect=%2F",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("submits the chosen name and preserves the invite in the verification callback", async () => {
    signUpEmail.mockResolvedValue({ data: { token: null, user: { id: "user-1" } }, error: null });
    const user = userEvent.setup();
    const sessionChange = vi.fn();
    window.addEventListener("auth-session-change", sessionChange);
    render(<EmailPasswordForm redirectTo="/mafia/join/ABC123?source=invite" />);

    await user.click(screen.getByRole("tab", { name: "Ново досие" }));
    await user.type(screen.getByLabelText("Име на масата"), "  Мила  Петрова  ");
    await user.type(screen.getByLabelText("Имейл"), "private@example.bg");
    await user.type(screen.getByLabelText("Парола"), "12345678");
    await user.click(screen.getByRole("button", { name: "Създай досие" }));

    expect(signUpEmail).toHaveBeenCalledWith({
      name: "Мила Петрова",
      email: "private@example.bg",
      password: "12345678",
      callbackURL: "/verify-email?redirect=%2Fmafia%2Fjoin%2FABC123%3Fsource%3Dinvite",
    });
    expect(screen.getByRole("heading", { name: "Провери имейла си" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Спам");
    expect(screen.getByRole("button", { name: /Изпрати нов линк/ })).toBeDisabled();
    expect(push).not.toHaveBeenCalled();
    expect(sessionChange).not.toHaveBeenCalled();
    window.removeEventListener("auth-session-change", sessionChange);
  });

  it.each(["", " ", "А", "\u200b\u200b"])("requires a meaningful name before signup (%j)", async (name) => {
    const user = userEvent.setup();
    render(<EmailPasswordForm redirectTo="/" />);
    await user.click(screen.getByRole("tab", { name: "Ново досие" }));
    if (name) await user.type(screen.getByLabelText("Име на масата"), name);
    await user.type(screen.getByLabelText("Имейл"), "private@example.bg");
    await user.type(screen.getByLabelText("Парола"), "12345678");
    await user.click(screen.getByRole("button", { name: "Създай досие" }));
    expect(screen.getByLabelText("Име на масата")).toHaveFocus();
    expect(screen.getByLabelText("Име на масата")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("offers the same pending state for the generic existing-account signup response", async () => {
    signUpEmail.mockResolvedValue({ data: { token: null, user: { id: "synthetic-id" } }, error: null });
    const user = userEvent.setup();
    render(<EmailPasswordForm redirectTo="//other.example" />);
    await user.click(screen.getByRole("tab", { name: "Ново досие" }));
    await user.type(screen.getByLabelText("Име на масата"), "Мила");
    await user.type(screen.getByLabelText("Имейл"), "existing@example.bg");
    await user.type(screen.getByLabelText("Парола"), "12345678");
    await user.click(screen.getByRole("button", { name: "Създай досие" }));
    expect(screen.getByRole("status")).toHaveTextContent("Ако имейлът очаква потвърждение");
    expect(signUpEmail).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: "/verify-email?redirect=%2F" }));
    expect(push).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Към входа" }));
    expect(screen.getByLabelText("Имейл")).toHaveValue("existing@example.bg");
    expect(screen.getByLabelText("Имейл")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Влез" })).toBeEnabled();
  });

  it("offers a new verification link after an unverified sign-in without claiming login", async () => {
    signInEmail.mockResolvedValue({ error: { code: "EMAIL_NOT_VERIFIED", status: 403 } });
    const user = userEvent.setup();
    render(<EmailPasswordForm redirectTo="/werewolf/join/ABC123" />);
    await user.type(screen.getByLabelText("Имейл"), "waiting@example.bg");
    await user.type(screen.getByLabelText("Парола"), "12345678");
    await user.click(screen.getByRole("button", { name: "Влез" }));
    expect(screen.getByRole("heading", { name: "Провери имейла си" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Изпрати нов линк/ })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("focuses and marks an invalid email", async () => {
    const user = userEvent.setup();
    render(<EmailPasswordForm redirectTo="/" />);

    await user.type(screen.getByLabelText("Имейл"), "невалиден");
    await user.type(screen.getByLabelText("Парола"), "12345678");
    await user.click(screen.getByRole("button", { name: "Влез" }));

    const email = screen.getByLabelText("Имейл");
    expect(email).toHaveFocus();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Въведи валиден имейл.");
  });

  it("clears validation feedback when the mode changes", async () => {
    const user = userEvent.setup();
    render(<EmailPasswordForm redirectTo="/" />);

    await user.click(screen.getByRole("button", { name: "Влез" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Ново досие" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ново досие" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Име на масата")).toBeRequired();
  });

  it("prevents duplicate submission while the request is pending", async () => {
    signInEmail.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<EmailPasswordForm redirectTo="/" />);

    await user.type(screen.getByLabelText("Имейл"), "test@example.bg");
    await user.type(screen.getByLabelText("Парола"), "12345678");
    await user.click(screen.getByRole("button", { name: "Влез" }));

    const submit = screen.getByRole("button", { name: "Влизаме..." });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(signInEmail).toHaveBeenCalledTimes(1);
  });
});
