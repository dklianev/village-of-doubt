import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VerifyEmailClient } from "../VerifyEmailClient";

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
    await act(async () => render(<StrictMode><VerifyEmailClient /></StrictMode>));
    expect(screen.getByRole("heading", { name: "Имейлът е потвърден." })).toBeInTheDocument();
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(verifyEmail).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Продължи" })).toHaveAttribute("href", "/werewolf/join/ABC123");
    act(() => vi.advanceTimersByTime(6000));
    expect(push).toHaveBeenCalledWith("/werewolf/join/ABC123");
  });

  it.each(["TOKEN_EXPIRED", "INVALID_TOKEN"])("offers recovery after callback error %s", async (error) => {
    query = new URLSearchParams({ error, redirect: "/mafia/join/ABC123" });
    render(<VerifyEmailClient />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/изтекъл|невалиден/i);
    expect(screen.getByLabelText("Имейл")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Изпрати нов линк" })).toBeEnabled();
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
    expect(screen.getByRole("button", { name: "Изпрати нов линк" })).toBeEnabled();
    expect(log).not.toHaveBeenCalled();
  });
});
