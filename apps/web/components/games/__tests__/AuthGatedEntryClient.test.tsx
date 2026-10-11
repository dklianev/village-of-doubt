import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGatedEntryClient, JOIN_PREVIEW_REFRESH_MS, JOIN_PREVIEW_TIMEOUT_MS, parseJoinRoomPreview } from "../auth-gated-entry-client";

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
    vi.useRealTimers();
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

    expect(screen.getByRole("heading", { level: 1, name: "Влез в селото" })).toBeInTheDocument();
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

    expect(screen.getByRole("heading", { level: 1, name: "Влез на масата" })).toBeInTheDocument();
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

    expect(screen.getByRole("heading", { level: 1, name: "Влез в селото" })).toBeInTheDocument();
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

    const joinButton = screen.getByRole("button", { name: "Влез в стаята" });
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
      roomPreview({ status: "finished" }),
      /приключила/,
    ],
  ])("disables joining when the room is %s", async (_label, responseBody, expectedMessage) => {
    fetchMock.mockResolvedValue(okResponse(responseBody));

    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);

    expect(await screen.findByText(expectedMessage)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeDisabled();
  });

  it("distinguishes a network failure and retries the preview", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(
        okResponse(roomPreview({
          code: "ABC234",
          status: "lobby",
          playerCount: 4,
          capacity: 10,
          family: "werewolves",
        })),
      );

    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);

    expect(await screen.findByText(/Не успяхме да проверим стаята/)).toBeInTheDocument();
    const joinButton = screen.getByRole("button", { name: "Влез в стаята" });
    expect(joinButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Провери отново" }));

    expect(await screen.findByText(/4 \/ 10 играчи/)).toBeInTheDocument();
    expect(joinButton).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("selects the permitted spectator entry while a room is in progress", async () => {
    fetchMock.mockResolvedValue(
      okResponse(roomPreview({
        code: "ABC234",
        status: "in_game",
        playerCount: 8,
        capacity: 10,
        family: "werewolves",
        canJoinAsPlayer: false,
      })),
    );

    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);

    expect(await screen.findByText(/Играта вече тече/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Наблюдател" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Играч" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Наблюдавай" })).toBeEnabled();
  });

  it("offers spectator entry when all player slots are occupied", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      okResponse(roomPreview({
        code: "ABC234",
        status: "lobby",
        playerCount: 10,
        capacity: 10,
        family: "werewolves",
        canJoinAsPlayer: false,
      })),
    );

    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);

    expect(await screen.findByText(/местата за игра са заети/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Наблюдател" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Играч" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Наблюдавай" }));

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/[?&]spectator=1(?:&|$)/));
  });
  it.each(["lobby", "in_game"] as const)("rejoins participants in a full %s room without demoting them", async (status) => {
    fetchMock.mockResolvedValue(okResponse(roomPreview({ status, playerCount: 10, viewerMembership: "participant", canSpectate: false })));
    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    expect(await screen.findByText("Връщаш се на мястото си.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Играч" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Наблюдател" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Влез в стаята" }));
    expect(push).toHaveBeenCalledWith("/play/ABC234?mode=werewolves_classic");
    expect(remember).toHaveBeenCalledWith("ABC234");
  });

  it.each(["lobby", "in_game"] as const)("blocks all entry when the server denies both choices in %s", async (status) => {
    fetchMock.mockResolvedValue(okResponse(roomPreview({ status, canJoinAsPlayer: false, canSpectate: false })));
    const { container } = render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    expect(await screen.findByText("В момента няма свободни места.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Играч" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Наблюдател" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeDisabled();
    fireEvent.submit(container.querySelector("form")!);
    expect(push).not.toHaveBeenCalled();
    expect(remember).not.toHaveBeenCalled();
  });

  it("does not promote a returning spectator unless they explicitly choose an available player place", async () => {
    fetchMock.mockResolvedValue(okResponse(roomPreview({ viewerMembership: "spectator" })));
    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    expect(await screen.findByText("Връщаш се като наблюдател.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Наблюдател" })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Наблюдавай" }));
    expect(push).toHaveBeenLastCalledWith("/play/ABC234?mode=werewolves_classic&spectator=1");
    await userEvent.click(screen.getByRole("radio", { name: "Играч" }));
    await userEvent.click(screen.getByRole("button", { name: "Влез в стаята" }));
    expect(push).toHaveBeenLastCalledWith("/play/ABC234?mode=werewolves_classic");
  });

  it("uses the validated server family and mode even when the entry route suggested another game", async () => {
    fetchMock.mockResolvedValue(okResponse(roomPreview({ mode: "mafia_sport", family: "mafia" })));
    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    expect(await screen.findByText("Спортна Мафия")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Влез в стаята" }));
    expect(push).toHaveBeenCalledWith("/play/ABC234?mode=mafia_sport");
  });

  it("allows player entry but never offers a forbidden spectator choice", async () => {
    fetchMock.mockResolvedValue(okResponse(roomPreview({ canSpectate: false })));
    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    await screen.findByText("4 / 10 играчи");
    await userEvent.click(screen.getByRole("radio", { name: "Наблюдател" }));
    expect(screen.getByRole("radio", { name: "Наблюдател" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeEnabled();
  });

  it("invalidates eligibility immediately on code edits and does not carry a spectator preference into another room", async () => {
    fetchMock.mockImplementation((url: string) => Promise.resolve(okResponse(roomPreview({ code: url.includes("DEF567") ? "DEF567" : "ABC234" }))));
    const { container } = render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    await screen.findByText("4 / 10 играчи");
    await userEvent.click(screen.getByRole("radio", { name: "Наблюдател" }));
    await userEvent.click(screen.getByRole("textbox", { name: "Символ 3 от 6" }));
    await userEvent.keyboard("{Backspace}");
    expect(screen.queryByText("4 / 10 играчи")).not.toBeInTheDocument();
    fireEvent.submit(container.querySelector("form")!);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Имаш 5");
    await userEvent.click(screen.getByRole("textbox", { name: "Символ 1 от 6" }));
    await userEvent.paste("DEF567");
    await screen.findByText("4 / 10 играчи");
    expect(screen.getByRole("radio", { name: "Играч" })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Влез в стаята" }));
    expect(push).toHaveBeenCalledWith("/play/DEF567?mode=werewolves_classic");
  });

  it("does not discard a valid preview when the same invitation is pasted again", async () => {
    fetchMock.mockResolvedValue(okResponse(roomPreview()));
    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    await screen.findByText("4 / 10 играчи");
    await userEvent.click(screen.getByRole("textbox", { name: "Символ 1 от 6" }));
    await userEvent.paste("ABC234");
    expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(["room", "missing", "rejection"])("ignores an aborted request's late %s after the code changes", async (result) => {
    const late = deferred<Response>();
    fetchMock.mockReturnValueOnce(late.promise).mockResolvedValue(okResponse(roomPreview({ code: "DEF567" })));
    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    const oldSignal = fetchMock.mock.calls[0]![1].signal as AbortSignal;
    await userEvent.click(screen.getByRole("textbox", { name: "Символ 1 от 6" }));
    await userEvent.paste("DEF567");
    await screen.findByText("4 / 10 играчи");
    expect(oldSignal.aborted).toBe(true);
    await act(async () => {
      if (result === "rejection") late.reject(new Error("private-request-detail"));
      else late.resolve(okResponse(result === "missing" ? { status: "missing" } : roomPreview({ canJoinAsPlayer: false })));
    });
    expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeEnabled();
    expect(screen.queryByText(/Не открихме|Не успяхме/)).not.toBeInTheDocument();
  });

  it("invalidates eligibility and refetches when the authenticated viewer changes", async () => {
    const next = deferred<Response>();
    fetchMock.mockResolvedValueOnce(okResponse(roomPreview({ viewerMembership: "participant", canSpectate: false }))).mockReturnValueOnce(next.promise);
    const { rerender, container } = render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    await screen.findByText("Връщаш се на мястото си.");
    useAuthSession.mockReturnValue({ data: { user: { id: "user-2" } }, isPending: false, isError: false, refresh: refreshSession });
    rerender(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeDisabled();
    fireEvent.submit(container.querySelector("form")!);
    expect(push).not.toHaveBeenCalled();
    await act(async () => next.resolve(okResponse(roomPreview({ canJoinAsPlayer: false }))));
    expect(screen.getByRole("button", { name: "Наблюдавай" })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(["fetch", "body"])("bounds a hanging %s, retries, and ignores late success without logging private errors", async (stage) => {
    vi.useFakeTimers();
    const late = deferred<unknown>();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockReturnValueOnce(stage === "fetch" ? late.promise : Promise.resolve({ ok: true, json: () => late.promise }));
    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_TIMEOUT_MS));
    expect(screen.getByText("Не успяхме да проверим стаята.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]![1].signal.aborted).toBe(true);
    fetchMock.mockResolvedValue(okResponse(roomPreview()));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Провери отново" })));
    expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeEnabled();
    await act(async () => late.resolve(stage === "fetch" ? okResponse({ status: "missing" }) : { status: "missing" }));
    expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeEnabled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("cleans up the pending request and its timer on unmount", () => {
    vi.useFakeTimers();
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    const signal = fetchMock.mock.calls[0]![1].signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  describe("live eligibility", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("refreshes a full room into an available player place without clearing the preview", async () => {
      const next = deferred<Response>();
      fetchMock.mockResolvedValueOnce(okResponse(roomPreview({ playerCount: 10, canJoinAsPlayer: false })))
        .mockReturnValueOnce(next.promise);
      render(<AuthGatedEntryClient initialCode="ABC234" />);
      await act(async () => vi.advanceTimersByTimeAsync(0));
      const player = screen.getByRole("radio", { name: "Играч" });
      expect(player).toBeDisabled();

      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_REFRESH_MS));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Местата за игра са заети.")).toBeInTheDocument();
      expect(screen.queryByText("Проверяваме стаята...")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Наблюдавай" })).toBeEnabled();
      expect(player).toBeDisabled();
      await act(async () => next.resolve(okResponse(roomPreview({ playerCount: 9 }))));
      expect(player).toBeEnabled();
      expect(player).toBeChecked();
      expect(screen.getByText("9 / 10 играчи")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Влез в стаята" }));
      expect(push).toHaveBeenCalledWith("/play/ABC234?mode=werewolves_classic");
      expect(fetchMock).toHaveBeenLastCalledWith("/api/rooms/ABC234/preview", expect.objectContaining({
        cache: "no-store", credentials: "same-origin", signal: expect.any(AbortSignal),
      }));
    });

    it("retains an explicit spectator choice across eligibility refreshes", async () => {
      fetchMock.mockResolvedValueOnce(okResponse(roomPreview()))
        .mockResolvedValueOnce(okResponse(roomPreview({ playerCount: 10, canJoinAsPlayer: false })))
        .mockResolvedValue(okResponse(roomPreview()));
      render(<AuthGatedEntryClient initialCode="ABC234" />);
      await act(async () => vi.advanceTimersByTimeAsync(0));
      fireEvent.click(screen.getByRole("radio", { name: "Наблюдател" }));
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_REFRESH_MS));
      expect(screen.getByRole("radio", { name: "Играч" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: "Наблюдател" })).toBeChecked();
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_REFRESH_MS));
      expect(screen.getByRole("radio", { name: "Играч" })).toBeEnabled();
      expect(screen.getByRole("radio", { name: "Наблюдател" })).toBeChecked();
    });

    it.each([
      roomPreview({ playerCount: 2, canJoinAsPlayer: false, canSpectate: false }),
      roomPreview({ status: "finished" }),
      { status: "missing" },
      roomPreview({ canJoinAsPlayer: "true" }),
    ])("honors refreshed server denial or invalid data instead of retaining permission: %j", async (next) => {
      fetchMock.mockResolvedValueOnce(okResponse(roomPreview())).mockResolvedValue(okResponse(next));
      const { container } = render(<AuthGatedEntryClient initialCode="ABC234" />);
      await act(async () => vi.advanceTimersByTimeAsync(0));
      expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeEnabled();
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_REFRESH_MS));
      expect(screen.getByRole("radio", { name: "Играч" })).toBeDisabled();
      expect(screen.getByRole("radio", { name: "Наблюдател" })).toBeDisabled();
      fireEvent.submit(container.querySelector("form")!);
      expect(push).not.toHaveBeenCalled();
    });

    it("coalesces focus and visibility rechecks without overlapping a slow refresh", async () => {
      const next = deferred<Response>();
      fetchMock.mockResolvedValueOnce(okResponse(roomPreview())).mockReturnValueOnce(next.promise)
        .mockResolvedValue(okResponse(roomPreview()));
      render(<AuthGatedEntryClient initialCode="ABC234" />);
      await act(async () => vi.advanceTimersByTimeAsync(0));
      for (let index = 0; index < 5; index++) {
        fireEvent(window, new Event("focus"));
        fireEvent(document, new Event("visibilitychange"));
      }
      expect(fetchMock).toHaveBeenCalledOnce();
      await act(async () => vi.advanceTimersByTimeAsync(1_000));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      fireEvent(window, new Event("focus"));
      fireEvent(window, new Event("online"));
      fireEvent(document, new Event("visibilitychange"));
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_TIMEOUT_MS - 1));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await act(async () => next.resolve(okResponse(roomPreview())));
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_REFRESH_MS - 1));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it.each(["hidden", "offline"] as const)("cancels refreshes while %s and resumes without accepting a late body", async (condition) => {
      const lateBody = deferred<unknown>();
      const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
      const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
      fetchMock.mockResolvedValueOnce(okResponse(roomPreview()))
        .mockResolvedValueOnce({ ok: true, json: () => lateBody.promise })
        .mockResolvedValue(okResponse(roomPreview({ canJoinAsPlayer: false, canSpectate: false })));
      const { unmount } = render(<AuthGatedEntryClient initialCode="ABC234" />);
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_REFRESH_MS));
      const signal = fetchMock.mock.calls[1]![1].signal as AbortSignal;
      if (condition === "hidden") visibility.mockReturnValue("hidden");
      else online.mockReturnValue(false);
      fireEvent(condition === "hidden" ? document : window, new Event(condition === "hidden" ? "visibilitychange" : "offline"));
      expect(signal.aborted).toBe(true);
      // Let Next Link's idle callbacks settle before counting preview timers.
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(vi.getTimerCount()).toBe(0);
      fireEvent(window, new Event("focus"));
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_REFRESH_MS * 3));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText("4 / 10 играчи")).toBeInTheDocument();

      visibility.mockReturnValue("visible");
      online.mockReturnValue(true);
      await act(async () => {
        fireEvent(condition === "hidden" ? document : window, new Event(condition === "hidden" ? "visibilitychange" : "online"));
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      await act(async () => lateBody.resolve(roomPreview()));
      expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeDisabled();
      unmount();
      fireEvent(window, new Event("focus"));
      fireEvent(window, new Event("online"));
      fireEvent(document, new Event("visibilitychange"));
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_REFRESH_MS * 3));
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(vi.getTimerCount()).toBe(0);
    });

    it.each(["hidden", "offline"] as const)("waits to fetch when mounted %s and removes listeners even before the first request", async (condition) => {
      const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue(condition === "hidden" ? "hidden" : "visible");
      const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(condition !== "offline");
      const { unmount } = render(<AuthGatedEntryClient initialCode="ABC234" />);
      fireEvent(window, new Event("focus"));
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_REFRESH_MS * 3));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      if (condition === "offline") expect(screen.getByRole("button", { name: "Провери отново" })).toBeInTheDocument();
      unmount();
      visibility.mockReturnValue("visible");
      online.mockReturnValue(true);
      fireEvent(window, new Event("online"));
      fireEvent(document, new Event("visibilitychange"));
      fireEvent(window, new Event("focus"));
      expect(fetchMock).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it.each(["code", "viewer"] as const)("aborts an in-flight poll when the %s changes and rejects its late result", async (change) => {
      const late = deferred<Response>();
      fetchMock.mockResolvedValueOnce(okResponse(roomPreview())).mockReturnValueOnce(late.promise)
        .mockResolvedValue(okResponse(roomPreview({ code: change === "code" ? "DEF567" : "ABC234", canJoinAsPlayer: false, canSpectate: false })));
      const { rerender } = render(<AuthGatedEntryClient initialCode="ABC234" />);
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_REFRESH_MS));
      const signal = fetchMock.mock.calls[1]![1].signal as AbortSignal;
      await act(async () => {
        if (change === "code") fireEvent.change(screen.getByRole("textbox", { name: "Символ 1 от 6" }), { target: { value: "DEF567" } });
        else {
          useAuthSession.mockReturnValue({ data: { user: { id: "user-2" } }, isPending: false, isError: false, refresh: refreshSession });
          rerender(<AuthGatedEntryClient initialCode="ABC234" />);
        }
      });
      expect(signal.aborted).toBe(true);
      await act(async () => late.resolve(okResponse(roomPreview())));
      expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeDisabled();
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_REFRESH_MS));
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeDisabled();
    });

    it("recovers automatically after timeouts and keeps the replacement request's deadline when an old request settles", async () => {
      const late = deferred<Response>();
      const next = deferred<Response>();
      fetchMock.mockReturnValueOnce(late.promise).mockReturnValueOnce(next.promise)
        .mockResolvedValue(okResponse(roomPreview()));
      render(<AuthGatedEntryClient initialCode="ABC234" />);
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_TIMEOUT_MS + JOIN_PREVIEW_REFRESH_MS));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0]![1].signal.aborted).toBe(true);
      await act(async () => late.resolve(okResponse(roomPreview())));
      expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeDisabled();
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_TIMEOUT_MS));
      expect(fetchMock.mock.calls[1]![1].signal.aborted).toBe(true);
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_REFRESH_MS));
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeEnabled();
      await act(async () => next.resolve(okResponse({ status: "missing" })));
      expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeEnabled();
    });

    it("removes the poll and listeners on sign-out", async () => {
      fetchMock.mockResolvedValue(okResponse(roomPreview()));
      const { rerender } = render(<AuthGatedEntryClient initialCode="ABC234" />);
      await act(async () => vi.advanceTimersByTimeAsync(0));
      useAuthSession.mockReturnValue({ data: null, isPending: false, isError: false, refresh: refreshSession });
      rerender(<AuthGatedEntryClient initialCode="ABC234" />);
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(vi.getTimerCount()).toBe(0);
      fireEvent(window, new Event("focus"));
      fireEvent(window, new Event("online"));
      fireEvent(document, new Event("visibilitychange"));
      await act(async () => vi.advanceTimersByTimeAsync(JOIN_PREVIEW_REFRESH_MS * 3));
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });

  it("does not reuse old eligibility when a code is cleared and then restored", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(roomPreview())).mockReturnValue(new Promise(() => {}));
    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    await screen.findByText("4 / 10 играчи");
    await userEvent.click(screen.getByRole("textbox", { name: "Символ 6 от 6" }));
    await userEvent.keyboard("{Backspace}4");
    expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeDisabled();
    expect(screen.getByText("Проверяваме стаята...")).toBeInTheDocument();
  });

  it("preserves an explicitly chosen spectator preference for room creation", async () => {
    fetchMock.mockResolvedValue(okResponse(roomPreview()));
    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    await screen.findByText("4 / 10 играчи");
    expect(screen.getByRole("link", { name: "Създай стая" })).toHaveAttribute("href", "/werewolf/create");
    await userEvent.click(screen.getByRole("radio", { name: "Наблюдател" }));
    expect(screen.getByRole("link", { name: "Създай стая" })).toHaveAttribute("href", "/werewolf/create?spectator=1");
  });

  it("offers one neutral code entry before a generic route knows the family", () => {
    render(<AuthGatedEntryClient />);
    expect(screen.getByRole("heading", { level: 1, name: "Влез с код" })).toBeInTheDocument();
    expect(screen.getByText("Сенките")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    expect(screen.getAllByRole("textbox")[0]?.closest("form")).toHaveAttribute("autocomplete", "off");
    expect(screen.getAllByRole("textbox")[0]).toHaveAttribute("autocomplete", "one-time-code");
    expect(screen.getByRole("link", { name: "Създай стая" })).toHaveAttribute("href", "/create");
    expect(screen.getByRole("link", { name: "Помощ" })).toHaveAttribute("href", "/faq");
    expect(screen.queryByRole("link", { name: "Правила" })).not.toBeInTheDocument();
  });

  it.each([
    { family: "mafia", mode: "mafia_sport", root: "/mafia", heading: "Влез на масата" },
    { family: "werewolves", mode: "werewolves_classic", root: "/werewolf", heading: "Влез в селото" },
  ])("adopts the authoritative $family scene, rules and mode on a generic entry", async ({ family, mode, root, heading }) => {
    fetchMock.mockResolvedValue(okResponse(roomPreview({ family, mode })));
    render(<AuthGatedEntryClient initialCode="ABC234" />);
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: heading }).closest("section")).toHaveAttribute("data-family", family);
    expect(screen.getByRole("link", { name: "Правила" })).toHaveAttribute("href", `${root}/rules`);
    expect(screen.getByRole("link", { name: "Създай стая" })).toHaveAttribute("href", `${root}/create`);
    await userEvent.click(screen.getByRole("button", { name: "Влез в стаята" }));
    expect(push).toHaveBeenCalledWith(`/play/ABC234?mode=${mode}`);
  });

  it("keeps the generic invitation through sign-out and returns to neutral copy", async () => {
    fetchMock.mockResolvedValue(okResponse(roomPreview({ family: "mafia", mode: "mafia_free" })));
    const { rerender } = render(<AuthGatedEntryClient initialCode="ABC234" />);
    await screen.findByRole("heading", { name: "Влез на масата" });
    useAuthSession.mockReturnValue({ data: null, isError: false, isPending: false, refresh: refreshSession });
    rerender(<AuthGatedEntryClient initialCode="ABC234" />);
    expect(screen.getByRole("link", { name: "Влез отново" })).toHaveAttribute("href", "/sign-in?redirect=%2Fjoin%3Fcode%3DABC234");
    expect(screen.getByText("Сенките")).toBeInTheDocument();
  });

  it.each([undefined, "yes", 1])("fails closed on invalid eligibility %j without exposing raw errors", async (canSpectate) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue(okResponse(roomPreview({ canSpectate, privateError: "secret" })));
    render(<AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode="ABC234" />);
    expect(await screen.findByText("Не успяхме да проверим стаята.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Влез в стаята" })).toBeDisabled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });
});

