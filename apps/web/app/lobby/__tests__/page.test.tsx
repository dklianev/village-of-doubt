import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LobbyPage from "@/app/lobby/page";

const mocks = vi.hoisted(() => ({
  lobbyCreateClient: vi.fn((_props: Record<string, unknown>) => null),
  requireSession: vi.fn(),
}));

vi.mock("@/components/lobby-create-client", () => ({ LobbyCreateClient: mocks.lobbyCreateClient }));
vi.mock("@/lib/require-session", () => ({ requireSession: mocks.requireSession }));

describe("legacy create lobby", () => {
  beforeEach(() => {
    mocks.lobbyCreateClient.mockClear();
    mocks.requireSession.mockReset();
    mocks.requireSession.mockResolvedValue({ user: { id: "synthetic-host" } });
  });

  it("asks for sign-in like /create and keeps the chosen mode in the return path", async () => {
    render(await LobbyPage({ searchParams: Promise.resolve({ mode: "mafia_free" }) }));

    expect(mocks.requireSession).toHaveBeenCalledWith("/lobby?mode=mafia_free");
    expect(mocks.lobbyCreateClient.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ initialMode: "mafia_free", family: "mafia" }));
  });

  it("does not render the create form when the session gate redirects", async () => {
    mocks.requireSession.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(LobbyPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.requireSession).toHaveBeenCalledWith("/lobby");
    expect(mocks.lobbyCreateClient).not.toHaveBeenCalled();
  });
});
