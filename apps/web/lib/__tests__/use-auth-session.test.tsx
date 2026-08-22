import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAuthSession, type AuthSessionView } from "../use-auth-session";

function SessionProbe({ initialSession }: { initialSession?: AuthSessionView | null }) {
  const { data, isPending } = useAuthSession(initialSession);
  return (
    <div>
      <span data-testid="session-state">{data?.user?.name ?? "guest"}</span>
      <span data-testid="pending-state">{isPending ? "pending" : "settled"}</span>
    </div>
  );
}

describe("useAuthSession", () => {
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

  it("keeps an explicitly resolved guest settled while refreshing in the background", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(null),
      } as Response),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SessionProbe initialSession={null} />);

    expect(screen.getByTestId("pending-state")).toHaveTextContent("settled");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/get-session", expect.any(Object)));
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