describe("Join preview parser", () => {
  it("allowlists eligibility and drops names, players and unknown fields", () => {
    expect(parseJoinRoomPreview({ ...roomPreview(), hostName: "Private name", players: [{ name: "Private name" }] }, "ABC234")).toEqual(roomPreview());
  });

  it.each([
    { code: "DEF567" }, { code: "abc234" }, { code: "ABC123" }, { status: "unknown" },
    { mode: "future_mode" }, { mode: "mafia_free" }, { family: "mafia" }, { family: null },
    { playerCount: -1 }, { playerCount: 0.5 }, { playerCount: Infinity }, { playerCount: NaN },
    { capacity: 0 }, { capacity: -1 }, { capacity: 1.5 }, { capacity: "10" },
    { viewerMembership: "host" }, { viewerMembership: undefined }, { roomVisibility: "secret" },
    { canJoinAsPlayer: "true" }, { canJoinAsPlayer: undefined }, { canSpectate: 1 }, { canSpectate: undefined },
  ])("rejects malformed or mismatched data %j", (override) => {
    expect(parseJoinRoomPreview(roomPreview(override), "ABC234")).toBeNull();
  });

  it.each([null, [], "room", 1, {}])("rejects %j", (value) => {
    expect(parseJoinRoomPreview(value, "ABC234")).toBeNull();
  });
});

function roomPreview(overrides: Record<string, unknown> = {}) {
  return {
    code: "ABC234", status: "lobby", playerCount: 4, capacity: 10,
    family: "werewolves", mode: "werewolves_classic", roomVisibility: "private",
    viewerMembership: "none", canJoinAsPlayer: true, canSpectate: true, ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}
