import { StrictMode, useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

let useLobbyNavigationGuard: typeof import("../use-lobby-navigation-guard").useLobbyNavigationGuard;
let initializeLobbyNavigationGuard: typeof import("../use-lobby-navigation-guard").initializeLobbyNavigationGuard;
const nativePush = window.history.pushState;
const nativeReplace = window.history.replaceState;
let windowListeners: MockInstance<Window["addEventListener"]>;

function Lobby({ active = true, host = true, onNavigate = vi.fn(), onLeave = vi.fn() }) {
  useLobbyNavigationGuard({ active, host });
  useEffect(() => onLeave, [onLeave]);
  return <nav onClick={(event) => { event.preventDefault(); onNavigate(); }}>
    <a href="/faq"><span>Помощ</span></a>
    <a href="/faq" target="_blank" rel="noopener noreferrer">Помощ в нов раздел</a>
    <a href="#rules">Правила</a>
    <a href="/faq" download>Download</a>
    <a href="mailto:help@example.test">Email</a>
  </nav>;
}

describe("useLobbyNavigationGuard", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ useLobbyNavigationGuard, initializeLobbyNavigationGuard } = await import("../use-lobby-navigation-guard"));
    window.history.pushState({}, "", "/play/ABCD");
    windowListeners = vi.spyOn(window, "addEventListener");
    vi.spyOn(window, "confirm").mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    for (const [type, listener, options] of windowListeners.mock.calls) {
      window.removeEventListener(type, listener, options);
    }
    window.history.pushState = nativePush;
    window.history.replaceState = nativeReplace;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("cancels same-tab help navigation and explains host transfer", () => {
    const onNavigate = vi.fn();
    render(<Lobby onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("Помощ"));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("домакин"));
  });

  it("allows an explicitly confirmed leave", () => {
    vi.mocked(window.confirm).mockReturnValue(true);
    const onNavigate = vi.fn();
    render(<Lobby onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("Помощ"));
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("does not intercept new tabs, modifier clicks or in-page help", () => {
    render(<Lobby />);
    fireEvent.click(screen.getByText("Помощ в нов раздел"));
    fireEvent.click(screen.getByText("Помощ"), { ctrlKey: true });
    fireEvent.click(screen.getByText("Помощ"), { metaKey: true });
    fireEvent.click(screen.getByText("Помощ"), { shiftKey: true });
    fireEvent.click(screen.getByText("Помощ"), { altKey: true });
    fireEvent.click(screen.getByText("Помощ"), { button: 1 });
    fireEvent.click(screen.getByText("Правила"));
    fireEvent.click(screen.getByText("Download"));
    fireEvent.click(screen.getByText("Email"));
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("warns on document exit only while in a joined lobby and cleans up", () => {
    const { rerender, unmount } = render(<Lobby />);
    const leaving = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
    rerender(<Lobby active={false} />);
    fireEvent.click(screen.getByText("Помощ"));
    expect(window.confirm).not.toHaveBeenCalled();
    unmount();
    const after = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it("does not claim that a non-host owns the room", () => {
    render(<Lobby host={false} />);
    fireEvent.click(screen.getByText("Помощ"));
    expect(window.confirm).toHaveBeenCalledWith(expect.not.stringContaining("домакин"));
  });

  it("suppresses only the immediate document confirmation after an accepted link", () => {
    vi.useFakeTimers();
    vi.mocked(window.confirm).mockReturnValue(true);
    render(<Lobby />);
    fireEvent.click(screen.getByText("Помощ"));
    const immediate = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(immediate);
    expect(immediate.defaultPrevented).toBe(false);
    act(() => vi.runAllTimers());
    const later = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(true);
  });

  for (const navigates of [true, false]) {
    it(`restores the first unload warning after an accepted ${navigates ? "same-document SPA navigation" : "link cancelled by its handler"}`, () => {
      vi.useFakeTimers();
      vi.mocked(window.confirm).mockReturnValue(true);
      const onNavigate = vi.fn(() => {
        if (navigates) window.history.pushState({}, "", "/play/ABCD?panel=help");
      });
      render(<Lobby onNavigate={onNavigate} />);
      fireEvent.click(screen.getByText("Помощ"));
      expect(window.confirm).toHaveBeenCalledOnce();
      expect(onNavigate).toHaveBeenCalledOnce();
      // No unload consumes the approval when an SPA handles or cancels a link.
      act(() => vi.runAllTimers());
      for (let attempt = 0; attempt < 2; attempt++) {
        const later = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(later);
        expect(later.defaultPrevented).toBe(true);
      }
    });
  }

  it("leaves an already prevented link alone", () => {
    render(<Lobby />);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    event.preventDefault();
    screen.getByText("Помощ").dispatchEvent(event);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("preserves router state, caller data, URLs and history length across StrictMode and remounts", () => {
    const routerState = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: ["lobby"], renderedSearch: "?mode=1" }, custom: "untouched" };
    window.history.replaceState(routerState, "", "/play/ABCD?mode=1#rules");
    const length = window.history.length;
    const first = render(<StrictMode><Lobby /></StrictMode>);
    first.rerender(<StrictMode><Lobby host={false} /></StrictMode>);
    first.unmount();
    render(<Lobby />);
    expect(window.history.length).toBe(length);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/play/ABCD?mode=1#rules");
    expect(window.history.state).toMatchObject(routerState);
    expect(Object.keys(routerState)).toHaveLength(3);
    const replacement = { ...routerState, custom: "new" };
    window.history.replaceState(replacement, "", "?mode=2#seats");
    expect(window.history.state).toMatchObject(replacement);
    expect(window.location.search + window.location.hash).toBe("?mode=2#seats");
    expect(window.history.length).toBe(length);
    expect(Object.keys(replacement)).toHaveLength(3);
  });

  for (const delta of [-1, 1, -2, 2]) {
    it(`cancels then accepts history.go(${delta}) before an earlier router listener can unmount the lobby`, async () => {
      // Keep recording while outside the lobby, as on real repeat visits.
      const inactive = render(<Lobby active={false} />);
      for (const url of ["/faq?from=guard#details", "/", "/play/ABCD?players=8#rules", "/join", "/werewolf"]) {
        window.history.pushState({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { url } }, "", url);
      }
      window.history.go(-2);
      await waitFor(() => expect(window.location.pathname).toBe("/play/ABCD"));
      inactive.unmount();
      const onLeave = vi.fn();
      const router = vi.fn(() => lobby.unmount());
      window.addEventListener("popstate", router);
      const lobby = render(<Lobby onLeave={onLeave} />);
      const state = window.history.state;
      const href = window.location.href;
      const length = window.history.length;
      window.history.go(delta);
      await waitFor(() => expect(window.confirm).toHaveBeenCalledOnce());
      await waitFor(() => expect(window.location.href).toBe(href));
      expect(window.history.state).toEqual(state);
      expect(router).not.toHaveBeenCalled();
      expect(onLeave).not.toHaveBeenCalled();
      expect(window.history.length).toBe(length);

      vi.mocked(window.confirm).mockReturnValue(true);
      window.history.go(delta);
      await waitFor(() => expect(router).toHaveBeenCalledOnce());
      expect(window.confirm).toHaveBeenCalledTimes(2);
      expect(onLeave).toHaveBeenCalledOnce();
      expect(window.location.pathname).toBe(delta === -2 ? "/faq" : delta === -1 ? "/" : delta === 1 ? "/join" : "/werewolf");
      expect(window.history.length).toBe(length);
      expect(window.history.state.__PRIVATE_NEXTJS_INTERNALS_TREE.url).toContain(window.location.pathname);
    });
  }

  it("guards the first home-to-lobby Back after shell initialization without an earlier lobby mount", async () => {
    window.history.replaceState({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { route: "home" } }, "", "/");
    initializeLobbyNavigationGuard();
    initializeLobbyNavigationGuard();
    const home = window.history.state;
    window.history.pushState({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { route: "lobby" } }, "", "/play/ABCD");
    const onLeave = vi.fn();
    const router = vi.fn(() => lobby.unmount());
    window.addEventListener("popstate", router);
    const lobby = render(<Lobby onLeave={onLeave} />);
    const state = window.history.state;
    const length = window.history.length;
    window.history.back();
    await waitFor(() => expect(window.confirm).toHaveBeenCalledOnce());
    await waitFor(() => expect(window.location.pathname).toBe("/play/ABCD"));
    expect(window.history.state).toEqual(state);
    expect(router).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockReturnValue(true);
    window.history.back();
    await waitFor(() => expect(router).toHaveBeenCalledOnce());
    expect(onLeave).toHaveBeenCalledOnce();
    expect(window.history.state).toEqual(home);
    expect(window.history.length).toBe(length);
  });

  for (const delta of [-1, 1]) {
    it(`does not trap an untagged ${delta === 1 ? "Forward" : "Back"} entry existing at first mount`, async () => {
      const previous = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { route: "previous" } };
      const forward = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { route: "forward" } };
      window.history.pushState(previous, "", "/previous");
      window.history.pushState({ __NA: true }, "", "/play/ABCD");
      window.history.pushState(forward, "", "/forward?original=1#details");
      window.history.back();
      await waitFor(() => expect(window.location.pathname).toBe("/play/ABCD"));
      const router = vi.fn();
      window.addEventListener("popstate", router);
      render(<Lobby />);
      const length = window.history.length;
      window.history.go(delta);
      await waitFor(() => expect(router).toHaveBeenCalledOnce());
      // No false promise of cancellation when the legacy API has no position.
      expect(window.confirm).not.toHaveBeenCalled();
      expect(window.history.state).toEqual(delta === 1 ? forward : previous);
      window.history.go(-delta);
      await waitFor(() => expect(window.location.pathname).toBe("/play/ABCD"));
      expect(router).toHaveBeenCalledTimes(2);
      expect(window.history.length).toBe(length);
      expect(window.confirm).not.toHaveBeenCalled();
    });
  }

  it("coalesces rapid repeated Back while restoring without a second prompt or router unmount", async () => {
    const lobby = render(<Lobby active={false} />);
    for (const url of ["/faq", "/join", "/", "/play/ABCD"]) window.history.pushState({ __NA: true }, "", url);
    const router = vi.fn();
    window.addEventListener("popstate", router);
    lobby.rerender(<Lobby />);
    const state = window.history.state;
    const length = window.history.length;
    const queueMoreBack = () => {
      window.history.back();
      window.history.back();
    };
    // Queue additional real traversals before the recovery timer runs.
    const confirmation = vi.mocked(window.confirm).mockImplementation(() => {
      window.setTimeout(queueMoreBack, 0);
      return false;
    });
    window.history.back();
    await waitFor(() => expect(confirmation).toHaveBeenCalledOnce());
    await waitFor(() => expect(window.location.pathname).toBe("/play/ABCD"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(window.location.pathname).toBe("/play/ABCD");
    expect(window.history.state).toEqual(state);
    expect(window.history.length).toBe(length);
    expect(router).not.toHaveBeenCalled();
    expect(confirmation).toHaveBeenCalledOnce();
  });

  it("does not guard fragment history and restores the exact fragment after a cancelled exit", async () => {
    render(<Lobby />);
    await new Promise<void>((resolve) => {
      window.addEventListener("hashchange", () => resolve(), { once: true });
      window.location.hash = "rules";
    });
    const fragmentState = window.history.state;
    window.history.pushState({}, "", "/faq#help");
    // The old lobby effect may not have cleaned up yet after a route commit.
    // Returning to it is never a departure, even with that callback still set.
    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe("#rules"));
    vi.mocked(window.confirm).mockClear().mockReturnValue(false);
    window.history.forward();
    await waitFor(() => expect(window.confirm).toHaveBeenCalledOnce());
    await waitFor(() => expect(window.location.hash).toBe("#rules"));
    expect(window.history.state).toEqual(fragmentState);
    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe(""));
    expect(window.confirm).toHaveBeenCalledOnce();
  });

  for (const cancelable of [true, false]) {
    it(`guards Navigation API traversals with cancelable=${cancelable} without changing router state`, async () => {
      const navigation = Object.assign(new EventTarget(), { currentEntry: { index: 2 } });
      vi.stubGlobal("navigation", navigation);
      const originalState = window.history.state;
      const router = vi.fn();
      initializeLobbyNavigationGuard();
      window.addEventListener("popstate", router);
      render(<Lobby />);
      const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
      const traverse = () => {
        const event = Object.assign(new Event("navigate", { cancelable }), {
          navigationType: "traverse", destination: { index: 1, url: "http://localhost:3000/faq", sameDocument: true },
        });
        navigation.dispatchEvent(event);
        if (!event.defaultPrevented) {
          navigation.currentEntry = { index: 1 };
          nativeReplace.call(window.history, { __NA: true }, "", "/faq");
          window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
        }
        return event;
      };
      const denied = traverse();
      expect(window.confirm).toHaveBeenCalledOnce();
      expect(router).not.toHaveBeenCalled();
      expect(denied.defaultPrevented).toBe(false);
      await waitFor(() => expect(go).toHaveBeenCalledWith(1));
      navigation.currentEntry = { index: 2 };
      nativeReplace.call(window.history, originalState, "", "/play/ABCD");
      window.dispatchEvent(new PopStateEvent("popstate", { state: originalState }));
      expect(window.history.state).toEqual(originalState);
      expect(router).not.toHaveBeenCalled();
      vi.mocked(window.confirm).mockReturnValue(true);
      traverse();
      expect(window.confirm).toHaveBeenCalledTimes(2);
      expect(router).toHaveBeenCalledOnce();
      expect(window.location.pathname).toBe("/faq");
    });
  }
});
