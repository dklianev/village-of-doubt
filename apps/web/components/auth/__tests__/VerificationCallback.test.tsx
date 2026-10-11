import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VerifyEmailForm as VerifyEmailClient } from "./recovery-fixtures";

const { verifyEmail, getSession, push } = vi.hoisted(() => ({ verifyEmail: vi.fn(), getSession: vi.fn(), push: vi.fn() }));
let query = new URLSearchParams();
const router = { push };
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => query }));
vi.mock("@/lib/auth-client", () => ({ authClient: { verifyEmail, getSession, sendVerificationEmail: vi.fn() } }));

describe("verification callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    query = new URLSearchParams();
    window.localStorage.clear();
    getSession.mockResolvedValue({ data: null, error: null });
  });
  afterEach(() => vi.useRealTimers());

  it("accepts the installed API callback only after checking the verified session", async () => {
    vi.useFakeTimers();
    query = new URLSearchParams({ redirect: "/werewolf/join/ABC123" });
    window.localStorage.setItem("tutorial-completed", "1");
    getSession.mockResolvedValue({ data: { user: { emailVerified: true } }, error: null });
    const sessionChange = vi.fn();
    window.addEventListener("auth-session-change", sessionChange, { once: true });
    await act(async () => render(<StrictMode><VerifyEmailClient /></StrictMode>));
    expect(screen.getByRole("heading", { name: "Имейлът е потвърден." })).toBeInTheDocument();
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(verifyEmail).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Продължи" })).toHaveAttribute("href", "/werewolf/join/ABC123");
    act(() => vi.advanceTimersByTime(60_000));
    expect(push).not.toHaveBeenCalled();
    expect(sessionChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Продължи" })).toHaveAttribute("href", "/werewolf/join/ABC123");
  });

  it.each(["TOKEN_EXPIRED", "INVALID_TOKEN", "USER_NOT_FOUND", "INVALID_USER"])("offers recovery after callback error %s", async (error) => {
    query = new URLSearchParams({ error, redirect: "/mafia/join/ABC123" });
    render(<VerifyEmailClient />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/изтекъл|невалиден/i);
    expect(screen.getByLabelText("Имейл")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Изпрати нов линк" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Изпрати нов линк" })).toHaveClass("btn-primary");
    expect(getSession).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Към входа" })).toHaveAttribute("href", "/sign-in?redirect=%2Fmafia%2Fjoin%2FABC123");
  });

  it("does not trust an unverified session and prefills only its own email", async () => {
    getSession.mockResolvedValue({ data: { user: { emailVerified: false, email: "own@example.bg" } }, error: null });
    render(<VerifyEmailClient />);
    expect(await screen.findByLabelText("Имейл")).toHaveValue("own@example.bg");
    expect(push).not.toHaveBeenCalled();
  });

  it("carries the invite through onboarding after token verification", async () => {
    query = new URLSearchParams({ token: "token", redirect: "/mafia/join/ABC123?source=invite" });
    verifyEmail.mockResolvedValue({ data: { status: true }, error: null });
    render(<VerifyEmailClient />);
    const link = await screen.findByRole("link", { name: "Продължи" });
    expect(new URL(link.getAttribute("href")!, "https://example.bg").searchParams.get("redirect"))
      .toBe("/mafia/join/ABC123?source=invite");
  });

  it("never sends an external redirect to navigation", async () => {
    query = new URLSearchParams({ token: "token", redirect: "//other.example" });
    window.localStorage.setItem("tutorial-completed", "1");
    verifyEmail.mockResolvedValue({ data: { status: true }, error: null });
    render(<VerifyEmailClient />);
    expect(await screen.findByRole("link", { name: "Продължи" })).toHaveAttribute("href", "/");
  });

  it("ignores a stale token response when the link changes", async () => {
    let complete!: (value: unknown) => void;
    query = new URLSearchParams({ token: "old-token" });
    verifyEmail.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const { rerender } = render(<VerifyEmailClient />);
    query = new URLSearchParams({ error: "TOKEN_EXPIRED" });
    rerender(<VerifyEmailClient />);
    await act(async () => complete({ data: { status: true }, error: null }));
    expect(screen.getByRole("alert")).toHaveTextContent(/изтекъл/i);
    expect(screen.queryByRole("link", { name: "Продължи" })).not.toBeInTheDocument();
  });

  it("recovers a rejected verification request without logging the token", async () => {
    query = new URLSearchParams({ token: "private-token" });
    verifyEmail.mockRejectedValue(new TypeError("private-token"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<VerifyEmailClient />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/опитай отново/i);
    expect(screen.getByRole("button", { name: "Опитай отново" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Изпрати нов линк" })).not.toBeInTheDocument();
    expect(log).not.toHaveBeenCalled();
  });

  it("retries a transient token failure once, signals the session and leaves navigation manual", async () => {
    vi.useFakeTimers();
    query = new URLSearchParams({ token: "retry-token", redirect: "/mafia/join/ABC123" });
    verifyEmail.mockRejectedValueOnce(new TypeError("offline"));
    let complete!: (value: unknown) => void;
    verifyEmail.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const sessionChange = vi.fn();
    window.addEventListener("auth-session-change", sessionChange);
    try {
      await act(async () => render(<StrictMode><VerifyEmailClient /></StrictMode>));
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Проверката не завърши");
      expect(sessionChange).not.toHaveBeenCalled();
      const retry = screen.getByRole("button", { name: "Опитай отново" });
      act(() => { fireEvent.click(retry); fireEvent.click(retry); });
      expect(verifyEmail).toHaveBeenCalledTimes(2);
      expect(verifyEmail).toHaveBeenLastCalledWith({ query: { token: "retry-token" } });
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Потвърждаваме имейла...");
      expect(screen.queryByRole("button", { name: "Опитай отново" })).not.toBeInTheDocument();
      await act(async () => complete({ data: { status: true }, error: null }));
      expect(sessionChange).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("link", { name: "Продължи" })).toHaveAttribute("href", "/tutorial?welcome=1&redirect=%2Fmafia%2Fjoin%2FABC123");
      act(() => vi.advanceTimersByTime(60_000));
      expect(push).not.toHaveBeenCalled();
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    } finally {
      window.removeEventListener("auth-session-change", sessionChange);
    }
  });

  it.each([408, 429, 500, 503])("allows retry after transient verification HTTP %s", async (status) => {
    query = new URLSearchParams({ token: "retry-token", redirect: "/mafia/join/ABC123" });
    window.localStorage.setItem("tutorial-completed", "1");
    verifyEmail.mockResolvedValueOnce({ error: { status, code: "USER_NOT_FOUND", message: "private backend detail" } });
    verifyEmail.mockResolvedValueOnce({ data: { status: true }, error: null });
    render(<VerifyEmailClient />);
    const retry = await screen.findByRole("button", { name: "Опитай отново" });
    expect(retry).toBeEnabled();
    expect(screen.queryByText(/private backend detail/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Изпрати нов линк" })).not.toBeInTheDocument();
    fireEvent.click(retry);
    expect(await screen.findByRole("link", { name: "Продължи" })).toHaveAttribute("href", "/mafia/join/ABC123");
    expect(verifyEmail).toHaveBeenCalledTimes(2);
    expect(verifyEmail).toHaveBeenLastCalledWith({ query: { token: "retry-token" } });
  });

  it.each([
    { status: 401, code: "INVALID_TOKEN" },
    { status: 401, code: "TOKEN_EXPIRED" },
    { status: 401, code: "USER_NOT_FOUND" },
    { status: 401, code: "INVALID_USER" },
    { status: 401 },
    { status: 400, code: "VALIDATION_ERROR" },
    { status: 403, code: "FORBIDDEN" },
    { status: 404, code: "NOT_FOUND" },
    { status: 410, code: "GONE" },
    { code: "INVALID_TOKEN" },
    { code: "TOKEN_EXPIRED" },
    { code: "USER_NOT_FOUND" },
    { code: "INVALID_USER" },
  ])("offers neutral recovery after a permanent token API error: %j", async (error) => {
    query = new URLSearchParams({ token: "invalid-token", redirect: "/mafia/join/ABC123" });
    verifyEmail.mockResolvedValue({ error: { ...error, message: "Account missing: synthetic@example.invalid" } });
    render(<VerifyEmailClient />);
    expect(await screen.findByRole("button", { name: "Изпрати нов линк" })).toHaveClass("btn-primary");
    expect(screen.queryByRole("button", { name: "Опитай отново" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Линкът е изтекъл или невалиден. Заяви нов линк.");
    expect(screen.getByLabelText("Имейл")).toHaveValue("");
    expect(screen.queryByText(/USER_NOT_FOUND|INVALID_USER|Account missing|synthetic@example/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Към входа" })).toHaveAttribute("href", "/sign-in?redirect=%2Fmafia%2Fjoin%2FABC123");
    expect(getSession).not.toHaveBeenCalled();
    expect(verifyEmail).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it.each(["rejection", "server-error"])("retries the session callback after a %s", async (failure) => {
    if (failure === "rejection") getSession.mockRejectedValueOnce(new TypeError("offline"));
    else getSession.mockResolvedValueOnce({ error: { status: 503 } });
    getSession.mockResolvedValueOnce({ data: { user: { emailVerified: true } }, error: null });
    render(<VerifyEmailClient />);
    fireEvent.click(await screen.findByRole("button", { name: "Опитай отново" }));
    expect(await screen.findByRole("link", { name: "Продължи" })).toBeInTheDocument();
    expect(getSession).toHaveBeenCalledTimes(2);
    expect(verifyEmail).not.toHaveBeenCalled();
  });
});
