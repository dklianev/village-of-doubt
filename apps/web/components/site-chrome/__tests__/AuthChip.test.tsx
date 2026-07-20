import { render, screen } from "@testing-library/react";
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

  it("shows the user menu for an authenticated player", async () => {
    authMocks.session.data = { user: { id: "user-1", name: "Анна", image: "" } };
    const user = userEvent.setup();

    render(<AuthChip initialSession={null} />);
    await user.click(screen.getByRole("button", { name: "Меню на Анна" }));

    expect(screen.getByRole("menuitem", { name: "Моето досие" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "История" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Легенди" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Изход" })).toBeInTheDocument();
  });
});
