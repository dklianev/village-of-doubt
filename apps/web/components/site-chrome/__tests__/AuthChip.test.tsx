import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthChip } from "../AuthChip";

const refresh = vi.fn(() => Promise.resolve());
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signOut: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("@/lib/use-auth-session", () => ({
  useAuthSession: vi.fn(),
}));

describe("AuthChip", () => {
  it("shows a sign-in link for guests", async () => {
    const { useAuthSession } = await import("@/lib/use-auth-session");
    vi.mocked(useAuthSession).mockReturnValue({ data: null, isPending: false, refresh });

    render(<AuthChip initialSession={null} />);

    expect(screen.getByRole("link", { name: /Влез/ })).toHaveAttribute("href", "/sign-in");
  });

  it("shows the user menu for an authenticated player", async () => {
    const { useAuthSession } = await import("@/lib/use-auth-session");
    vi.mocked(useAuthSession).mockReturnValue({
      data: { user: { id: "user-1", name: "Анна", image: "" } },
      isPending: false,
      refresh,
    });
    const user = userEvent.setup();

    render(<AuthChip initialSession={null} />);
    await user.click(screen.getByRole("button", { name: "Меню на Анна" }));

    expect(screen.getByRole("menuitem", { name: "Моят профил" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "История" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Постижения" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Изход" })).toBeInTheDocument();
  });
});
