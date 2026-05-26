import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAuthSession, type AuthSessionView } from "../use-auth-session";

function SessionProbe({ initialSession }: { initialSession?: AuthSessionView | null }) {
  const { data, isPending } = useAuthSession(initialSession ?? null);
  return (
    <div>
      <span data-testid="session-state">{data?.user?.name ?? "guest"}</span>
      <span data-testid="pending-state">{isPending ? "pending" : "settled"}</span>
    </div>
  );
}

describe("useAuthSession", () => {
  it("keeps the first guest render settled while refreshing in the background", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(null),
      } as Response),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SessionProbe />);

    expect(screen.getByTestId("session-state")).toHaveTextContent("guest");
    expect(screen.getByTestId("pending-state")).toHaveTextContent("settled");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/get-session", expect.any(Object)));
    expect(screen.getByTestId("pending-state")).toHaveTextContent("settled");
  });
});
