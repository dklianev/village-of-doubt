import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGatedEntryClient } from "../auth-gated-entry-client";

const { fetchMock, push, refreshSession, remember, useAuthSession } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  push: vi.fn(),
  refreshSession: vi.fn(),
  remember: vi.fn(),
  useAuthSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/use-auth-session", () => ({ useAuthSession }));

vi.mock("@/lib/use-recent-rooms", () => ({
  useRecentRooms: () => ({ rooms: [], remember }),
}));

describe("AuthGatedEntryClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    push.mockReset();
    refreshSession.mockReset();
    remember.mockReset();
    useAuthSession.mockReset();
    useAuthSession.mockReturnValue({
      data: { user: { id: "user-1", name: "Димитър" } },
      isError: false,
      isPending: false,
      refresh: refreshSession,
    });
    fetchMock.mockResolvedValue(okResponse({ status: "missing" }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the minimal server session on the first render", () => {
    const initialSession = { user: { id: "user-1", name: "Рада" } };
    useAuthSession.mockImplementation((session) => ({
      data: session,
      isError: false,
      isPending: false,
      refresh: refreshSession,
    }));

    render(
      <AuthGatedEntryClient
        family="werewolves"
        mode="werewolves_classic"
        initialCode="ABC234"
        initialSession={initialSession}
      />,
    );

    expect(screen.getByRole("heading", { name: "Добре дошъл в селото, Рада." })).toBeInTheDocument();
    expect(screen.getByText("Код на стаята")).toBeInTheDocument();
    expect(useAuthSession).toHaveBeenCalledWith(initialSession);
  });

  it("renders the Mafia entry from the minimal server session", () => {
    const initialSession = { user: { id: "user-1", name: "Рада" } };
    useAuthSession.mockImplementation((session) => ({
      data: session,
      isError: false,
      isPending: false,
      refresh: refreshSession,
    }));

    render(
      <AuthGatedEntryClient
        family="mafia"
        mode="mafia_free"
        initialCode="ABC234"
        initialSession={initialSession}
      />,
    );

    expect(screen.getByRole("heading", { name: "Добре дошъл в бара, Рада." })).toBeInTheDocument();
    expect(screen.getByText("Код на стаята")).toBeInTheDocument();
    expect(useAuthSession).toHaveBeenCalledWith(initialSession);
  });

  it("offers a retry when the client cannot confirm the session", async () => {
    const user = userEvent.setup();
    useAuthSession.mockReturnValue({
      data: null,
      isError: true,
      isPending: false,
      refresh: refreshSession,
    });

    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);

    expect(screen.getByRole("heading", { name: "Не успяхме да потвърдим сесията" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Провери сесията отново" }));
    expect(refreshSession).toHaveBeenCalledWith({ fresh: true });
  });

  it("keeps a known server session usable when a background refresh fails", () => {
    useAuthSession.mockReturnValue({
      data: { user: { id: "user-1", name: "Рада" } },
      isError: true,
      isPending: false,
      refresh: refreshSession,
    });

    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);

    expect(screen.getByRole("heading", { name: "Добре дошъл в селото, Рада." })).toBeInTheDocument();
    expect(screen.queryByText("Не успяхме да потвърдим сесията")).not.toBeInTheDocument();
  });

  it("offers the preserved sign-in redirect after a confirmed sign-out", () => {
    useAuthSession.mockReturnValue({
      data: null,
      isError: false,
      isPending: false,
      refresh: refreshSession,
    });

    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);

    expect(screen.getByRole("heading", { name: "Сесията ти е приключила" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Влез отново" })).toHaveAttribute(
      "href",
      "/sign-in?redirect=%2Fwerewolf%2Fjoin%2FABC234",
    );
  });

  it.each([
    { family: "werewolves", mode: "werewolves_classic", root: "/werewolf" },
    { family: "mafia", mode: "mafia_free", root: "/mafia" },
  ] as const)("preserves the normalized code typed in the $family form after sign-out", async ({ family, mode, root }) => {
    const user = userEvent.setup();
    const { rerender } = render(<AuthGatedEntryClient family={family} mode={mode} />);

    await user.type(screen.getByRole("textbox", { name: "Символ 1 от 6" }), "mn2k7a");
    expect(screen.getAllByRole("textbox").map((slot) => (slot as HTMLInputElement).value).join("")).toBe("MN2K7A");

    useAuthSession.mockReturnValue({ data: null, isError: false, isPending: false, refresh: refreshSession });
    rerender(<AuthGatedEntryClient family={family} mode={mode} />);

    expect(screen.getByRole("link", { name: "Влез отново" })).toHaveAttribute(
      "href",
      `/sign-in?redirect=${encodeURIComponent(`${root}/join/MN2K7A`)}`,
    );
  });

  it.each([
    { name: "a valid edited code replaces the URL invite", initialCode: "ABC234", edit: "mn2-k7a", expected: "/werewolf/join/MN2K7A" },
    { name: "an empty edit retains the URL invite", initialCode: "ABC234", edit: "", expected: "/werewolf/join/ABC234" },
    { name: "an incomplete edit retains the valid URL invite", initialCode: "ABC234", edit: "abc1", expected: "/werewolf/join/ABC234" },
    { name: "an incomplete typed code is not a redirect", initialCode: "", edit: "abc1", expected: "/werewolf/join" },
    { name: "a malformed URL invite is not a redirect", initialCode: "ABC123", edit: null, expected: "/werewolf/join" },
    { name: "invalid URL characters are not a redirect", initialCode: "../?a=1", edit: null, expected: "/werewolf/join" },
  ])("reauthentication: $name", async ({ initialCode, edit, expected }) => {
    const user = userEvent.setup();
    const { rerender } = render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode={initialCode} />);

    if (edit === "") {
      for (const slot of screen.getAllByRole("textbox").reverse()) {
        await user.clear(slot);
      }
      expect(screen.getAllByRole("textbox").every((slot) => (slot as HTMLInputElement).value === "")).toBe(true);
    } else if (edit !== null) {
      await user.click(screen.getByRole("textbox", { name: "Символ 1 от 6" }));
      await user.paste(edit);
    }

    useAuthSession.mockReturnValue({ data: null, isError: false, isPending: false, refresh: refreshSession });
    rerender(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode={initialCode} />);

    expect(screen.getByRole("link", { name: "Влез отново" })).toHaveAttribute(
      "href",
      `/sign-in?redirect=${encodeURIComponent(expected)}`,
    );
  });

  it("focuses and describes the first invalid room-code slot after submit", async () => {
    const user = userEvent.setup();
    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" />);

    const joinButton = screen.getByRole("button", { name: "Влизам в селото" });
    expect(joinButton).toBeEnabled();
    await user.click(joinButton);

    const error = screen.getByRole("alert");
    const firstSlot = screen.getByRole("textbox", { name: "Символ 1 от 6" });
    expect(error).toHaveTextContent("Въведи кода на стаята.");
    expect(firstSlot).toHaveFocus();
    expect(firstSlot).toHaveAttribute("aria-invalid", "true");
    expect(firstSlot).toHaveAttribute("aria-describedby", error.id);
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
