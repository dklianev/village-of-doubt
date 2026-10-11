import { Activity, StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { endAuthSession } from "@/lib/auth-session-end";
import { AccountDangerZone } from "../AccountDangerZone";
import { AccountSections } from "../AccountSections";

vi.mock("@/lib/auth-client", () => ({ authClient: { signOut: vi.fn() } }));
vi.mock("@/lib/auth-session-end", () => ({ endAuthSession: vi.fn() }));

beforeEach(() => {
  vi.mocked(authClient.signOut).mockReset().mockResolvedValue({ data: { success: true }, error: null });
  vi.mocked(endAuthSession).mockReset();
});

afterEach(() => { window.history.replaceState(null, "", "/"); });

describe("account deletion session termination", () => {
  it("ends the authenticated document after bounded cookie cleanup", async () => {
    const user = userEvent.setup();
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: true }));
    render(<AccountDangerZone email="synthetic@example.invalid" />);
    await user.click(screen.getByRole("button", { name: "Изтрий моето досие" }));
    await user.type(screen.getByRole("textbox"), "ИЗТРИЙ");
    await user.click(screen.getByRole("button", { name: "Изтрий завинаги" }));

    await waitFor(() => expect(endAuthSession).toHaveBeenCalledOnce());
    expect(authClient.signOut).toHaveBeenCalledOnce();
    expect(authClient.signOut).toHaveBeenCalledWith({ fetchOptions: { signal: expect.any(AbortSignal), retry: 0 } });
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith("/api/account/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intent: "delete-account" }),
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Изтриваме..." })).toBeDisabled();
  });

  it.each(["network error", "error response"])("still ends the session after a cookie cleanup %s", async (failure) => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: true }));
    if (failure === "network error") vi.mocked(authClient.signOut).mockRejectedValue(new Error("offline"));
    else vi.mocked(authClient.signOut).mockResolvedValue({
      data: null,
      error: { status: 401, statusText: "Unauthorized", message: "Session already deleted" },
    });
    render(<AccountDangerZone email="synthetic@example.invalid" />);
    await user.click(screen.getByRole("button", { name: "Изтрий моето досие" }));
    await user.type(screen.getByRole("textbox"), "ИЗТРИЙ");
    await user.click(screen.getByRole("button", { name: "Изтрий завинаги" }));

    await waitFor(() => expect(endAuthSession).toHaveBeenCalledOnce());
    expect(authClient.signOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ends the session when the cleanup deadline aborts a stalled sign-out", async () => {
    const user = userEvent.setup();
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ok: true }));
    vi.mocked(authClient.signOut).mockImplementation((options) => new Promise((_resolve, reject) => {
      options?.fetchOptions?.signal?.addEventListener("abort", () => reject(new DOMException("Timed out", "TimeoutError")), { once: true });
    }));
    render(<AccountDangerZone email="synthetic@example.invalid" />);
    await user.click(screen.getByRole("button", { name: "Изтрий моето досие" }));
    await user.type(screen.getByRole("textbox"), "ИЗТРИЙ");
    await user.click(screen.getByRole("button", { name: "Изтрий завинаги" }));
    expect(timeout).toHaveBeenCalledWith(1_500);
    expect(authClient.signOut).toHaveBeenCalledWith({ fetchOptions: { signal: deadline.signal, retry: 0 } });
    expect(endAuthSession).not.toHaveBeenCalled();

    await act(async () => { deadline.abort(); });
    expect(endAuthSession).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["HTTP error", "invalid error JSON", "network error"])(
    "retains the session and confirmation for retry after a deletion %s",
    async (failure) => {
      const user = userEvent.setup();
      const request = vi.spyOn(globalThis, "fetch");
      if (failure === "network error") request.mockRejectedValueOnce(new Error("offline"));
      else if (failure === "invalid error JSON") request.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
      else request.mockResolvedValueOnce(Response.json({ error: "Опитай отново." }, { status: 503 }));
      request.mockResolvedValue(Response.json({ ok: true }));
      render(<AccountDangerZone email="synthetic@example.invalid" />);
      await user.click(screen.getByRole("button", { name: "Изтрий моето досие" }));
      await user.type(screen.getByRole("textbox"), "ИЗТРИЙ");
      await user.click(screen.getByRole("button", { name: "Изтрий завинаги" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        failure === "HTTP error" ? "Опитай отново." : "Грешка при изтриване.",
      );
      expect(endAuthSession).not.toHaveBeenCalled();
      expect(authClient.signOut).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog")).toHaveAttribute("open");
      expect(screen.getByRole("textbox")).toHaveValue("ИЗТРИЙ");
      expect(screen.getByRole("button", { name: "Отказ" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Изтрий завинаги" })).toBeEnabled();

      await user.click(screen.getByRole("button", { name: "Изтрий завинаги" }));
      await waitFor(() => expect(endAuthSession).toHaveBeenCalledOnce());
      expect(request).toHaveBeenCalledTimes(2);
      expect(authClient.signOut).toHaveBeenCalledOnce();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("waits for successful deletion before ending the session, even while Activity is hidden", async () => {
    const user = userEvent.setup();
    let completeDeletion!: (response: Response) => void;
    const deletion = new Promise<Response>((resolve) => { completeDeletion = resolve; });
    vi.spyOn(globalThis, "fetch").mockReturnValue(deletion);
    const view = (mode: "visible" | "hidden") => (
      <Activity mode={mode}><AccountDangerZone email="synthetic@example.invalid" /></Activity>
    );
    const { rerender } = render(view("visible"));
    await user.click(screen.getByRole("button", { name: "Изтрий моето досие" }));
    await user.type(screen.getByRole("textbox"), "ИЗТРИЙ");
    await user.click(screen.getByRole("button", { name: "Изтрий завинаги" }));
    rerender(view("hidden"));
    expect(endAuthSession).not.toHaveBeenCalled();
    expect(authClient.signOut).not.toHaveBeenCalled();

    await act(async () => { completeDeletion(Response.json({ ok: true })); });
    expect(endAuthSession).toHaveBeenCalledOnce();
    expect(authClient.signOut).toHaveBeenCalledOnce();
  });
});

describe("account deletion dialog lifecycle", () => {
  it("releases the security modal on Back to Chronicle and restores its draft on Forward", async () => {
    const user = userEvent.setup();
    const close = vi.spyOn(HTMLDialogElement.prototype, "close");
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    window.history.replaceState(null, "", "/account");
    render(
      <StrictMode>
        <a href="#account-identity">Редактирай</a>
        <AccountSections
          chronicle={<p>Игрова история</p>}
          identity={<input aria-label="Име" defaultValue="Мила" />}
          security={<AccountDangerZone email="synthetic@example.invalid" />}
        />
      </StrictMode>,
    );
    document.getElementById("account-identity")!.scrollIntoView = vi.fn();
    document.getElementById("account-security")!.scrollIntoView = vi.fn();
    await user.click(screen.getByRole("link", { name: "Редактирай" }));
    await user.type(await screen.findByRole("textbox", { name: "Име" }), " draft");
    await user.click(screen.getByRole("tab", { name: "Данни и сигурност" }));
    await user.click(screen.getByRole("button", { name: "Изтрий моето досие" }));
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    await user.type(screen.getByRole("textbox"), "confirmation draft");

    act(() => window.history.back());
    await waitFor(() => expect(window.location.hash).toBe(""));
    await waitFor(() => expect(screen.getByRole("tab", { name: "Хроника" })).toHaveAttribute("aria-selected", "true"));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Игрова история");
    expect(dialog.open).toBe(false);
    expect(close).toHaveBeenCalledOnce();
    fireEvent(dialog, new Event("close"));
    expect(scroll).not.toHaveBeenCalled();

    act(() => window.history.forward());
    await waitFor(() => expect(window.location.hash).toBe("#account-security"));
    await waitFor(() => expect(dialog.open).toBe(true));
    expect(screen.getByRole("textbox")).toHaveValue("confirmation draft");
    fireEvent(dialog, new Event("close"));
    expect(dialog.open).toBe(true);
    await user.click(screen.getByRole("button", { name: "Отказ" }));
    await user.click(screen.getByRole("tab", { name: "Образ и достъп" }));
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Мила draft");
  });

  it("releases the native dialog on Activity hide and restores it on reveal", async () => {
    const user = userEvent.setup();
    const show = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    const close = vi.spyOn(HTMLDialogElement.prototype, "close");
    const view = (mode: "visible" | "hidden") => (
      <StrictMode><Activity mode={mode}><AccountDangerZone email="synthetic@example.invalid" /></Activity></StrictMode>
    );
    const { rerender, unmount } = render(view("visible"));
    // The account route has already been cached before the dialog first opens.
    rerender(view("hidden"));
    rerender(view("visible"));
    await user.click(screen.getByRole("button", { name: "Изтрий моето досие" }));
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    const confirmation = screen.getByRole("textbox");
    await user.type(confirmation, "test draft");
    expect(show).toHaveBeenCalledTimes(1);

    rerender(view("hidden"));
    expect(close).toHaveBeenCalledTimes(1);
    expect(dialog.open).toBe(false);
    // Native close events are queued. Cleanup must not discard the preserved state.
    fireEvent(dialog, new Event("close"));
    rerender(view("visible"));
    expect(dialog.open).toBe(true);
    expect(show.mock.calls.length - close.mock.calls.length).toBe(1);
    expect(confirmation).toHaveValue("test draft");

    rerender(view("hidden"));
    rerender(view("visible"));
    fireEvent(dialog, new Event("close"));
    expect(dialog.open).toBe(true);
    expect(show.mock.calls.length - close.mock.calls.length).toBe(1);

    unmount();
    expect(dialog.open).toBe(false);
    expect(close.mock.calls.length).toBe(show.mock.calls.length);
  });

  it("resets confirmation on cancel and restores focus after the native close event", async () => {
    const user = userEvent.setup();
    render(<AccountDangerZone email="synthetic@example.invalid" />);
    const trigger = screen.getByRole("button", { name: "Изтрий моето досие" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    await user.type(screen.getByRole("textbox"), "ИЗТРИЙ");
    expect(screen.getByRole("button", { name: "Изтрий завинаги" })).toBeEnabled();
    // JSDOM does not implement native Escape/close dispatch or top-layer focus.
    act(() => { dialog.dispatchEvent(new Event("cancel", { cancelable: true })); });
    fireEvent(dialog, new Event("close"));
    expect(dialog.open).toBe(false);
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Изтрий завинаги" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Отказ" }));
    expect(dialog.open).toBe(false);
  });
});
