import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { ForgotPasswordClient } from "../ForgotPasswordClient";
import { ResetPasswordClient } from "../ResetPasswordClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("token=test-reset-token"),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { requestPasswordReset: vi.fn(), resetPassword: vi.fn() },
}));

describe("password recovery network failures", () => {
  beforeEach(() => vi.resetAllMocks());

  it("keeps the email and allows retry after a rejected reset request", async () => {
    const request = vi.mocked(authClient.requestPasswordReset);
    request.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    request.mockResolvedValueOnce({ data: { status: true }, error: null } as never);
    const user = userEvent.setup();
    render(<ForgotPasswordClient />);
    expect(screen.getByRole("heading", { level: 1, name: "Забравена парола" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Имейл"), "private@example.bg");
    await user.click(screen.getByRole("button", { name: "Изпрати линк" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/опитай отново/i);
    expect(screen.getByLabelText("Имейл")).toHaveValue("private@example.bg");
    expect(screen.getByRole("button", { name: "Изпрати линк" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Изпрати линк" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Ако има досие с този имейл");
    expect(screen.getByRole("heading", { level: 1, name: "Забравена парола" })).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith({ email: "private@example.bg", redirectTo: "/reset-password?redirect=%2F" });
  });

  it("keeps both passwords and allows retry after a rejected password change", async () => {
    const reset = vi.mocked(authClient.resetPassword);
    reset.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    reset.mockResolvedValueOnce({ data: { status: true }, error: null } as never);
    const user = userEvent.setup();
    render(<ResetPasswordClient />);
    expect(screen.getByRole("heading", { level: 1, name: "Нова парола" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Нова парола"), "new-password");
    await user.type(screen.getByLabelText("Повтори"), "new-password");
    await user.click(screen.getByRole("button", { name: "Запази паролата" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/опитай отново/i);
    expect(screen.getByLabelText("Нова парола")).toHaveValue("new-password");
    expect(screen.getByLabelText("Повтори")).toHaveValue("new-password");
    await user.click(screen.getByRole("button", { name: "Запази паролата" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Паролата е сменена");
    expect(screen.getByRole("heading", { level: 1, name: "Нова парола" })).toBeInTheDocument();
    expect(reset).toHaveBeenCalledTimes(2);
    expect(reset).toHaveBeenLastCalledWith({ token: "test-reset-token", newPassword: "new-password" });
  });
});
