import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VerificationEmailRequest } from "../VerificationEmailRequest";

const { sendVerificationEmail } = vi.hoisted(() => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { sendVerificationEmail } }));

describe("VerificationEmailRequest", () => {
  beforeEach(() => { sendVerificationEmail.mockReset(); });
  afterEach(() => vi.useRealTimers());

  it("waits after signup, keeps the invite on resend and starts another cooldown", async () => {
    vi.useFakeTimers();
    sendVerificationEmail.mockResolvedValue({ data: { status: true }, error: null });
    render(<VerificationEmailRequest initialEmail="private@example.bg" redirectTo="/mafia/join/ABC123?source=invite" initialCooldownSeconds={60} />);
    expect(screen.getByRole("button", { name: /Изпрати нов линк/ })).toBeDisabled();
    act(() => vi.advanceTimersByTime(60_000));
    const button = screen.getByRole("button", { name: "Изпрати нов линк" });
    expect(button).toBeEnabled();
    await act(async () => fireEvent.click(button));
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      email: "private@example.bg",
      callbackURL: "/verify-email?redirect=%2Fmafia%2Fjoin%2FABC123%3Fsource%3Dinvite",
    });
    expect(screen.getByRole("status")).toHaveTextContent("Ако имейлът очаква потвърждение");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(60_000));
    expect(button).toBeEnabled();
  });

  it("recovers from a rejected request without losing the email or exposing details", async () => {
    sendVerificationEmail.mockRejectedValueOnce(new TypeError("private backend detail"))
      .mockResolvedValueOnce({ data: { status: true }, error: null });
    render(<VerificationEmailRequest initialEmail="private@example.bg" redirectTo="//other.example" />);
    fireEvent.click(screen.getByRole("button", { name: "Изпрати нов линк" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/опитай отново/i);
    expect(screen.queryByText(/private backend detail/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Имейл")).toHaveValue("private@example.bg");
    expect(screen.getByRole("button", { name: "Изпрати нов линк" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Изпрати нов линк" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Ако имейлът очаква потвърждение");
    expect(sendVerificationEmail).toHaveBeenLastCalledWith({ email: "private@example.bg", callbackURL: "/verify-email?redirect=%2F" });
  });

  it("blocks duplicate pending requests and gives neutral feedback for server errors", async () => {
    let complete!: (value: unknown) => void;
    sendVerificationEmail.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    render(<VerificationEmailRequest initialEmail="private@example.bg" redirectTo="/" />);
    const button = screen.getByRole("button", { name: "Изпрати нов линк" });
    const form = button.closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    await act(async () => complete({ error: { code: "EMAIL_ALREADY_VERIFIED", message: "User exists" } }));
    expect(screen.getByRole("alert")).toHaveTextContent(/опитай отново/i);
    expect(screen.queryByText(/User exists/)).not.toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it("pauses resending after the server rate limit", async () => {
    vi.useFakeTimers();
    sendVerificationEmail.mockResolvedValue({ error: { status: 429 } });
    render(<VerificationEmailRequest initialEmail="private@example.bg" redirectTo="/" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Изпрати нов линк" })));
    expect(screen.getByRole("alert")).toHaveTextContent(/след минута/i);
    expect(screen.getByRole("button", { name: /Изпрати нов линк/ })).toBeDisabled();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("button", { name: "Изпрати нов линк" })).toBeEnabled();
  });

  it("preserves the default sign-in markup and secondary button", () => {
    render(<VerificationEmailRequest redirectTo="/" />);
    const button = screen.getByRole("button", { name: "Изпрати нов линк" });
    const email = screen.getByLabelText("Имейл");
    expect(button).toHaveClass("btn-secondary");
    expect(button).not.toHaveClass("btn-primary");
    expect(button.parentElement).toBe(email.parentElement);
    expect(email.parentElement?.tagName).toBe("FORM");
    expect(email.closest("form")).not.toHaveClass("recovery-form");
  });

  it("uses recovery styling only for the primary variant and describes request errors", async () => {
    sendVerificationEmail.mockRejectedValue(new TypeError("private backend detail"));
    render(<VerificationEmailRequest initialEmail="own@example.invalid" redirectTo="/" variant="primary" />);
    const button = screen.getByRole("button", { name: "Изпрати нов линк" });
    const email = screen.getByLabelText("Имейл");
    expect(button).toHaveClass("btn-primary");
    expect(button.parentElement).toHaveClass("recovery-actions");
    expect(email.parentElement).toHaveClass("recovery-field");
    expect(email.closest("form")).toHaveClass("recovery-form");
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveClass("recovery-error");
    expect(email).toHaveAccessibleDescription("Не успяхме да се свържем. Провери връзката си и опитай отново.");
    expect(email).not.toHaveAttribute("aria-invalid", "true");
    expect(button).toBeEnabled();
  });
});
