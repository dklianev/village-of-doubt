import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSessionView } from "@/lib/use-auth-session";
import { MobileDrawer } from "../MobileDrawer";

const authMocks = vi.hoisted(() => ({
  signOut: vi.fn(async () => ({ error: null })),
  push: vi.fn(),
  session: { data: null as AuthSessionView | null, isPending: false },
}));

vi.mock("@/lib/use-auth-session", () => ({
  useAuthSession: () => authMocks.session,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: authMocks.signOut },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: authMocks.push }),
}));

function DrawerHarness({ pathname = "/" }: { pathname?: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        Отвори менюто
      </button>
      <a href="/tutorial">Фоново съдържание</a>
      <MobileDrawer
        open={open}
        pathname={pathname}
        soundEnabled={false}
        themePreference="dark"
        initialSession={null}
        triggerRef={triggerRef}
        onOpenChange={setOpen}
        onToggleSound={() => {}}
        onCycleTheme={() => {}}
      />
    </>
  );
}

describe("MobileDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.session.data = null;
    authMocks.session.isPending = false;
  });

  it("uses a modal sheet, isolates the page, and restores focus to its opener", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);

    const opener = screen.getByRole("button", { name: "Отвори менюто" });
    await user.click(opener);

    const dialog = await screen.findByRole("dialog", { name: "Навигация" });
    expect(dialog).toContainElement(screen.getByRole("link", { name: "Влез" }));
    expect(screen.getByText("Фоново съдържание").closest("div")?.getAttribute("aria-hidden")).toBe("true");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Навигация" })).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("does not override the design-system Sheet identity from consumer CSS", () => {
    const chromeCss = readFileSync(resolve(process.cwd(), "components/site-chrome/SiteChrome.module.css"), "utf8");

    expect(chromeCss).not.toMatch(/:global\(\.ds-sheet/);
  });

  it("exposes every authenticated destination without a second menu or duplicate links", async () => {
    authMocks.session.data = { user: { id: "user-1", name: "Анна", image: "" } };
    const user = userEvent.setup();
    render(<DrawerHarness />);
    await user.click(screen.getByRole("button", { name: "Отвори менюто" }));

    const drawer = within(screen.getByRole("dialog", { name: "Навигация" }));
    for (const name of ["Моето досие", "История", "Постижения"]) {
      expect(drawer.getAllByRole("link", { name })).toHaveLength(1);
    }
    expect(drawer.getByRole("button", { name: "Изход" })).toBeVisible();
    expect(drawer.queryByRole("button", { name: "Меню на Анна" })).not.toBeInTheDocument();
  });

  it("marks the current destination for assistive technology", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness pathname="/werewolf" />);
    await user.click(screen.getByRole("button", { name: "Отвори менюто" }));

    expect(screen.getByRole("link", { name: "Върколак" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Мафия" })).not.toHaveAttribute("aria-current");
  });

  it.each([false, true])("closes on an account destination, authenticated=%s", async (authenticated) => {
    if (authenticated) {
      authMocks.session.data = { user: { id: "user-1", name: "Анна", image: "" } };
    }
    const user = userEvent.setup();
    render(<DrawerHarness />);
    await user.click(screen.getByRole("button", { name: "Отвори менюто" }));
    const destination = screen.getByRole("link", { name: authenticated ? "Моето досие" : "Влез" });
    destination.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(destination);

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Навигация" })).not.toBeInTheDocument());
  });

  it("keeps logout confirmation modal and returns to the direct action on cancel", async () => {
    authMocks.session.data = { user: { id: "user-1", name: "Анна", image: "" } };
    const user = userEvent.setup();
    render(<DrawerHarness />);
    await user.click(screen.getByRole("button", { name: "Отвори менюто" }));
    const logout = screen.getByRole("button", { name: "Изход" });
    await user.click(logout);

    const confirmation = await screen.findByRole("dialog", { name: "Излизаш ли от масата?" });
    expect(confirmation).toContainElement(screen.getByRole("button", { name: "Излизам" }));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Излизаш ли от масата?" })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "Навигация" })).toBeInTheDocument();
    await waitFor(() => expect(logout).toHaveFocus());
    expect(authMocks.signOut).not.toHaveBeenCalled();

    await user.click(logout);
    await user.click(await screen.findByRole("button", { name: "Излизам" }));

    await waitFor(() => expect(authMocks.signOut).toHaveBeenCalledOnce());
    expect(authMocks.push).toHaveBeenCalledWith("/");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
