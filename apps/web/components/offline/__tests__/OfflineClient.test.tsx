import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineClient } from "@/components/offline-client";

const browserWindow = window;
const reload = vi.fn();
const replace = vi.fn();
const stop = vi.fn();
const fetchMock = vi.fn<typeof fetch>();
let pathname = "/play/ABC234";

function pendingResponse() {
  let resolve!: (response: Response) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Response>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

async function check() {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Провери връзката" })); });
}

beforeEach(() => {
  vi.useFakeTimers();
  // Isolate tab storage without jsdom's asynchronous cross-window storage events.
  const storage = new Map<string, string>();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => storage.get(key) ?? null);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => { storage.set(key, value); });
  vi.spyOn(Storage.prototype, "length", "get").mockImplementation(() => storage.size);
  reload.mockReset();
  replace.mockReset();
  stop.mockReset();
  fetchMock.mockReset().mockRejectedValue(new TypeError("Network unavailable"));
  pathname = "/play/ABC234";
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", new Proxy(browserWindow, {
    get(target, key) {
      if (key === "stop") return stop;
      if (key === "location") return { pathname, search: "?mode=werewolf", hash: "#seat", reload, replace };
      return Reflect.get(target, key, target);
    },
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("OfflineClient", () => {
  it("exhausts automatic recovery across replacement fallback documents with healthy health checks", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    for (const delay of [5_000, 5_000, 10_000, 10_000, 15_000, 20_000, 30_000, 30_000]) {
      const view = render(<OfflineClient />);
      await advance(delay);
      view.unmount();
    }
    expect(reload).toHaveBeenCalledTimes(8);

    render(<OfflineClient />);
    await advance(180_000);
    fireEvent(window, new Event("online"));
    await advance(5_000);

    expect(reload).toHaveBeenCalledTimes(8);
    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "exhausted");
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("unlocks a cancelled navigation without starting another automatic navigation", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    render(<OfflineClient />);
    await check();
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "restoring");

    // A stopped navigation leaves this same document and its hook mounted.
    await advance(10_000);
    expect(screen.getByRole("button")).toBeEnabled();
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "exhausted");
    await advance(180_000);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();

    await check();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[1]!);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it.each(["get", "set", "silent"])("keeps manual recovery available with %s storage failure without automatic reload loops", async (failure) => {
    if (failure === "get") vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Denied"); });
    else vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      if (failure === "set") throw new Error("Quota");
    });
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    for (let document = 0; document < 3; document += 1) {
      const view = render(<OfflineClient />);
      await advance(180_000);
      expect(screen.getByRole("status")).toHaveAttribute("data-state", "exhausted");
      expect(screen.getByRole("button")).toBeEnabled();
      expect(reload).toHaveBeenCalledTimes(document);
      await check();
      expect(reload).toHaveBeenCalledTimes(document + 1);
      view.unmount();
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it("persists only a bounded counter and idle timestamp without refilling on manual attempts", async () => {
    sessionStorage.setItem("offline-recovery-attempts", JSON.stringify({ attempts: 7, updatedAt: Date.now() }));
    render(<OfflineClient />);
    await advance(30_000);
    await check();
    expect(sessionStorage.length).toBe(1);
    expect(JSON.parse(sessionStorage.getItem("offline-recovery-attempts")!)).toEqual({ attempts: 8, updatedAt: Date.now() });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "exhausted");
  });

  it("renews an idle episode only on a later mount, never from timers or online events", async () => {
    const view = render(<OfflineClient />);
    await advance(180_000);
    expect(fetchMock).toHaveBeenCalledTimes(8);
    await advance(5 * 60_000);
    fireEvent(window, new Event("online"));
    fireEvent(document, new Event("visibilitychange"));
    await advance(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "exhausted");

    view.unmount();
    render(<OfflineClient />);
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "waiting");
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await advance(5_000);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem("offline-recovery-attempts")!)).toEqual({ attempts: 1, updatedAt: Date.now() });
  });

  it("refreshes episode activity so repeated fallback mounts cannot use the original expiry", async () => {
    sessionStorage.setItem("offline-recovery-attempts", JSON.stringify({ attempts: 6, updatedAt: Date.now() - 270_000 }));
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const view = render(<OfflineClient />);
    await advance(30_000);
    expect(reload).toHaveBeenCalledTimes(1);
    view.unmount();
    render(<OfflineClient />);
    await advance(30_000);
    expect(reload).toHaveBeenCalledTimes(2);
    expect(JSON.parse(sessionStorage.getItem("offline-recovery-attempts")!).attempts).toBe(8);
  });

  it("does not enable competing checks when an offline event arrives during navigation", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    render(<OfflineClient />);
    await check();
    fireEvent(window, new Event("offline"));
    fireEvent(window, new Event("online"));
    fireEvent(document, new Event("visibilitychange"));
    await check();
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "restoring");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("unlocks a synchronously rejected navigation and cleans its watchdog on unmount", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    reload.mockImplementationOnce(() => { throw new Error("Navigation blocked"); });
    const view = render(<OfflineClient />);
    await check();
    expect(screen.getByRole("button")).toBeEnabled();
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "unavailable");
    view.unmount();
    await advance(180_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("offers exactly one check action without claiming that an online browser means recovery", () => {
    render(<OfflineClient />);

    expect(screen.getByRole("heading", { level: 1, name: "Няма връзка" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Провери връзката" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/game-art/system/offline-lantern-v1.webp");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "waiting");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it.each([404, 503])("does not reload on an HTTP %s health response", async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    render(<OfflineClient />);

    await check();

    expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.objectContaining({
      cache: "no-store", credentials: "omit", redirect: "error", signal: expect.any(AbortSignal),
    }));
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "unavailable");
    expect(reload).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it.each(["/offline", "/offline/"])("recovers a direct %s visit to safe home, ignoring its query", async (path) => {
    pathname = path;
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    render(<OfflineClient />);

    await check();
    fireEvent(window, new Event("online"));

    expect(replace).toHaveBeenCalledExactlyOnceWith("/");
    expect(reload).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "restoring");
    expect(screen.getByRole("button")).toBeDisabled();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("reloads a worker fallback document in place, preserving its original path, query and hash", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    render(<OfflineClient />);

    await advance(5_000);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/play/ABC234?mode=werewolf#seat");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("shares one in-flight check between clicks, online events and the retry timer", async () => {
    const pending = pendingResponse();
    fetchMock.mockReturnValue(pending.promise);
    render(<OfflineClient />);
    await advance(4_500);

    await check();
    fireEvent(window, new Event("online"));
    fireEvent.click(screen.getByRole("button"));
    await advance(500);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "checking");
    await act(async () => pending.resolve(new Response(null, { status: 503 })));
    expect(screen.getByRole("button")).toBeEnabled();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("aborts a hung check at two seconds and ignores its late success", async () => {
    const pending = pendingResponse();
    fetchMock.mockReturnValueOnce(pending.promise);
    render(<OfflineClient />);
    await check();
    const signal = fetchMock.mock.calls[0]![1]!.signal!;

    await advance(2_000);
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole("button")).toBeEnabled();
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "unavailable");
    await act(async () => pending.resolve(new Response(null, { status: 200 })));
    expect(reload).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await check();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(["resolve", "reject"] as const)("cancels fetch and all timers on unmount, even after late %s", async (settle) => {
    const pending = pendingResponse();
    fetchMock.mockReturnValue(pending.promise);
    const { unmount } = render(<OfflineClient />);
    await check();
    const signal = fetchMock.mock.calls[0]![1]!.signal!;

    unmount();
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => {
      if (settle === "resolve") pending.resolve(new Response(null, { status: 200 }));
      else pending.reject(new Error("Aborted"));
    });
    fireEvent(window, new Event("online"));
    fireEvent(document, new Event("visibilitychange"));
    await advance(60_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears an unstarted retry on unmount and does not duplicate the StrictMode loop", async () => {
    const { unmount } = render(<StrictMode><OfflineClient /></StrictMode>);
    expect(vi.getTimerCount()).toBe(1);
    await advance(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    unmount();
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops after eight automatic checks without a phantom ninth attempt and still allows manual recovery", async () => {
    render(<OfflineClient />);
    await advance(180_000);

    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "exhausted");
    expect(screen.getByRole("status")).toHaveTextContent("Автоматичните проверки приключиха.");
    expect(screen.queryByText(/опит 9/i)).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    await check();
    await advance(180_000);
    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "exhausted");
    expect(vi.getTimerCount()).toBe(0);

    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await check();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not let online events refill the exhausted automatic budget", async () => {
    render(<OfflineClient />);
    await advance(180_000);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await act(async () => { fireEvent(window, new Event("online")); });

    expect(reload).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses an actual manual health check even when navigator.onLine is stale", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    render(<OfflineClient />);
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "offline");

    await check();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not trust an in-flight response after the browser reports going offline", async () => {
    const pending = pendingResponse();
    fetchMock.mockReturnValue(pending.promise);
    render(<OfflineClient />);
    await check();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    fireEvent(window, new Event("offline"));

    await act(async () => pending.resolve(new Response(null, { status: 200 })));

    expect(fetchMock.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "offline");
    expect(reload).not.toHaveBeenCalled();
  });

  it("pauses the retry budget in hidden tabs and resumes without overlapping timers", async () => {
    render(<OfflineClient />);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    await advance(180_000);
    fireEvent(window, new Event("online"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    fireEvent(document, new Event("visibilitychange"));
    expect(vi.getTimerCount()).toBe(1);
    await advance(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
