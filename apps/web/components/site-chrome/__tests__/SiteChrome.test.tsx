import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SiteChrome from "@/components/site-chrome";
import type { ComponentProps } from "react";

const route = vi.hoisted(() => ({ pathname: "/" }));
const drawerRender = vi.hoisted(() => vi.fn());
vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean }) =>
    <a {...props} data-prefetch={String(prefetch)} />,
}));
vi.mock("@/components/site-chrome/NavigationPanels", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../NavigationPanels")>();
  return {
    ...actual,
    MobileDrawer: (props: Parameters<typeof actual.MobileDrawer>[0]) => {
      drawerRender(props);
      return <actual.MobileDrawer {...props} />;
    },
  };
});
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/use-auth-session", () => ({
  useAuthSession: () => ({ data: null, isPending: false }),
}));
vi.mock("@/lib/sound", () => ({
  getSoundEnabled: () => false,
  setSoundEnabled: vi.fn(),
  playCue: vi.fn(),
}));

describe("Senkite navigation", () => {
  beforeEach(() => {
    route.pathname = "/";
    localStorage.clear();
    drawerRender.mockClear();
  });

  it.each(["/", "/tutorial", "/faq", "/werewolf/rules", "/mafia/rules"])(
    "keeps the brand navigable without prefetching the homepage from %s", (pathname) => {
      route.pathname = pathname;
      render(<SiteChrome initialSession={null} />);
      const brand = screen.getByRole("link", { name: "Сенките, начало" });
      expect(brand).toHaveAttribute("href", "/");
      expect(brand).toHaveAttribute("data-prefetch", "false");
    },
  );

  it("preloads on More hover and focus without rendering a hidden drawer", async () => {
    const user = userEvent.setup();
    render(<SiteChrome initialSession={null} />);
    const more = screen.getByRole("button", { name: "Още страници" });
    await user.hover(more);
    await act(async () => { more.focus(); });
    await user.click(more);
    await screen.findByRole("navigation", { name: "Още страници" });
    expect(drawerRender).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Отвори менюто" }));
    expect(await screen.findByRole("dialog", { name: "Навигация" })).toBeVisible();
    expect(drawerRender).toHaveBeenCalled();
  });

  it.each(["mafia", "werewolves"])("offers both games instead of redirecting to the remembered %s", async (family) => {
    localStorage.setItem("last-family", family);
    const user = userEvent.setup();
    render(<SiteChrome initialSession={null} />);
    expect(screen.getByRole("link", { name: "Сенките, начало" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Имам код" })).toHaveAttribute("href", "/join");
    const play = screen.getAllByRole("button", { name: "Играй" })[0]!;
    await user.click(play);
    const choices = within(await screen.findByRole("navigation", { name: "Нова игра" }));
    expect(choices.getByRole("link", { name: "Върколак" })).toHaveAttribute("href", "/werewolf/create");
    expect(choices.getByRole("link", { name: "Мафия" })).toHaveAttribute("href", "/mafia/create");
    expect(play).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "Нова игра" })).not.toBeInTheDocument();
    expect(play).toHaveFocus();
  });

  it("keeps only one navigation disclosure open and closes it when focus leaves", async () => {
    const user = userEvent.setup();
    render(<><SiteChrome initialSession={null} /><button>След навигацията</button></>);
    await user.click(screen.getAllByRole("button", { name: "Играй" })[0]!);
    await user.click(screen.getByRole("button", { name: "Още страници" }));
    expect(screen.queryByRole("navigation", { name: "Нова игра" })).not.toBeInTheDocument();
    const more = await screen.findByRole("navigation", { name: "Още страници" });
    expect(within(more).getByRole("link", { name: "Класация" })).toHaveAttribute("href", "/leaderboard");
    await user.click(screen.getByRole("button", { name: "След навигацията" }));
    await waitFor(() => expect(screen.queryByRole("navigation", { name: "Още страници" })).not.toBeInTheDocument());
  });

  it("marks a game family current on its nested pages", () => {
    route.pathname = "/mafia/roles";
    render(<SiteChrome initialSession={null} />);
    expect(screen.getByRole("link", { name: "Мафия" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("link", { name: "Върколак" })).not.toHaveAttribute("aria-current");
    expect(localStorage.getItem("last-family")).toBe("mafia");
  });

  it("does not invite someone in a room to start or join another game", () => {
    route.pathname = "/play/ROOM42";
    render(<SiteChrome initialSession={null} />);
    expect(screen.queryByRole("button", { name: "Играй" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Играй" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Имам код" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Включи звука" }).length).toBeGreaterThan(0);
  });
});
