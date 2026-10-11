import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("submits silent autofill after a reveal rerender without trimming the password", async () => {
    signInEmail.mockResolvedValue({ error: { status: 503 } });
    render(<EmailPasswordForm redirectTo="/" />);
    const email = screen.getByLabelText<HTMLInputElement>("Имейл");
    const password = screen.getByLabelText<HTMLInputElement>("Парола");
    email.value = "native@example.invalid";
    password.value = " synthetic-password ";
    fireEvent.click(screen.getByRole("button", { name: "Покажи паролата" }));
    const form = email.form!;
    expect(form).toHaveAttribute("method", "post");
    expect(Object.fromEntries(new FormData(form))).toEqual({
      email: "native@example.invalid", password: " synthetic-password ",
    });
    await act(async () => fireEvent.submit(form));
    expect(signInEmail).toHaveBeenCalledWith({ email: "native@example.invalid", password: " synthetic-password " });
    expect(email).toHaveValue("native@example.invalid");
    expect(password).toHaveValue(" synthetic-password ");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("retains native drafts across modes but clears the password when returning from verification", async () => {
    signUpEmail.mockResolvedValue({ data: { token: null }, error: null });
    render(<EmailPasswordForm redirectTo="/mafia/join/ABC234" />);
    fireEvent.click(screen.getByRole("tab", { name: "Регистрация" }));
    screen.getByLabelText<HTMLInputElement>("Име на масата").value = "  Мила  Петрова  ";
    screen.getByLabelText<HTMLInputElement>("Имейл").value = "native@example.invalid";
    screen.getByLabelText<HTMLInputElement>("Парола").value = " synthetic-password ";
    fireEvent.click(screen.getByRole("tab", { name: "Вход" }));
    fireEvent.click(screen.getByRole("tab", { name: "Регистрация" }));
    expect(screen.getByLabelText("Име на масата")).toHaveValue("  Мила  Петрова  ");
    const form = screen.getByLabelText<HTMLInputElement>("Имейл").form!;
    await act(async () => fireEvent.submit(form));
    expect(signUpEmail).toHaveBeenCalledWith({
      name: "Мила Петрова", email: "native@example.invalid", password: " synthetic-password ",
      callbackURL: "/verify-email?redirect=%2Fmafia%2Fjoin%2FABC234",
    });
    expect(screen.getByRole("heading", { name: "Провери имейла си" })).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Към входа" }));
    expect(screen.getByLabelText("Имейл")).toHaveValue("native@example.invalid");
    expect(screen.getByLabelText("Парола")).toHaveValue("");
    fireEvent.click(screen.getByRole("tab", { name: "Регистрация" }));
    expect(screen.getByLabelText("Име на масата")).toHaveValue("  Мила  Петрова  ");
    expect(screen.getByLabelText("Парола")).toHaveValue("");
  });

  it("validates the current native values after a form reset instead of submitting an old draft", async () => {
    const user = userEvent.setup();
    render(<EmailPasswordForm redirectTo="/" />);
    const email = screen.getByLabelText<HTMLInputElement>("Имейл");
    await user.type(email, "native@example.invalid");
    await user.type(screen.getByLabelText("Парола"), "synthetic-password");
    email.form!.reset();
    await user.click(screen.getByRole("button", { name: "Влез" }));
    expect(email).toHaveValue("");
    expect(email).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Въведи имейл.");
    expect(signInEmail).not.toHaveBeenCalled();
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

    await user.click(screen.getByRole("tab", { name: "Регистрация" }));
    await user.type(screen.getByLabelText("Име на масата"), "  Мила  Петрова  ");
    await user.type(screen.getByLabelText("Имейл"), "private@example.bg");
    await user.type(screen.getByLabelText("Парола"), "12345678");
    await user.click(screen.getByRole("button", { name: "Създай профил" }));

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
    await user.click(screen.getByRole("tab", { name: "Регистрация" }));
    if (name) await user.type(screen.getByLabelText("Име на масата"), name);
    await user.type(screen.getByLabelText("Имейл"), "private@example.bg");
    await user.type(screen.getByLabelText("Парола"), "12345678");
    await user.click(screen.getByRole("button", { name: "Създай профил" }));
    expect(screen.getByLabelText("Име на масата")).toHaveFocus();
    expect(screen.getByLabelText("Име на масата")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("offers the same pending state for the generic existing-account signup response", async () => {
    signUpEmail.mockResolvedValue({ data: { token: null, user: { id: "synthetic-id" } }, error: null });
    const user = userEvent.setup();
    render(<EmailPasswordForm redirectTo="//other.example" />);
    await user.click(screen.getByRole("tab", { name: "Регистрация" }));
    await user.type(screen.getByLabelText("Име на масата"), "Мила");
    await user.type(screen.getByLabelText("Имейл"), "existing@example.bg");
    await user.type(screen.getByLabelText("Парола"), "12345678");
    await user.click(screen.getByRole("button", { name: "Създай профил" }));
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

    await user.click(screen.getByRole("tab", { name: "Регистрация" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Регистрация" })).toHaveAttribute("aria-selected", "true");
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

  it("reveals the password without submitting and conceals it when switching modes", async () => {
    const user = userEvent.setup();
    render(<EmailPasswordForm redirectTo="/" />);
    const password = screen.getByLabelText("Парола", { exact: true });
    await user.type(password, "synthetic-password");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Покажи паролата" }));
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("synthetic-password");
    expect(signInEmail).not.toHaveBeenCalled();
    await user.click(screen.getByRole("tab", { name: "Регистрация" }));
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "new-password");
  });

  it("supports Home and End on the tabs and keeps pending mode locked", async () => {
    signInEmail.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<EmailPasswordForm redirectTo="/">
      <button type="button">Продължи с Google</button>
      <button type="button">Продължи с Discord</button>
    </EmailPasswordForm>);
    await user.click(screen.getByRole("tab", { name: "Вход" }));
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Регистрация" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Вход" })).toHaveFocus();
    await user.type(screen.getByLabelText("Имейл"), "test@example.bg");
    await user.type(screen.getByLabelText("Парола", { exact: true }), "12345678");
    await user.click(screen.getByRole("button", { name: "Влез" }));
    expect(screen.getByRole("tab", { name: "Регистрация" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Продължи с Google" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Продължи с Discord" })).toBeDisabled();
  });
});
