import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSessionView } from "@/lib/use-auth-session";
import { AuthChip } from "../AuthChip";

const push = vi.fn();
const authMocks = vi.hoisted(() => ({
  signOut: vi.fn(() => Promise.resolve()),
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
    authMocks.signOut.mockClear();
    authMocks.session.data = null;
    authMocks.session.isPending = false;
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

    expect(screen.getByRole("link", { name: /Влез/ })).toHaveAttribute("href", "/sign-in");
  });

  it("exposes profile destinations as native navigation links", async () => {
    authMocks.session.data = { user: { id: "user-1", name: "Анна", image: "" } };
    const user = userEvent.setup();

    render(<AuthChip initialSession={null} />);
    await user.click(screen.getByRole("button", { name: "Меню на Анна" }));

    const navigation = screen.getByRole("navigation", { name: "Профил" });
    expect(navigation).toContainElement(screen.getByRole("link", { name: "Моето досие" }));
    expect(navigation).toContainElement(screen.getByRole("link", { name: "История" }));
    expect(navigation).toContainElement(screen.getByRole("link", { name: "Легенди" }));
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
});
