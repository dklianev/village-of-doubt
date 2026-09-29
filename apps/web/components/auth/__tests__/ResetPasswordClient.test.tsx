import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordForm as ResetPasswordClient } from "./recovery-fixtures";

const { resetPassword, push } = vi.hoisted(() => ({ resetPassword: vi.fn(), push: vi.fn() }));
let query = new URLSearchParams();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => query }));
vi.mock("@/lib/auth-client", () => ({ authClient: { resetPassword } }));

function fillPasswords(password = "new-password", confirm = password) {
  fireEvent.change(screen.getByLabelText("Нова парола"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Повтори паролата"), { target: { value: confirm } });
  return screen.getByRole("button", { name: "Запази паролата" }).closest("form")!;
}

describe("ResetPasswordClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    query = new URLSearchParams({ token: "reset-token" });
    resetPassword.mockResolvedValue({ data: { status: true }, error: null });
  });
  afterEach(() => vi.useRealTimers());

  it("validates silent autofill and submits the corrected native passwords after rerendering", async () => {
    render(<ResetPasswordClient />);
    const password = screen.getByLabelText<HTMLInputElement>("Нова парола");
    const confirm = screen.getByLabelText<HTMLInputElement>("Повтори паролата");
    password.value = " synthetic-password ";
    confirm.value = "different-password";
    const form = password.form!;
    expect(form).toHaveAttribute("method", "post");
    fireEvent.submit(form);
    expect(confirm).toHaveFocus();
    expect(confirm).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveValue(" synthetic-password ");
    expect(resetPassword).not.toHaveBeenCalled();
    confirm.value = password.value;
    fireEvent.click(screen.getByRole("button", { name: "Покажи новата парола" }));
    expect(Object.fromEntries(new FormData(form))).toEqual({
      password: " synthetic-password ", confirmPassword: " synthetic-password ",
    });
    await act(async () => fireEvent.submit(form));
    expect(resetPassword).toHaveBeenCalledExactlyOnceWith({ token: "reset-token", newPassword: " synthetic-password " });
    expect(screen.getByRole("heading", { name: "Паролата е сменена" })).toHaveFocus();
    expect(screen.queryByLabelText("Нова парола")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Повтори паролата")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("reveals each password independently with named controls and keeps both values", () => {
    render(<ResetPasswordClient />);
    fillPasswords();
    const password = screen.getByLabelText("Нова парола");
    const confirm = screen.getByLabelText("Повтори паролата");
    const reveal = screen.getByRole("button", { name: "Покажи новата парола" });
    expect(reveal).toHaveAttribute("aria-controls", password.id);
    expect(reveal).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(reveal);
    expect(password).toHaveAttribute("type", "text");
    expect(confirm).toHaveAttribute("type", "password");
    expect(reveal).toHaveAccessibleName("Скрий новата парола");
    expect(reveal).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Покажи повторената парола" }));
    expect(confirm).toHaveAttribute("type", "text");
    fireEvent.click(reveal);
    expect(password).toHaveAttribute("type", "password");
    expect(confirm).toHaveAttribute("type", "text");
    expect(password).toHaveValue("new-password");
    expect(confirm).toHaveValue("new-password");
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it.each(["", "short"])("focuses and describes a too-short password (%s)", (password) => {
    render(<ResetPasswordClient />);
    fireEvent.submit(fillPasswords(password));
    const field = screen.getByLabelText("Нова парола");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(/Паролата трябва да е поне 8 символа/);
    expect(field).toHaveFocus();
    expect(resetPassword).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "new-password" } });
    expect(field).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("associates mismatch feedback only with confirmation and focuses it", () => {
    render(<ResetPasswordClient />);
    fireEvent.submit(fillPasswords("new-password", "different-password"));
    const confirm = screen.getByLabelText("Повтори паролата");
    expect(confirm).toHaveAttribute("aria-invalid", "true");
    expect(confirm).toHaveAccessibleDescription("Паролите не съвпадат.");
    expect(confirm).toHaveFocus();
    expect(screen.getByLabelText("Нова парола")).toHaveAttribute("aria-invalid", "false");
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("guards pending submits and focuses success without automatically navigating", async () => {
    vi.useFakeTimers();
    let complete!: (value: unknown) => void;
    resetPassword.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const { container } = render(<ResetPasswordClient />);
    const form = fillPasswords();
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(resetPassword).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Запазваме..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Запазваме..." })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("Нова парола")).toHaveAttribute("readonly");
    await act(async () => complete({ data: { status: true }, error: null }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Паролата е сменена");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.firstElementChild).toHaveClass("recovery-panel");
    expect(screen.getByRole("link", { name: "Към входа" })).toHaveAttribute("href", "/sign-in?redirect=%2F");
    expect(screen.getByRole("link", { name: "Към входа" })).toHaveClass("btn-primary");
    act(() => vi.advanceTimersByTime(60_000));
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Нова парола")).not.toBeInTheDocument();
  });

  it.each(["INVALID_TOKEN", "TOKEN_EXPIRED"])("removes the form for a rejected token: %s", async (code) => {
    resetPassword.mockResolvedValue({ error: { code } });
    render(<ResetPasswordClient />);
    fireEvent.submit(fillPasswords());
    expect(await screen.findByRole("heading", { name: "Невалиден линк" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Линкът е изтекъл или невалиден.");
    expect(screen.queryByLabelText("Нова парола")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Заяви нов линк" })).toHaveClass("btn-primary");
  });

  it("honors callback errors even with a token in the URL", () => {
    query.set("error", "INVALID_TOKEN");
    render(<ResetPasswordClient />);
    expect(screen.getByRole("heading", { name: "Невалиден линк" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Нова парола")).not.toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("associates server password validation errors with the password field", async () => {
    resetPassword.mockResolvedValue({ error: { code: "PASSWORD_TOO_LONG", message: "private backend detail" } });
    render(<ResetPasswordClient />);
    fireEvent.submit(fillPasswords());
    expect(await screen.findByRole("alert")).toHaveTextContent("Паролата е твърде дълга.");
    expect(screen.getByLabelText("Нова парола")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Нова парола")).toHaveAccessibleDescription(/Паролата е твърде дълга/);
    expect(screen.queryByText(/private backend detail/)).not.toBeInTheDocument();
  });
});
