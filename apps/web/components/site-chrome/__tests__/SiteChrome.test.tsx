import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const sound = vi.hoisted(() => ({ enabled: false }));
vi.mock("@/lib/sound", () => ({
  SOUND_CHANGE_EVENT: "werewolf-sound-change",
  getSoundEnabled: () => sound.enabled,
  setSoundEnabled: vi.fn(),
  playCue: vi.fn(),
}));

describe("theme transition privacy", () => {
  const originalTransition = Object.getOwnPropertyDescriptor(document, "startViewTransition");

  function installTransitions() {
    const changes: { update: () => void; finish: () => void; fail: () => void; skip: ReturnType<typeof vi.fn> }[] = [];
    const start = vi.fn((update: () => void) => {
      let finish!: () => void;
      let fail!: () => void;
      const finished = new Promise<void>((resolve, reject) => {
        finish = resolve;
        fail = () => reject(new Error("update failed"));
      });
      const skip = vi.fn();
      changes.push({ update, finish, fail, skip });
      return { ready: Promise.resolve(), finished, skipTransition: skip };
    });
    Object.defineProperty(document, "startViewTransition", { configurable: true, writable: true, value: start });
    return { start, changes };
  }

  function expectTheme(theme: "light" | "dark") {
    expect(document.documentElement).toHaveAttribute("data-theme", theme);
    expect(localStorage.getItem("werewolf-theme")).toBe(theme);
    expect(screen.getByRole("button", { name: theme === "light" ? "Смени на тъмна тема" : "Смени на светла тема" })).toBeEnabled();
  }

  beforeEach(() => {
    route.pathname = "/";
    localStorage.clear();
    document.documentElement.dataset.theme = "dark";
    delete document.documentElement.dataset.vt;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalTransition) Object.defineProperty(document, "startViewTransition", originalTransition);
    else Reflect.deleteProperty(document, "startViewTransition");
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.vt;
  });

  it.each(["/play/ROOM42", "/play/VISUAL", "/play/ROOM42/private", "/lobby/ROOM42"])(
    "applies a room theme synchronously without snapshots on %s", (pathname) => {
      route.pathname = pathname;
      const { start } = installTransitions();
      render(<SiteChrome initialSession={null} />);
      const button = screen.getByRole("button", { name: "Смени на светла тема" });
      act(() => {
        button.focus();
        button.click();
        expect(document.documentElement.dataset.theme).toBe("light");
      });
      expectTheme("light");
      expect(button).toHaveFocus();
      expect(start).not.toHaveBeenCalled();
      expect(document.documentElement).not.toHaveAttribute("data-vt");
    },
  );

  it.each(["/", "/werewolf/roles", "/mafia/rules", "/lobby"])(
    "retains the existing public transition on %s", async (pathname) => {
      route.pathname = pathname;
      const { start, changes } = installTransitions();
      render(<SiteChrome initialSession={null} />);
      expect(start).not.toHaveBeenCalled();
      act(() => screen.getByRole("button", { name: "Смени на светла тема" }).click());
      expect(start).toHaveBeenCalledOnce();
      expect(document.documentElement.dataset.theme).toBe("dark");
      act(() => changes[0]!.update());
      expectTheme("light");
      expect(document.documentElement).toHaveAttribute("data-vt", "theme");
      await act(async () => changes[0]!.finish());
      expect(document.documentElement).not.toHaveAttribute("data-vt");
    },
  );

  it.each(["/", "/play/ROOM42"])("respects reduced motion on %s", (pathname) => {
    route.pathname = pathname;
    const { start } = installTransitions();
    const matchMedia = window.matchMedia;
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      ...matchMedia(query), matches: query === "(prefers-reduced-motion: reduce)",
    })));
    render(<SiteChrome initialSession={null} />);
    act(() => screen.getByRole("button", { name: "Смени на светла тема" }).click());
    expectTheme("light");
    expect(start).not.toHaveBeenCalled();
    expect(document.documentElement).not.toHaveAttribute("data-vt");
  });

  it.each(["missing", "undefined"])("falls back immediately when the API is %s", (api) => {
    if (api === "missing") Reflect.deleteProperty(document, "startViewTransition");
    else Object.defineProperty(document, "startViewTransition", { configurable: true, value: undefined });
    render(<SiteChrome initialSession={null} />);
    act(() => screen.getByRole("button", { name: "Смени на светла тема" }).click());
    expectTheme("light");
    expect(document.documentElement).not.toHaveAttribute("data-vt");
  });

  it("falls back immediately when starting a transition throws", () => {
    const { start } = installTransitions();
    start.mockImplementation(() => { throw new Error("unavailable"); });
    render(<SiteChrome initialSession={null} />);
    act(() => screen.getByRole("button", { name: "Смени на светла тема" }).click());
    expectTheme("light");
    expect(document.documentElement).not.toHaveAttribute("data-vt");
  });

  it("settles the actual theme when the transition fails before updating", async () => {
    const { changes } = installTransitions();
    render(<SiteChrome initialSession={null} />);
    act(() => screen.getByRole("button", { name: "Смени на светла тема" }).click());
    await act(async () => changes[0]!.fail());
    expectTheme("light");
    expect(document.documentElement).not.toHaveAttribute("data-vt");
  });

  it("handles a skipped animation without leaving the theme pending", async () => {
    const { start } = installTransitions();
    render(<SiteChrome initialSession={null} />);
    start.mockImplementationOnce((update) => {
      const finished = Promise.resolve().then(update);
      return { ready: Promise.reject(new Error("animation skipped")), finished, skipTransition: vi.fn() };
    });
    await act(async () => screen.getByRole("button", { name: "Смени на светла тема" }).click());
    expectTheme("light");
    expect(document.documentElement).not.toHaveAttribute("data-vt");
  });

  it("keeps every rapid room toggle synchronous with storage and the control", () => {
    route.pathname = "/play/ROOM42";
    const { start } = installTransitions();
    render(<SiteChrome initialSession={null} />);
    const button = screen.getByRole("button", { name: "Смени на светла тема" });
    act(() => {
      for (const theme of ["light", "dark", "light"]) {
        button.click();
        expect(document.documentElement.dataset.theme).toBe(theme);
        expect(localStorage.getItem("werewolf-theme")).toBe(theme);
      }
    });
    expectTheme("light");
    expect(start).not.toHaveBeenCalled();
  });

  it("does not let a skipped public callback or completion overwrite a later toggle", async () => {
    const { changes } = installTransitions();
    render(<SiteChrome initialSession={null} />);
    const button = screen.getByRole("button", { name: "Смени на светла тема" });
    act(() => { button.click(); button.click(); });
    expect(changes[0]!.skip).toHaveBeenCalledOnce();
    act(() => { changes[1]!.update(); changes[0]!.update(); });
    await act(async () => changes[0]!.finish());
    expectTheme("dark");
    expect(document.documentElement).toHaveAttribute("data-vt", "theme");
    await act(async () => changes[1]!.finish());
    expect(document.documentElement).not.toHaveAttribute("data-vt");
  });

  it("cancels a pending public transition on entry to a room and ignores its late callback", async () => {
    const { changes, start } = installTransitions();
    const { rerender } = render(<SiteChrome initialSession={null} />);
    act(() => screen.getByRole("button", { name: "Смени на светла тема" }).click());
    route.pathname = "/play/ROOM42";
    rerender(<SiteChrome initialSession={null} />);
    expect(changes[0]!.skip).toHaveBeenCalledOnce();
    expectTheme("light");
    act(() => screen.getByRole("button", { name: "Смени на тъмна тема" }).click());
    await act(async () => { changes[0]!.update(); changes[0]!.finish(); });
    expectTheme("dark");
    expect(start).toHaveBeenCalledOnce();
    expect(document.documentElement).not.toHaveAttribute("data-vt");
  });

  it("uses the same immediate room policy in the loaded drawer without losing focus", async () => {
    route.pathname = "/play/ROOM42";
    const { start } = installTransitions();
    const user = userEvent.setup();
    render(<SiteChrome initialSession={null} />);
    const opener = screen.getByRole("button", { name: "Отвори менюто" });
    await user.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Навигация" });
    const button = within(dialog).getByRole("button", { name: "Смени на светла тема" });
    await user.click(button);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("werewolf-theme")).toBe("light");
    expect(button).toHaveAccessibleName("Смени на тъмна тема");
    expect(button).toHaveFocus();
    expect(start).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(opener).toHaveFocus());
  });
});

