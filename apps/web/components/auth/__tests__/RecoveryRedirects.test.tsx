import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordClient } from "../ForgotPasswordClient";
import { ResetPasswordClient } from "../ResetPasswordClient";

const { requestPasswordReset, resetPassword, push } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(), resetPassword: vi.fn(), push: vi.fn(),
}));
const router = { push };
let query = new URLSearchParams();
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => query }));
vi.mock("@/lib/auth-client", () => ({ authClient: { requestPasswordReset, resetPassword } }));

const invite = "/mafia/join/ABC234?source=invite&mode=mafia_free";
const signInHref = "/sign-in?redirect=%2Fmafia%2Fjoin%2FABC234%3Fsource%3Dinvite%26mode%3Dmafia_free";
const forgotHref = "/forgot-password?redirect=%2Fmafia%2Fjoin%2FABC234%3Fsource%3Dinvite%26mode%3Dmafia_free";

function submitEmail() {
  fireEvent.change(screen.getByLabelText("Имейл"), { target: { value: "recovery@example.invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "Изпрати линк" }));
}

function submitPassword() {
  fireEvent.change(screen.getByLabelText("Нова парола"), { target: { value: "test-password" } });
  fireEvent.change(screen.getByLabelText("Повтори"), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Запази паролата" }));
}

describe("password recovery invite redirects", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    query = new URLSearchParams({ redirect: invite });
    requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });
    resetPassword.mockResolvedValue({ data: { status: true }, error: null });
  });
  afterEach(() => vi.useRealTimers());

  it("preserves the invite in email callbacks and back links before and after offline retry", async () => {
    requestPasswordReset.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<ForgotPasswordClient />);
    expect(screen.getByRole("link", { name: "Към входа" })).toHaveAttribute("href", signInHref);
    submitEmail();
    expect(await screen.findByRole("alert")).toHaveTextContent(/опитай отново/i);
    expect(screen.getByRole("link", { name: "Към входа" })).toHaveAttribute("href", signInHref);
    fireEvent.click(screen.getByRole("button", { name: "Изпрати линк" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Ако има досие с този имейл");
    expect(requestPasswordReset).toHaveBeenLastCalledWith({
      email: "recovery@example.invalid",
      redirectTo: "/reset-password?redirect=%2Fmafia%2Fjoin%2FABC234%3Fsource%3Dinvite%26mode%3Dmafia_free",
    });
    expect(screen.getByRole("link", { name: "Към входа" })).toHaveAttribute("href", signInHref);
  });

  it.each(["", "INVALID_TOKEN"])("keeps recovery and sign-in destinations for an invalid callback (%s)", (error) => {
    if (error) query.set("error", error);
    render(<ResetPasswordClient />);
    expect(screen.getByRole("heading", { name: "Невалиден линк" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Заяви нов линк" })).toHaveAttribute("href", forgotHref);
    expect(screen.getByRole("link", { name: "Към входа" })).toHaveAttribute("href", signInHref);
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("preserves the invite after a rejected password change and successful retry", async () => {
    query.set("token", "test-reset-token");
    resetPassword.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<ResetPasswordClient />);
    submitPassword();
    expect(await screen.findByRole("alert")).toHaveTextContent(/опитай отново/i);
    expect(screen.getByRole("link", { name: "Заяви нов линк" })).toHaveAttribute("href", forgotHref);
    expect(screen.getByRole("link", { name: "Към входа" })).toHaveAttribute("href", signInHref);
    vi.useFakeTimers();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Запази паролата" })));
    expect(screen.getByRole("status")).toHaveTextContent("Паролата е сменена");
    expect(screen.getByRole("link", { name: "Към входа" })).toHaveAttribute("href", signInHref);
    act(() => vi.advanceTimersByTime(1800));
    expect(push).toHaveBeenCalledWith(signInHref);
  });

  it("retains the destination when the server rejects an expired reset token", async () => {
    query.set("token", "expired-test-token");
    resetPassword.mockResolvedValue({ error: { code: "INVALID_TOKEN" }, data: null });
    render(<ResetPasswordClient />);
    submitPassword();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Заяви нов линк" })).toHaveAttribute("href", forgotHref);
    expect(screen.getByRole("link", { name: "Към входа" })).toHaveAttribute("href", signInHref);
    expect(push).not.toHaveBeenCalled();
  });

  it.each(["https://outside.invalid", "//outside.invalid", "/%2foutside.invalid", "/\\outside.invalid", "/%0a/outside.invalid"])(
    "sanitizes malicious destinations throughout recovery: %s", async (redirect) => {
      query = new URLSearchParams({ redirect });
      const forgot = render(<ForgotPasswordClient />);
      expect(screen.getByRole("link", { name: "Към входа" })).toHaveAttribute("href", "/sign-in?redirect=%2F");
      submitEmail();
      await screen.findByRole("status");
      expect(requestPasswordReset).toHaveBeenCalledWith({ email: "recovery@example.invalid", redirectTo: "/reset-password?redirect=%2F" });
      forgot.unmount();
      render(<ResetPasswordClient />);
      expect(screen.getByRole("link", { name: "Заяви нов линк" })).toHaveAttribute("href", "/forgot-password?redirect=%2F");
      expect(screen.getByRole("link", { name: "Към входа" })).toHaveAttribute("href", "/sign-in?redirect=%2F");
    },
  );
});
