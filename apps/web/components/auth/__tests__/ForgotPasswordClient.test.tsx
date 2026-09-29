import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm as ForgotPasswordClient } from "./recovery-fixtures";

const { requestPasswordReset } = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams({ redirect: "/werewolf/join/ABC123" }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { requestPasswordReset } }));

function fillEmail(value = "recovery@example.invalid") {
  fireEvent.change(screen.getByLabelText("Имейл"), { target: { value } });
  return screen.getByRole("button", { name: "Изпрати линк" }).closest("form")!;
}

describe("ForgotPasswordClient", () => {
  beforeEach(() => {
    requestPasswordReset.mockReset();
    requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });
  });
  afterEach(() => vi.useRealTimers());

  it("retains a silently autofilled address for resend and edit across cooldown rerenders", async () => {
    vi.useFakeTimers();
    render(<ForgotPasswordClient />);
    const input = screen.getByLabelText<HTMLInputElement>("Имейл");
    input.value = "native@example.invalid";
    const form = input.form!;
    expect(form).toHaveAttribute("method", "post");
    await act(async () => fireEvent.submit(form));
    expect(requestPasswordReset).toHaveBeenLastCalledWith({
      email: "native@example.invalid", redirectTo: "/reset-password?redirect=%2Fwerewolf%2Fjoin%2FABC123",
    });
    expect(screen.queryByLabelText("Имейл")).not.toBeInTheDocument();
    fireEvent.submit(form);
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(60_000));
    await act(async () => fireEvent.submit(form));
    expect(requestPasswordReset).toHaveBeenCalledTimes(2);
    expect(requestPasswordReset).toHaveBeenLastCalledWith({
      email: "native@example.invalid", redirectTo: "/reset-password?redirect=%2Fwerewolf%2Fjoin%2FABC123",
    });
    fireEvent.click(screen.getByRole("button", { name: "Промени имейла" }));
    const edited = screen.getByLabelText<HTMLInputElement>("Имейл");
    expect(edited).toHaveValue("native@example.invalid");
    expect(edited).toHaveFocus();
    edited.value = "edited@example.invalid";
    act(() => vi.advanceTimersByTime(60_000));
    expect(edited).toHaveValue("edited@example.invalid");
    await act(async () => fireEvent.submit(form));
    expect(requestPasswordReset).toHaveBeenLastCalledWith({
      email: "edited@example.invalid", redirectTo: "/reset-password?redirect=%2Fwerewolf%2Fjoin%2FABC123",
    });
  });

  it("keeps feedback neutral and resends only after the full cooldown", async () => {
    vi.useFakeTimers();
    const { container } = render(<ForgotPasswordClient />);
    const form = fillEmail();
    await act(async () => fireEvent.submit(form));
    expect(screen.getByRole("status")).toHaveTextContent("Ако има профил с този имейл");
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.firstElementChild).toHaveClass("recovery-panel");
    expect(screen.getByRole("button", { name: "Изпрати нов линк (60 сек.)" })).toBeDisabled();
    fireEvent.submit(form);
    act(() => vi.advanceTimersByTime(59_000));
    expect(screen.getByRole("button", { name: "Изпрати нов линк (1 сек.)" })).toBeDisabled();
    fireEvent.submit(form);
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1000));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Изпрати нов линк" })));
    expect(requestPasswordReset).toHaveBeenCalledTimes(2);
    expect(requestPasswordReset).toHaveBeenLastCalledWith({
      email: "recovery@example.invalid", redirectTo: "/reset-password?redirect=%2Fwerewolf%2Fjoin%2FABC123",
    });
    expect(screen.getByRole("button", { name: "Изпрати нов линк (60 сек.)" })).toBeDisabled();
  });

  it("focuses the retained email on edit without bypassing the cooldown", async () => {
    vi.useFakeTimers();
    render(<ForgotPasswordClient />);
    await act(async () => fireEvent.submit(fillEmail()));
    fireEvent.click(screen.getByRole("button", { name: "Промени имейла" }));
    const email = screen.getByLabelText("Имейл");
    expect(email).toHaveValue("recovery@example.invalid");
    expect(email).toHaveFocus();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.change(email, { target: { value: "changed@example.invalid" } });
    fireEvent.submit(email.closest("form")!);
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Изпрати линк (60 сек.)" })).toBeDisabled();
    act(() => vi.advanceTimersByTime(60_000));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Изпрати линк" })));
    expect(requestPasswordReset).toHaveBeenLastCalledWith({
      email: "changed@example.invalid", redirectTo: "/reset-password?redirect=%2Fwerewolf%2Fjoin%2FABC123",
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("blocks same-tick duplicate submits while the request is pending", async () => {
    let complete!: (value: unknown) => void;
    requestPasswordReset.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    render(<ForgotPasswordClient />);
    const form = fillEmail();
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Имейл")).toBeEnabled();
    expect(screen.getByLabelText("Имейл")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Изпращаме..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Изпращаме..." })).toHaveAttribute("aria-busy", "true");
    await act(async () => complete({ data: { status: true }, error: null }));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("retains email focus after Enter submission fails with HTTP 503 and allows keyboard retry", async () => {
    let complete!: (value: unknown) => void;
    requestPasswordReset.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const user = userEvent.setup();
    render(<ForgotPasswordClient />);
    const email = screen.getByLabelText("Имейл");
    await user.type(email, "recovery@example.invalid{Enter}");
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    expect(email).toHaveFocus();
    expect(email).toBeEnabled();
    expect(email).toHaveAttribute("readonly");
    await user.keyboard("x{Enter}");
    expect(email).toHaveValue("recovery@example.invalid");
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);

    await act(async () => complete({ error: { status: 503 } }));
    expect(screen.getByRole("alert")).toHaveTextContent("Заявката не беше приета.");
    expect(email).toHaveFocus();
    expect(email).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Изпрати линк" })).toBeEnabled();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("status")).toHaveTextContent("Ако има профил с този имейл");
    expect(requestPasswordReset).toHaveBeenCalledTimes(2);
    expect(requestPasswordReset).toHaveBeenLastCalledWith({
      email: "recovery@example.invalid", redirectTo: "/reset-password?redirect=%2Fwerewolf%2Fjoin%2FABC123",
    });
  });

  it("does not steal focus when the user leaves the email field during a failed request", async () => {
    let complete!: (value: unknown) => void;
    requestPasswordReset.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const user = userEvent.setup();
    render(<ForgotPasswordClient />);
    await user.type(screen.getByLabelText("Имейл"), "recovery@example.invalid{Enter}");
    await user.tab();
    const back = screen.getByRole("link", { name: "Към входа" });
    expect(back).toHaveFocus();
    await act(async () => complete({ error: { status: 503 } }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(back).toHaveFocus();
    expect(screen.getByLabelText("Имейл")).not.toHaveAttribute("readonly");
  });

  it("enforces the cooldown after rate limiting and associates the request error", async () => {
    vi.useFakeTimers();
    requestPasswordReset.mockResolvedValue({ error: { status: 429 } });
    render(<ForgotPasswordClient />);
    const form = fillEmail();
    await act(async () => fireEvent.submit(form));
    expect(form).toHaveAttribute("aria-describedby", screen.getByRole("alert").id);
    expect(screen.getByRole("alert")).toHaveTextContent("след минута");
    fireEvent.submit(form);
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("button", { name: "Изпрати линк" })).toBeEnabled();
  });

  it("does not expose account existence or raw server details", async () => {
    requestPasswordReset.mockResolvedValue({ error: { code: "USER_NOT_FOUND", message: "Няма досие с този имейл." } });
    render(<ForgotPasswordClient />);
    fireEvent.submit(fillEmail());
    expect(await screen.findByRole("alert")).toHaveTextContent("Заявката не беше приета.");
    expect(screen.queryByText(/Няма досие|USER_NOT_FOUND/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Изпрати линк" })).toBeEnabled();
  });
});