describe("Senkite navigation", () => {
  beforeEach(() => {
    route.pathname = "/";
    sound.enabled = false;
    localStorage.clear();
    drawerRender.mockClear();
  });

  it("keeps the header sound icon in step when a room switches sound", async () => {
    route.pathname = "/play/ABC234";
    render(<SiteChrome initialSession={null} />);
    expect(screen.getAllByRole("button", { name: "Включи звука" }).length).toBeGreaterThan(0);
    sound.enabled = true;
    act(() => { window.dispatchEvent(new Event("werewolf-sound-change")); });
    expect(screen.getAllByRole("button", { name: "Изключи звука" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Включи звука" })).not.toBeInTheDocument();
  });

  it.each(["/lobby/ABC234", "/play/ABC234"])("does not let Firefox restore transient button states on %s", (pathname) => {
    route.pathname = pathname;
    const { container } = render(<SiteChrome initialSession={null} />);
    for (const button of container.querySelectorAll("header > button, .site-utility-cluster > button")) {
      expect(button).toHaveAttribute("autocomplete", "off");
    }
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

  it("exposes only the current pathname for route styling across cached navigations", () => {
    const { container, rerender } = render(<SiteChrome initialSession={null} />);
    const header = container.querySelector("header");
    for (const pathname of ["/werewolf/create", "/", "/mafia/roles", "/tutorial", "/", "/account", "/achievements", "/faq", "/"]) {
      route.pathname = pathname;
      rerender(<SiteChrome initialSession={null} />);
      expect(container.querySelector("header")).toBe(header);
      expect(header).toHaveAttribute("data-route", pathname);
    }
  });

  it("updates the room chrome marker when navigating away and back", () => {
    route.pathname = "/play/ROOM42";
    const { container, rerender } = render(<SiteChrome initialSession={null} />);
    const header = container.querySelector("header");
    expect(header).toHaveAttribute("data-room", "true");

    route.pathname = "/";
    rerender(<SiteChrome initialSession={null} />);
    expect(header).not.toHaveAttribute("data-room");

    route.pathname = "/play/ROOM42";
    rerender(<SiteChrome initialSession={null} />);
    expect(header).toHaveAttribute("data-room", "true");
  });
});
