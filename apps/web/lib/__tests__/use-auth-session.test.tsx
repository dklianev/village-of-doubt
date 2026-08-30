import { act, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  invalidateAuthSessionBootstrapCache,
  SESSION_BOOTSTRAP_CACHE_TTL_MS,
  SESSION_BOOTSTRAP_REQUEST_TIMEOUT_MS,
  useAuthSession,
  type AuthSessionView,
} from "../use-auth-session";

function SessionProbe({ initialSession }: { initialSession?: AuthSessionView | null }) {
  const { data, isError, isPending } = useAuthSession(initialSession);
  return (
    <div>
      <span data-testid="session-state">{data?.user?.name ?? "guest"}</span>
      <span data-testid="pending-state">{isPending ? "pending" : "settled"}</span>
      <span data-testid="error-state">{isError ? "error" : "ok"}</span>
    </div>
  );
}

describe("useAuthSession", () => {
  beforeEach(() => {
    invalidateAuthSessionBootstrapCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    invalidateAuthSessionBootstrapCache();
  });

  it("keeps an unknown static-shell session pending until the client request settles", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(null),
      } as Response),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SessionProbe />);

    expect(screen.getByTestId("session-state")).toHaveTextContent("guest");
    expect(screen.getByTestId("pending-state")).toHaveTextContent("pending");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/get-session", expect.any(Object)));
    await waitFor(() => expect(screen.getByTestId("pending-state")).toHaveTextContent("settled"));
  });

  it("keeps a static-shell guest unknown until the client request confirms it", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(null),
      } as Response),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SessionProbe initialSession={null} />);

    expect(screen.getByTestId("pending-state")).toHaveTextContent("pending");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/get-session", expect.any(Object)));
    await waitFor(() => expect(screen.getByTestId("pending-state")).toHaveTextContent("settled"));
    expect(screen.getByTestId("error-state")).toHaveTextContent("ok");
  });

  it("reports a transient session request failure without confirming signed-out state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network request failed")));

    render(<SessionProbe initialSession={null} />);

    await waitFor(() => expect(screen.getByTestId("pending-state")).toHaveTextContent("settled"));
    expect(screen.getByTestId("session-state")).toHaveTextContent("guest");
    expect(screen.getByTestId("error-state")).toHaveTextContent("error");
  });

  it("keeps a known authenticated session when a focus refresh fails", async () => {
    let rejectResponse: ((reason?: unknown) => void) | undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((_resolve, reject) => {
      rejectResponse = reject;
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<SessionProbe initialSession={{ user: { id: "user-1", name: "Мила" } }} />);
    act(() => window.dispatchEvent(new Event("focus")));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const pendingDuringRefresh = screen.getByTestId("pending-state").textContent;
    await act(async () => {
      rejectResponse?.(new TypeError("Network request failed"));
    });
    await waitFor(() => expect(screen.getByTestId("error-state")).toHaveTextContent("error"));
    expect(screen.getByTestId("session-state")).toHaveTextContent("Мила");
    expect(pendingDuringRefresh).toBe("settled");
  });

  it("deduplicates simultaneous refreshes across hook instances", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <>
        <SessionProbe />
        <SessionProbe />
      </>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolveResponse?.({
      ok: true,
      json: () => Promise.resolve({ user: { id: "user-1", name: "Мила" } }),
    } as Response);

    await waitFor(() => expect(screen.getAllByTestId("session-state")[0]).toHaveTextContent("Мила"));
    expect(screen.getAllByTestId("session-state")[1]).toHaveTextContent("Мила");
  });

  it("reuses a very recent authenticated bootstrap without another request or flicker", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ user: { id: "user-1", name: "Мила" } }),
    } as Response));
    vi.stubGlobal("fetch", fetchMock);

    const first = render(<SessionProbe initialSession={null} />);
    await waitFor(() => expect(screen.getByTestId("session-state")).toHaveTextContent("Мила"));
    first.unmount();

    render(<SessionProbe initialSession={null} />);

    expect(screen.getByTestId("session-state")).toHaveTextContent("Мила");
    expect(screen.getByTestId("pending-state")).toHaveTextContent("settled");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the server snapshot stable while hydrating with a warm client cache", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ user: { id: "user-1", name: "Мила" } }),
    } as Response));
    vi.stubGlobal("fetch", fetchMock);

    const first = render(<SessionProbe initialSession={null} />);
    await waitFor(() => expect(screen.getByTestId("session-state")).toHaveTextContent("Мила"));
    first.unmount();

    const serverHtml = renderToString(<SessionProbe initialSession={null} />);
    expect(serverHtml).toContain("guest");
    expect(serverHtml).toContain("pending");

    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.append(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const root = hydrateRoot(container, <SessionProbe initialSession={null} />);

    await waitFor(() => expect(container).toHaveTextContent("Мила"));
    expect(container).toHaveTextContent("settled");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("Hydration failed");

    act(() => root.unmount());
    container.remove();
  });

  it("keeps a recently confirmed anonymous session settled", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(null),
    } as Response));
    vi.stubGlobal("fetch", fetchMock);

    const first = render(<SessionProbe initialSession={null} />);
    await waitFor(() => expect(screen.getByTestId("pending-state")).toHaveTextContent("settled"));
    first.unmount();

    render(<SessionProbe initialSession={null} />);

    expect(screen.getByTestId("session-state")).toHaveTextContent("guest");
    expect(screen.getByTestId("pending-state")).toHaveTextContent("settled");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("expires the bootstrap cache after its short TTL", async () => {
    let now = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let resolveSecond: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { id: "user-1", name: "Мила" } }),
      } as Response)
      .mockImplementationOnce(() => new Promise<Response>((resolve) => {
        resolveSecond = resolve;
      }));
    vi.stubGlobal("fetch", fetchMock);

    const first = render(<SessionProbe initialSession={null} />);
    await waitFor(() => expect(screen.getByTestId("session-state")).toHaveTextContent("Мила"));
    first.unmount();
    now += SESSION_BOOTSTRAP_CACHE_TTL_MS + 1;

    render(<SessionProbe initialSession={null} />);

    expect(screen.getByTestId("pending-state")).toHaveTextContent("pending");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () => {
      resolveSecond?.({ ok: true, json: () => Promise.resolve(null) } as Response);
    });
    await waitFor(() => expect(screen.getByTestId("pending-state")).toHaveTextContent("settled"));
  });

  it.each(["focus", "auth-session-change"])("invalidates the bootstrap cache on %s", async (eventName) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { id: "user-1", name: "Мила" } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const first = render(<SessionProbe initialSession={null} />);
    await waitFor(() => expect(screen.getByTestId("session-state")).toHaveTextContent("Мила"));
    first.unmount();
    render(<SessionProbe initialSession={null} />);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new Event(eventName)));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("session-state")).toHaveTextContent("guest"));
  });

  it("settles an unknown shell when the session request reaches its bound", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));

    render(<SessionProbe initialSession={null} />);
    expect(screen.getByTestId("pending-state")).toHaveTextContent("pending");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SESSION_BOOTSTRAP_REQUEST_TIMEOUT_MS);
    });

    expect(screen.getByTestId("session-state")).toHaveTextContent("guest");
    expect(screen.getByTestId("pending-state")).toHaveTextContent("settled");
  });

  it("lets an auth-change refresh supersede an older focus request", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolvers.push(resolve);
          }),
      ),
    );

    render(<SessionProbe initialSession={{ user: { id: "old", name: "Стара сесия" } }} />);

    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(resolvers).toHaveLength(1));
    act(() => window.dispatchEvent(new Event("auth-session-change")));
    await waitFor(() => expect(resolvers).toHaveLength(2));

    await act(async () => {
      resolvers[1]?.({
        ok: true,
        json: () => Promise.resolve({ user: { id: "new", name: "Нова сесия" } }),
      } as Response);
    });
    await waitFor(() => expect(screen.getByTestId("session-state")).toHaveTextContent("Нова сесия"));

    await act(async () => {
      resolvers[0]?.({
        ok: true,
        json: () => Promise.resolve({ user: { id: "old", name: "Стара сесия" } }),
      } as Response);
    });
    expect(screen.getByTestId("session-state")).toHaveTextContent("Нова сесия");
  });

  it("deduplicates a fresh auth-change refresh across shell consumers", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const initialSession = { user: { id: "old", name: "Стара сесия" } };

    render(
      <>
        <SessionProbe initialSession={initialSession} />
        <SessionProbe initialSession={initialSession} />
      </>,
    );
    act(() => window.dispatchEvent(new Event("auth-session-change")));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      resolveResponse?.({
        ok: true,
        json: () => Promise.resolve({ user: { id: "new", name: "Нова сесия" } }),
      } as Response);
    });
    await waitFor(() => {
      expect(screen.getAllByTestId("session-state")).toHaveLength(2);
      expect(screen.getAllByTestId("session-state")[0]).toHaveTextContent("Нова сесия");
      expect(screen.getAllByTestId("session-state")[1]).toHaveTextContent("Нова сесия");
    });
  });
});
