import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSessionView } from "@/lib/use-auth-session";
import { AuthChip } from "../AuthChip";
import "@/lib/__tests__/auth-session-end-styles";

const push = vi.fn();
const browserWindow = window;
const replace = vi.fn();
const logoutRevisionKey = "auth-logout-revision";
const authMocks = vi.hoisted(() => ({
  signOut: vi.fn<() => Promise<{ error: { status: number; message: string } | null }>>(),
  session: { data: null as AuthSessionView | null, isPending: false, refresh: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: authMocks,
}));

vi.mock("@/lib/use-auth-session", () => ({
  useAuthSession: () => authMocks.session,
}));

describe("AuthChip", () => {
  beforeEach(() => {
    authMocks.signOut.mockReset().mockResolvedValue({ error: null });
    push.mockClear();
    replace.mockReset();
    browserWindow.localStorage.removeItem(logoutRevisionKey);
    vi.stubGlobal("window", new Proxy(browserWindow, {
      get(target, key) {
        if (key === "location") return { replace };
        return Reflect.get(target, key, target);
      },
    }));
    authMocks.session.data = null;
    authMocks.session.isPending = false;
  });

  afterEach(() => {
    document.getElementById("auth-session-ended")?.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("preserves guest public BFCache restores without navigation or hiding the document", () => {
    render(<AuthChip />);
    browserWindow.localStorage.setItem(logoutRevisionKey, "later-logout");
    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    expect(replace).not.toHaveBeenCalled();
    expect(document.documentElement.style.display).toBe("");
  });

  it("preserves unchanged authenticated BFCache restores, but leaves an older document after logout", () => {
    authMocks.session.data = { user: { id: "synthetic-player" } };
    const view = <><main><p>Synthetic private account</p></main><AuthChip /></>;
    const { unmount, rerender } = render(view);
    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    expect(replace).not.toHaveBeenCalled();
    expect(document.documentElement.style.display).toBe("");
    expect(screen.getByText("Synthetic private account")).toBeVisible();

    browserWindow.localStorage.setItem(logoutRevisionKey, "later-logout");
    authMocks.session.data = null;
    rerender(<><main><p>Synthetic private account</p></main><AuthChip /></>);
    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: false }));
    fireEvent(window, new PopStateEvent("popstate"));
    expect(replace).not.toHaveBeenCalled();
    expect(document.documentElement.style.display).toBe("");

    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    expect(document.documentElement.style.display).toBe("");
    expect(replace).toHaveBeenCalledExactlyOnceWith("/");
    expect(screen.getByText("Synthetic private account")).not.toBeVisible();
    expect(screen.getByRole("heading", { name: "Сесията ти е приключила" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Към началото" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Към началото" })).toHaveFocus();
    expect(authMocks.signOut).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    unmount();
    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    expect(replace).toHaveBeenCalledOnce();
  });

  it.each([false, true])("handles unavailable revision storage conservatively only for authenticated documents: %s", (authenticated) => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    authMocks.session.data = authenticated ? { user: { id: "synthetic-player" } } : null;
    render(<AuthChip />);
    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    expect(replace).toHaveBeenCalledTimes(authenticated ? 1 : 0);
    expect(document.documentElement.style.display).toBe("");
  });

  it("removes the old revision if storage quota blocks the successful logout marker", async () => {
    authMocks.session.data = { user: { id: "synthetic-player" } };
    const user = userEvent.setup();
    render(<AuthChip variant="drawer" />);
    expect(browserWindow.localStorage.getItem(logoutRevisionKey)).toBe("0");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    await user.click(screen.getByRole("button", { name: "Изход" }));
    await user.click(await screen.findByRole("button", { name: "Излизам" }));
    await waitFor(() => expect(replace).toHaveBeenCalledExactlyOnceWith("/"));
    expect(browserWindow.localStorage.getItem(logoutRevisionKey)).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a stable pending slot until the static shell resolves the client session", () => {
    authMocks.session.isPending = true;

    const { container, rerender } = render(<AuthChip initialSession={null} />);
    const pendingSlot = container.querySelector(".auth-chip-slot");

    expect(pendingSlot).toHaveAttribute("data-auth-state", "pending");
    expect(screen.queryByRole("link", { name: /Влез/ })).not.toBeInTheDocument();

    authMocks.session.isPending = false;
    rerender(<AuthChip initialSession={null} />);

    expect(container.querySelector(".auth-chip-slot")).toHaveAttribute("data-auth-state", "guest");
    expect(screen.getByRole("link", { name: /Влез/ })).toBeInTheDocument();
  });

  it("shows a sign-in link for a resolved guest", () => {
    render(<AuthChip initialSession={null} />);

    const link = screen.getByRole("link", { name: "Влез" });
    expect(link).toHaveAttribute("href", "/sign-in");
    expect(link.querySelectorAll("svg")).toHaveLength(1);
    expect(link.querySelector(".auth-chip-login-icon")).toHaveAttribute("aria-hidden", "true");
  });

  it("does not navigate away from an invitation on the sign-in route", () => {
    render(<AuthChip initialSession={null} pathname="/sign-in" />);
    expect(screen.queryByRole("link", { name: "Влез" })).not.toBeInTheDocument();
    const currentPage = screen.getByText("Вход").closest("[aria-current]");
    expect(currentPage).toHaveAttribute("aria-current", "page");
    expect(currentPage?.tagName).toBe("SPAN");
    expect(currentPage).not.toHaveAttribute("tabindex");
  });

  it("keeps a drawer open when the sign-in link is opened in another tab", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<AuthChip initialSession={null} variant="drawer" onNavigate={onNavigate} />);
    const link = screen.getByRole("link", { name: "Влез" });
    link.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.keyboard("{Control>}");
    await user.click(link);
    await user.keyboard("{/Control}");
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("exposes profile destinations as native navigation links", async () => {
    authMocks.session.data = { user: { id: "user-1", name: "Анна", image: "" } };
    const user = userEvent.setup();

    render(<AuthChip initialSession={null} />);
    await user.click(screen.getByRole("button", { name: "Меню на Анна" }));

    const navigation = screen.getByRole("navigation", { name: "Профил" });
    expect(navigation).toContainElement(screen.getByRole("link", { name: "Моето досие" }));
    expect(navigation).toContainElement(screen.getByRole("link", { name: "История" }));
    expect(navigation).toContainElement(screen.getByRole("link", { name: "Постижения" }));
    expect(navigation).toContainElement(screen.getByRole("button", { name: "Изход" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("opens sign-out as a trapped modal and restores focus to the profile trigger", async () => {
    authMocks.session.data = { user: { id: "user-1", name: "Анна", image: "" } };
    const user = userEvent.setup();

    render(
      <>
        <a href="/faq">Фоново съдържание</a>
        <AuthChip initialSession={null} />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Меню на Анна" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Изход" }));

    const dialog = await screen.findByRole("dialog", { name: "Излизаш ли от масата?" });
    const close = screen.getByRole("button", { name: "Затвори" });
    const confirm = screen.getByRole("button", { name: "Излизам" });
    expect(dialog).toContainElement(close);
    expect(screen.getByText("Фоново съдържание").closest("div")).toHaveAttribute("aria-hidden", "true");
    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Излизаш ли от масата?" })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it.each([
    { variant: "dropdown" as const, failure: "rejected" },
    { variant: "dropdown" as const, failure: "returned" },
    { variant: "drawer" as const, failure: "rejected" },
    { variant: "drawer" as const, failure: "returned" },
  ])("allows retry after a $failure sign-out failure in $variant without invalidating the session or navigating", async ({ variant, failure }) => {
    authMocks.session.data = { user: { id: "user-1", name: "Анна", image: "" } };
    if (failure === "rejected") {
      authMocks.signOut.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    } else {
      authMocks.signOut.mockResolvedValueOnce({ error: { status: 503, message: "Unavailable" } });
    }
    const onNavigate = vi.fn();
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const user = userEvent.setup();
    const { container } = render(<AuthChip variant={variant} onNavigate={onNavigate} />);
    const revisionBeforeLogout = browserWindow.localStorage.getItem(logoutRevisionKey);
    if (variant === "dropdown") {
      await user.click(screen.getByRole("button", { name: "Меню на Анна" }));
    }
    await user.click(screen.getByRole("button", { name: "Изход" }));
    await user.click(await screen.findByRole("button", { name: "Излизам" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Излизането не успя. Опитай отново.");
    expect(screen.getByRole("button", { name: "Отказ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Опитай отново" })).toBeEnabled();
    expect(container.querySelector(".auth-chip-slot")).toHaveAttribute("data-auth-state", "authenticated");
    expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "auth-session-change" }));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(browserWindow.localStorage.getItem(logoutRevisionKey)).toBe(revisionBeforeLogout);

    await user.click(screen.getByRole("button", { name: "Опитай отново" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(authMocks.signOut).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "auth-session-change" }));
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledExactlyOnceWith("/");
    expect(browserWindow.localStorage.getItem(logoutRevisionKey)).not.toBe(revisionBeforeLogout);
  });
});
