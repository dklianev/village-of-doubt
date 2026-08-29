import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGatedEntryClient } from "../auth-gated-entry-client";

const { fetchMock, push, remember } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  push: vi.fn(),
  remember: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { name: "Димитър" } },
      isPending: false,
    }),
  },
}));

vi.mock("@/lib/use-recent-rooms", () => ({
  useRecentRooms: () => ({ rooms: [], remember }),
}));

describe("AuthGatedEntryClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    remember.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["missing", { status: "missing" }, /Не открихме стая ABC234/],
    [
      "finished",
      { code: "ABC234", status: "finished", playerCount: 8, capacity: 10, family: "werewolves" },
      /приключила/,
    ],
  ])("disables joining when the room is %s", async (_label, responseBody, expectedMessage) => {
    fetchMock.mockResolvedValue(okResponse(responseBody));

    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);

    expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Влизам в селото" })).toBeDisabled();
  });

  it("distinguishes a network failure and retries the preview", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(
        okResponse({
          code: "ABC234",
          status: "lobby",
          playerCount: 4,
          capacity: 10,
          family: "werewolves",
        }),
      );

    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);

    expect(await screen.findByText(/Не успяхме да проверим стаята/)).toBeInTheDocument();
    const joinButton = screen.getByRole("button", { name: "Влизам в селото" });
    expect(joinButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Провери отново" }));

    expect(await screen.findByText(/4\/10 играчи в лобито/)).toBeInTheDocument();
    expect(joinButton).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("forces spectator mode while a room is in progress", async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        code: "ABC234",
        status: "in_game",
        playerCount: 8,
        capacity: 10,
        family: "werewolves",
      }),
    );

    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);

    expect(await screen.findByText(/играта вече тече/)).toBeInTheDocument();
    const spectatorButton = screen.getByRole("button", { name: "Гледам отстрани, без роля" });
    expect(spectatorButton).toBeDisabled();
    expect(spectatorButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Влизам в селото" })).toBeEnabled();
  });

  it("offers spectator entry when all player slots are occupied", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      okResponse({
        code: "ABC234",
        status: "lobby",
        playerCount: 10,
        capacity: 10,
        family: "werewolves",
      }),
    );

    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);

    expect(await screen.findByText(/местата за игра са заети/i)).toBeInTheDocument();
    const spectatorButton = screen.getByRole("button", { name: "Гледам отстрани, без роля" });
    expect(spectatorButton).toBeDisabled();
    expect(spectatorButton).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Влизам в селото" }));

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/[?&]spectator=1(?:&|$)/));
  });
});

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}
