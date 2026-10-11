import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm, ResetPasswordForm, VerifyEmailForm } from "./recovery-fixtures";

const { requestPasswordReset, resetPassword, verifyEmail, getSession } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(), resetPassword: vi.fn(), verifyEmail: vi.fn(), getSession: vi.fn(),
}));
let query = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => query }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { requestPasswordReset, resetPassword, verifyEmail, getSession, sendVerificationEmail: vi.fn() },
}));

describe("server-rendered recovery icons", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    query = new URLSearchParams();
    requestPasswordReset.mockResolvedValue({ error: null });
    resetPassword.mockResolvedValue({ error: null });
    getSession.mockResolvedValue({ data: null, error: null });
    window.localStorage.clear();
  });

  it("keeps the forgot header, send, back and edit icons through success", async () => {
    const { container } = render(<ForgotPasswordForm />);
    expect(container.querySelector(".recovery-icon .lucide-key-round")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Към входа" }).querySelector(".lucide-arrow-left")).toBeInTheDocument();
    const send = screen.getByRole("button", { name: "Изпрати линк" });
    expect(send.querySelector(".lucide-mail")).toHaveAttribute("aria-hidden", "true");
    fireEvent.change(screen.getByLabelText("Имейл"), { target: { value: "recovery@example.invalid" } });
    fireEvent.click(send);
    await screen.findByRole("heading", { name: "Провери имейла си" });
    expect(container.querySelector(".recovery-icon .lucide-mail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Промени имейла" }).querySelector(".lucide-pencil")).toBeInTheDocument();
  });

  it("switches each reset eye icon independently and keeps success icons", async () => {
    query.set("token", "reset-token");
    const { container } = render(<ResetPasswordForm />);
    const show = screen.getByRole("button", { name: "Покажи новата парола" });
    const confirm = screen.getByRole("button", { name: "Покажи повторената парола" });
    expect(show.querySelector(".lucide-eye")).toHaveAttribute("width", "20");
    fireEvent.click(show);
    expect(show.querySelector(".lucide-eye-off")).toBeInTheDocument();
    expect(confirm.querySelector(".lucide-eye")).toBeInTheDocument();
    fireEvent.click(confirm);
    expect(confirm.querySelector(".lucide-eye-off")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Запази паролата" }).querySelector(".lucide-check")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Нова парола"), { target: { value: "new-password" } });
    fireEvent.change(screen.getByLabelText("Повтори паролата"), { target: { value: "new-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Запази паролата" }));
    await screen.findByRole("heading", { name: "Паролата е сменена" });
    expect(container.querySelector(".recovery-icon .lucide-check")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Към входа" }).querySelector(".lucide-arrow-right")).toBeInTheDocument();
  });

  it("keeps the verification header and the primary resend icon", async () => {
    const { container } = render(<VerifyEmailForm />);
    const send = await screen.findByRole("button", { name: "Изпрати нов линк" });
    expect(container.querySelector(".recovery-icon .lucide-mail-check")).toBeInTheDocument();
    expect(send.querySelector(".lucide-mail")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps verification retry and manual continue icons", async () => {
    query.set("token", "verify-token");
    verifyEmail.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce({ error: null });
    render(<VerifyEmailForm />);
    const retry = await screen.findByRole("button", { name: "Опитай отново" });
    expect(retry.querySelector(".lucide-refresh-cw")).toBeInTheDocument();
    await act(async () => fireEvent.click(retry));
    expect(screen.getByRole("link", { name: "Продължи" }).querySelector(".lucide-arrow-right")).toBeInTheDocument();
  });
});
