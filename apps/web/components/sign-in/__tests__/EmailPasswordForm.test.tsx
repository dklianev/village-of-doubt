import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailPasswordForm } from "../EmailPasswordForm";

const { signInEmail, signUpEmail } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => signInEmail(...args) },
    signUp: { email: (...args: unknown[]) => signUpEmail(...args) },
  },
}));

describe("EmailPasswordForm", () => {
  beforeEach(() => {
    signInEmail.mockReset();
    signUpEmail.mockReset();
  });

  it("never uses the email address as the public display name", async () => {
    signUpEmail.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const user = userEvent.setup();
    render(<EmailPasswordForm redirectTo="/" />);

    await user.click(screen.getByRole("tab", { name: "Ново досие" }));
    await user.type(screen.getByLabelText("Имейл"), "private@example.bg");
    await user.type(screen.getByLabelText("Парола"), "12345678");
    await user.click(screen.getByRole("button", { name: "Създай досие" }));

    expect(signUpEmail).toHaveBeenCalledWith({
      name: "Играч",
      email: "private@example.bg",
      password: "12345678",
    });
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
    expect(screen.getByLabelText("Име на масата (по избор)")).toBeInTheDocument();
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
