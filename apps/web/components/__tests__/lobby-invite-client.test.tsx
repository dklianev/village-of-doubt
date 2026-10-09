import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LobbyInviteClient } from "../lobby-invite-client";
import { copyTextToClipboard } from "@/lib/clipboard";

vi.mock("@/lib/toast", () => ({ useToast: () => vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: vi.fn().mockResolvedValue(undefined) }));

const props = {
  code: "ABC234", family: "mafia" as const, modeLabel: "Мафия",
  playHref: "/play/ABC234?mode=mafia_free", spectatorHref: "/play/ABC234?mode=mafia_free&spectator=1",
  hostName: "Име на госта", routeLabel: "досие към задната стая",
};
const room = {
  code: "ABC234", status: "lobby", family: "mafia", playerCount: 1, capacity: 8, hostName: "Анна",
  mode: "mafia_free", roomVisibility: "private", viewerMembership: "none",
  canJoinAsPlayer: true, canSpectate: true,
  players: [{ displayName: "Анна", connected: true, ready: false, host: true }],
};
const fetchPreview = vi.fn();
const shareLabel = "Сподели поканата";

function respond(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function expectNoRoomActions() {
  expect(screen.queryByRole("link", { name: "Към играта" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Наблюдавай" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Върни се в играта|Продължи да наблюдаваш/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Сподели|Копирай/ })).not.toBeInTheDocument();
  expect(screen.queryByText("Име на госта")).not.toBeInTheDocument();
  expect(screen.queryByText(/Поканата остава активна/)).not.toBeInTheDocument();
}

describe("room invitation preview", () => {
  beforeEach(() => {
    fetchPreview.mockReset();
    vi.mocked(copyTextToClipboard).mockReset().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchPreview);
    fetchPreview.mockResolvedValue(respond(room));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("copies canonical invitation links without query parameters", async () => {
    window.history.replaceState(null, "", "/lobby/ABC234?visualAuth=1&mode=werewolves_classic&redirect=private#fragment");
    render(<LobbyInviteClient {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Копирай кода" }));
    expect(copyTextToClipboard).toHaveBeenLastCalledWith("ABC234");
    fireEvent.click(screen.getByRole("button", { name: "Копирай линка" }));
    expect(copyTextToClipboard).toHaveBeenLastCalledWith(`${window.location.origin}/lobby/ABC234`);
    window.history.replaceState(null, "", "/");
  });

  it("uses canonical links with native sharing and accepts cancellation without a clipboard fallback", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("Canceled", "AbortError"));
    vi.stubGlobal("navigator", { share });
    vi.mocked(copyTextToClipboard).mockClear();
    render(<LobbyInviteClient {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: shareLabel }));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: `${window.location.origin}/lobby/ABC234` })));
    expect(copyTextToClipboard).not.toHaveBeenCalled();
  });

  it.each(["unsupported", "rejected"])("copies the canonical invitation when native sharing is %s", async (availability) => {
    const share = availability === "rejected" ? vi.fn().mockRejectedValue(new Error("Share unavailable")) : undefined;
    vi.stubGlobal("navigator", { share });
    window.history.replaceState(null, "", "/lobby/ABC234?mode=werewolves_classic&visualAuth=1#fragment");
    render(<LobbyInviteClient {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: shareLabel }));
    await waitFor(() => expect(copyTextToClipboard).toHaveBeenCalledWith(`${window.location.origin}/lobby/ABC234`));
  });

  it("shows only a pending preview until the server supplies public identities and eligibility", async () => {
    let finishPreview!: (response: Response) => void;
    fetchPreview.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishPreview = resolve; }));
    render(<LobbyInviteClient {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent("Проверяваме стаята");
    expectNoRoomActions();
    expect(screen.queryByRole("region", { name: "Първи играчи в стаята" })).not.toBeInTheDocument();
    expect(fetchPreview).toHaveBeenCalledWith("/api/rooms/ABC234/preview", expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
    await act(async () => finishPreview(respond(room)));
    expect(await screen.findByRole("link", { name: "Към играта" })).toHaveAttribute("href", props.playHref);
  });

  it.each(["mafia", "werewolves"] as const)("places the public %s monograms before entry and keeps sharing in the footer", async (family) => {
    const players = [
      { displayName: "Анна", connected: true, ready: true, host: true },
      { displayName: "Борис", connected: true, ready: true, host: false },
      { displayName: "Рада", connected: false, ready: true, host: false },
      { displayName: "Четвърти гост", connected: true, ready: false, host: false },
      { displayName: "Пети гост", connected: true, ready: false, host: false },
    ];
    fetchPreview.mockResolvedValue(respond({ ...room, family, mode: family === "mafia" ? "mafia_free" : "werewolves_classic", players, playerCount: players.length }));
    const { container } = render(<LobbyInviteClient {...props} />);
    const roster = await screen.findByRole("region", { name: "Първи играчи в стаята" });
    expect(container.querySelector(".lobby-invite-details")).toContainElement(roster);
    expect(container.querySelector(".lobby-invite-paper")).not.toBeInTheDocument();
    expect([...roster.querySelectorAll(".lobby-player-chip strong")].map((node) => node.textContent)).toEqual(["А", "Б", "Р"]);
    expect(within(roster).getByText("домакин")).toBeInTheDocument();
    expect(within(roster).getByText("готов")).toBeInTheDocument();
    expect(within(roster).getByText("извън линия")).toBeInTheDocument();
    expect(within(roster).getByText("И още 2 в стаята.")).toBeInTheDocument();
    expect(screen.queryByText("Четвърти гост")).not.toBeInTheDocument();
    expect(screen.queryByText("Пети гост")).not.toBeInTheDocument();
    const actions = screen.getByRole("navigation", { name: "Действия за стаята" });
    const footer = container.querySelector(".lobby-invite-footer")!;
    expect(roster.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(actions.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(footer).toContainElement(screen.getByRole("button", { name: shareLabel }));
    expect(footer).toContainElement(screen.getByRole("button", { name: "Копирай линка" }));
    expect(footer).toContainElement(screen.getByRole("link", { name: family === "mafia" ? "Въведи друг код за Мафия" : "Въведи друг код за Върколак" }));
    expect(screen.getByRole("status")).toHaveTextContent("Домакин: Анна");
  });

  it("does not request a preview for malformed codes", async () => {
    render(<LobbyInviteClient code="ABC/23" />);
    expect(await screen.findByRole("status")).toHaveTextContent("Тази стая вече не е достъпна");
    expect(fetchPreview).not.toHaveBeenCalled();
    expectNoRoomActions();
  });

  it("shows disconnected players as offline even when their previous ready flag is set", async () => {
    fetchPreview.mockResolvedValue(respond({ ...room, players: [{ displayName: "Анна", host: true, ready: true, connected: false }] }));
    render(<LobbyInviteClient {...props} />);
    expect(await screen.findByText("извън линия")).toBeInTheDocument();
  });

  it("shows a known missing room without invented activity or join/share actions", async () => {
    fetchPreview.mockResolvedValue(respond({ status: "missing" }));
    render(<LobbyInviteClient {...props} />);
    expect(await screen.findByRole("status")).toHaveTextContent("Тази стая вече не е достъпна");
    expect(screen.queryByText("Проверяваме стаята")).not.toBeInTheDocument();
    expectNoRoomActions();
    expect(screen.queryByRole("region", { name: "Първи играчи в стаята" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Въведи друг код/ })).toHaveAttribute("href", "/mafia/join");
  });

  it("offers game selection for a missing invitation without inventing its family or open rooms", async () => {
    fetchPreview.mockResolvedValue(respond({ status: "missing" }));
    render(<LobbyInviteClient code="ABC234" />);
    expect(await screen.findByRole("status")).toHaveTextContent("Тази стая вече не е достъпна");
    expect(screen.getByRole("link", { name: "Въведи друг код" })).toHaveAttribute("href", "/join");
    expect(screen.queryByRole("link", { name: /отворените маси/ })).not.toBeInTheDocument();
    expectNoRoomActions();
  });

  it.each(["mafia", "werewolves"] as const)("returns a %s guest to its code entry, not creation", async (family) => {
    fetchPreview.mockResolvedValue(respond({ ...room, family, mode: family === "mafia" ? "mafia_free" : "werewolves_classic" }));
    render(<LobbyInviteClient {...props} family={family} />);
    expect(await screen.findByRole("link", { name: /Въведи друг код/ })).toHaveAttribute("href", family === "mafia" ? "/mafia/join" : "/werewolf/join");
    expect(screen.queryByRole("link", { name: "Назад" })).not.toBeInTheDocument();
  });

  it.each(["network", "unavailable", "invalid"])("recovers from %s without claiming an active invitation", async (failure) => {
    if (failure === "network") fetchPreview.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    else fetchPreview.mockResolvedValueOnce(respond(failure === "unavailable" ? { status: "unavailable" } : {}, failure === "unavailable" ? 503 : 200));
    render(<LobbyInviteClient {...props} />);
    expect(await screen.findByRole("status")).toHaveTextContent(/Не успяхме да проверим стаята/);
    expectNoRoomActions();
    fireEvent.click(screen.getByRole("button", { name: "Провери отново" }));
    expect(await screen.findByRole("link", { name: "Към играта" })).toHaveAttribute("href", props.playHref);
    expect(screen.getByText("Анна", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: shareLabel })).toBeEnabled();
  });

  it("does not show the guest as host when identities are redacted", async () => {
    fetchPreview.mockResolvedValue(respond({ ...room, hostName: null, players: [] }));
    render(<LobbyInviteClient {...props} />);
    await screen.findByRole("link", { name: "Към играта" });
    expect(screen.queryByText("Име на госта")).not.toBeInTheDocument();
    expect(screen.queryByText(/Домакин:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Анна")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Първи играчи в стаята" })).not.toBeInTheDocument();
  });

  it("keeps an in-progress game distinct and allows observation", async () => {
    fetchPreview.mockResolvedValue(respond({ ...room, status: "in_game", canJoinAsPlayer: false }));
    render(<LobbyInviteClient {...props} />);
    expect(await screen.findByRole("status")).toHaveTextContent("Играта вече върви");
    expect(screen.getByRole("link", { name: "Наблюдавай" })).toHaveAttribute("href", props.spectatorHref);
    expect(screen.queryByRole("link", { name: "Към играта" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Когато всички влязат/)).not.toBeInTheDocument();
  });

  it("uses the authoritative family and mode instead of conflicting invite hints", async () => {
    const { container } = render(<LobbyInviteClient {...{ ...props, family: "werewolves" as const, modeLabel: "Върколак", playHref: "/play/ABC234?mode=werewolves_classic&players=35" }} />);
    expect(await screen.findByRole("link", { name: "Към играта" })).toHaveAttribute("href", props.playHref);
    expect(container.querySelector("article")).toHaveAttribute("data-family", "mafia");
    expect(screen.getByRole("link", { name: /Въведи друг код/ })).toHaveAttribute("href", "/mafia/join");
    expect(screen.queryByText(/Върколак/)).not.toBeInTheDocument();
  });

  it("does not offer a player seat when a lobby is full", async () => {
    fetchPreview.mockResolvedValue(respond({ ...room, playerCount: 8, canJoinAsPlayer: false }));
    render(<LobbyInviteClient {...props} />);
    expect(await screen.findByRole("status")).toHaveTextContent("Стаята е пълна");
    expect(screen.queryByRole("link", { name: "Към играта" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Наблюдавай" })).toBeInTheDocument();
  });

  it.each(["lobby", "in_game"])("offers an existing participant a return to a full %s room, never a spectator switch", async (status) => {
    fetchPreview.mockResolvedValue(respond({ ...room, status, playerCount: 8, viewerMembership: "participant", canJoinAsPlayer: true, canSpectate: false }));
    render(<LobbyInviteClient {...props} />);
    expect(await screen.findByRole("link", { name: "Върни се в играта" })).toHaveAttribute("href", props.playHref);
    expect(screen.queryByRole("link", { name: "Наблюдавай" })).not.toBeInTheDocument();
  });

  it("keeps a returning spectator on the spectator route during a game", async () => {
    fetchPreview.mockResolvedValue(respond({ ...room, status: "in_game", viewerMembership: "spectator", canJoinAsPlayer: false }));
    render(<LobbyInviteClient {...props} />);
    expect(await screen.findByRole("link", { name: "Продължи да наблюдаваш" })).toHaveAttribute("href", props.spectatorHref);
    expect(screen.queryByRole("link", { name: "Към играта" })).not.toBeInTheDocument();
  });

  it("does not infer admission from free seats when the server denies both entry modes", async () => {
    fetchPreview.mockResolvedValue(respond({ ...room, canJoinAsPlayer: false, canSpectate: false }));
    render(<LobbyInviteClient {...props} />);
    await screen.findByText("1 от 8 места заети");
    expect(screen.queryByRole("link", { name: "Към играта" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Наблюдавай" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Сподели|Копирай/ })).not.toBeInTheDocument();
  });

  it("fails closed when a preview omits server admission decisions", async () => {
    fetchPreview.mockResolvedValue(respond({ ...room, canJoinAsPlayer: undefined, canSpectate: undefined }));
    render(<LobbyInviteClient {...props} />);
    expect(await screen.findByRole("status")).toHaveTextContent("Не успяхме да проверим стаята");
    expectNoRoomActions();
  });

  it("offers a new code instead of joining or sharing a finished room", async () => {
    fetchPreview.mockResolvedValue(respond({ ...room, status: "finished" }));
    render(<LobbyInviteClient {...props} />);
    expect(await screen.findByRole("status")).toHaveTextContent("Тази стая вече приключи");
    expectNoRoomActions();
    expect(screen.getByRole("link", { name: /Въведи друг код/ })).toHaveAttribute("href", "/mafia/join");
  });

  it.each(["missing", "unavailable"])("removes stale join actions and identities when polling reports %s", async (status) => {
    vi.useFakeTimers();
    fetchPreview.mockResolvedValueOnce(respond(room)).mockResolvedValue(respond({ status }));
    await act(async () => render(<LobbyInviteClient {...props} />));
    expect(screen.getByRole("link", { name: "Към играта" })).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(screen.getByRole("status")).toHaveTextContent(status === "missing" ? "Тази стая вече не е достъпна" : "Не успяхме да проверим стаята");
    expectNoRoomActions();
    expect(screen.queryByText("Анна", { selector: "span" })).not.toBeInTheDocument();
  });

  it("recovers automatically on the next poll after a connection failure", async () => {
    vi.useFakeTimers();
    fetchPreview.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(async () => render(<LobbyInviteClient {...props} />));
    expect(screen.getByRole("status")).toHaveTextContent("Не успяхме да проверим стаята");
    expectNoRoomActions();
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(screen.getByRole("link", { name: "Към играта" })).toHaveAttribute("href", props.playHref);
    expect(screen.getByRole("status")).toHaveTextContent("1 от 8 места заети");
  });

  it("ignores a superseded response after checking again on tab visibility", async () => {
    let finishOld!: (response: Response) => void;
    fetchPreview.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishOld = resolve; }));
    render(<LobbyInviteClient {...props} />);
    expectNoRoomActions();
    fireEvent(document, new Event("visibilitychange"));
    await screen.findByRole("link", { name: "Към играта" });
    await act(async () => finishOld(respond({ status: "missing" })));
    expect(screen.getByRole("link", { name: "Към играта" })).toHaveAttribute("href", props.playHref);
    expect(screen.getByRole("status")).toHaveTextContent("1 от 8 места заети");
  });
});
