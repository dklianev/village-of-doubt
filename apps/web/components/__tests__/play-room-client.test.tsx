import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
import type { GamePhase } from "@werewolf/shared";
import { PlayRoomClient } from "@/components/play-room-client";
import type { GameSnapshot, PublicPlayer } from "@/lib/play/types";

const mocks = vi.hoisted(() => ({
  useGameRoom: vi.fn(),
  useCueMode: vi.fn(),
  usePhaseTransitions: vi.fn(),
  reconnectNow: vi.fn(),
  requestStartGame: vi.fn(),
  privateChatProps: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/play/use-game-room", () => ({
  useGameRoom: mocks.useGameRoom,
}));

vi.mock("@/hooks/play/use-cue-mode", () => ({
  useCueMode: mocks.useCueMode,
}));

vi.mock("@/hooks/play/use-phase-transitions", () => ({
  usePhaseTransitions: mocks.usePhaseTransitions,
}));

vi.mock("@/lib/toast", () => ({
  useToast: () => mocks.toast,
}));

vi.mock("@/components/play/ConnectionBanner", () => ({
  ConnectionBanner: ({ message }: { message: string }) => <div data-testid="connection-banner">{message}</div>,
}));

vi.mock("@/components/play/ReconnectModal", () => ({
  ReconnectModal: ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div role="dialog" aria-label="Връщане в стаята">
      <p>{message}</p>
      <button type="button" onClick={onRetry}>Опитай пак</button>
    </div>
  ),
}));

vi.mock("@/components/play/LiveCuePanel", () => ({
  LiveCuePanel: () => <div data-testid="live-cue-panel" />,
}));

vi.mock("@/components/play/PhaseRail", () => ({
  PhaseRail: () => <div data-testid="phase-rail" />,
}));

vi.mock("@/components/play/RulesSummary", () => ({
  RulesSummary: () => <div data-testid="rules-summary" />,
}));

vi.mock("@/components/play/PhaseGuide", () => ({
  PhaseGuide: () => <div data-testid="phase-guide" />,
}));

vi.mock("@/components/play/Timer", () => ({
  Timer: () => <div data-testid="timer" />,
}));

vi.mock("@/components/play/PreGameCountdown", () => ({
  PreGameCountdown: ({ value }: { value: number | null }) => <div data-testid="countdown">{value}</div>,
}));

vi.mock("@/components/play/PhaseTransitionOverlay", () => ({
  PhaseTransitionOverlay: () => <div data-testid="phase-transition" />,
}));

vi.mock("@/components/keyboard-shortcuts-modal", () => ({
  KeyboardShortcutsModal: () => <div data-testid="shortcuts" />,
}));

vi.mock("@/components/play/AchievementUnlockModal", () => ({
  AchievementUnlockModal: () => <div data-testid="achievement-unlock" />,
}));

vi.mock("@/components/play/NarratorDesk", () => ({
  NarratorDesk: ({ room, phase, onOpenShortcuts }: ComponentProps<typeof import("@/components/play/NarratorDesk").NarratorDesk>) => (
    <div data-testid="narrator-desk" data-phase={phase}>
      <button type="button" onClick={() => room?.send("narratorPause")}>Пауза</button>
      <button type="button" onClick={onOpenShortcuts}>Клавишни команди</button>
    </div>
  ),
}));

vi.mock("@/components/play/NarratorSnapshotPanel", () => ({
  NarratorSnapshotPanel: () => <div data-testid="narrator-snapshot" />,
}));

vi.mock("@/components/play/LoverCard", () => ({
  LoverCard: () => <div data-testid="lover-card" />,
}));

vi.mock("@/components/play/RoleCard", () => ({
  RoleCard: () => <div data-testid="role-card" />,
}));

vi.mock("@/components/play/DeathRevealCinematic", () => ({
  DeathRevealCinematic: () => <div data-testid="death-reveal" />,
}));

vi.mock("@/components/play/NightActionPanel", () => ({
  NightActionPanel: ({
    selectedTargetId,
    secondTargetId,
    doctorCanSelfProtect,
  }: {
    selectedTargetId: string;
    secondTargetId: string;
    doctorCanSelfProtect: boolean;
  }) => <div data-testid="night-action" data-doctor-self={String(doctorCanSelfProtect)}>{selectedTargetId}|{secondTargetId}</div>,
}));

vi.mock("@/components/play/VotingPanel", () => ({
  VotingPanel: ({
    livingPlayers,
    allowSkipVote,
  }: {
    livingPlayers: PublicPlayer[];
    allowSkipVote: boolean;
  }) => (
    <div
      data-testid="voting-panel"
      data-targets={livingPlayers.map((item) => item.userId).join(",")}
      data-skip={String(allowSkipVote)}
    />
  ),
}));

vi.mock("@/components/play/HunterRevengePanel", () => ({
  HunterRevengePanel: () => <div data-testid="hunter-revenge" />,
}));

vi.mock("@/components/play/PrivateChatPanel", () => ({
  PrivateChatPanel: (props: { value: string; onValueChange: (value: string) => void; onAccepted?: (value: string) => void }) => {
    mocks.privateChatProps(props);
    return <input data-testid="private-chat" aria-label="Private draft" value={props.value} onChange={(event) => props.onValueChange(event.target.value)} />;
  },
}));

vi.mock("@/components/play/PostGameStory", () => ({
  PostGameStory: () => <div data-testid="post-game-story" />,
}));

vi.mock("@/components/play/TypingIndicator", () => ({
  TypingIndicator: () => <div data-testid="typing" />,
}));

vi.mock("@/components/play/SummaryPill", () => ({
  SummaryPill: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/skeleton", () => ({
  PlayerTokensSkeleton: () => <div data-testid="player-skeleton" />,
}));

const player: PublicPlayer = {
  userId: "u1",
  displayName: "Играч",
  connected: true,
  ready: false,
  playing: true,
  alive: true,
  host: true,
  narrator: false,
  acceptedFullNarrator: true,
  mayor: false,
  hasVoted: false,
  actedThisPhase: false,
  revealedRole: "",
};

function snapshotForPhase(phase: GamePhase): GameSnapshot {
  return {
    code: "ABCD",
    mode: "werewolves_classic",
    playerCount: 1,
    narratorMode: "automatic",
    communicationMode: "built_in_chat",
    tempoProfile: "normal",
    dayDiscussionSeconds: 90,
    voteSeconds: 45,
    revealRolesOnDeath: true,
    loversEnabled: true,
    doctorCanSelfProtect: false,
    allowSkipVote: false,
    majorityMode: "simple",
    narratorVoice: "classic",
    phase,
    round: phase === "lobby" ? 0 : 1,
    phaseEndsAt: 0,
    winnerTeam: phase === "game_over" ? "village" : "",
    winnerReasonBg: phase === "game_over" ? "Селото оцеля." : "",
    players: [player],
    roleCounts: [],
    voteTally: [],
    publicEvents: [],
    publicChat: [],
  };
}

function mockHooks(phase: GamePhase = "lobby", overrides: Record<string, unknown> = {}) {
  mocks.useGameRoom.mockReturnValue({
    room: { send: vi.fn(), onMessage: vi.fn() },
    snapshot: snapshotForPhase(phase),
    currentUserId: "u1",
    privateRole: null,
    privateResult: null,
    privateLover: null,
    narratorSnapshot: null,
    privateChats: [],
    typingNotices: [],
    isBlessed: false,
    connectionMessage: "Свързан",
    connectionStatus: "connected",
    recordedGameId: null,
    unlockedAchievementIds: [],
    setUnlockedAchievementIds: vi.fn(),
    reconnectNow: mocks.reconnectNow,
    isPending: false,
    ...overrides,
  });
  mocks.useCueMode.mockReturnValue({
    cueMode: "visual",
    changeCueMode: vi.fn(),
  });
  mocks.usePhaseTransitions.mockReturnValue({
    phasePulse: 0,
    showPhaseTransition: false,
    startCountdown: null,
    requestStartGame: mocks.requestStartGame,
  });
}

function setCompactViewport(matches: boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: matches && query.includes("max-width"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function deferNarratorTools() {
  let resolve!: (module: typeof import("@/components/play/NarratorTools")) => void;
  let reject!: (error: Error) => void;
  const pending = new Promise<typeof import("@/components/play/NarratorTools")>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const load = vi.fn(() => pending);
  vi.doMock("@/components/play/NarratorTools", load);
  return {
    load,
    resolve: async () => {
      const module = await vi.importActual<typeof import("@/components/play/NarratorTools")>("@/components/play/NarratorTools");
      await act(async () => { resolve(module); });
    },
    reject: async () => { await act(async () => { reject(new Error("Synthetic chunk failure")); }); },
  };
}

describe("PlayRoomClient orchestrator", () => {
  beforeEach(() => {
    vi.doUnmock("@/components/play/NarratorTools");
    mocks.useGameRoom.mockReset();
    mocks.useCueMode.mockReset();
    mocks.usePhaseTransitions.mockReset();
    mocks.reconnectNow.mockReset();
    mocks.requestStartGame.mockReset();
    mocks.privateChatProps.mockReset();
    mocks.toast.mockReset();
    setCompactViewport(false);
    mockHooks();
  });

  it.each(["lobby", "night", "day_discussion", "voting", "game_over"] as GamePhase[])(
    "renders without crashing in %s phase",
    async (phase) => {
      mockHooks(phase);

      render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

      if (phase === "game_over") {
        expect(await screen.findByRole("heading", { name: "Селото победи" })).toBeInTheDocument();
      } else {
        if (phase === "lobby") {
          expect(document.querySelector(".play-waiting-invite")).toHaveTextContent("ABCD");
        } else {
          expect(document.querySelector("[data-stage-ledger]")).toHaveTextContent("Код на стаятаABCD");
        }
        expect(screen.getAllByText("Играч").length).toBeGreaterThan(0);
      }
    },
  );

  it("passes the room code and create options into useGameRoom", () => {
    const createOptions = { mode: "werewolves_classic" } as const;
    const initialSession = { user: { id: "u1" } };

    render(
      <PlayRoomClient
        code="ROOM42"
        createOptions={createOptions}
        initialSession={initialSession}
      />,
    );

    expect(mocks.useGameRoom).toHaveBeenCalledWith(expect.objectContaining({
      code: "ROOM42",
      createOptions,
      initialSession,
    }));
  });

  it.each([false, true])("composes the lobby with header invitations and a bottom control band (compact=%s)", async (compact) => {
    setCompactViewport(compact);
    const send = vi.fn();
    mockHooks("lobby", { room: { send, onMessage: vi.fn() } });
    const { container } = render(<PlayRoomClient code="ABCD" />);

    const ready = screen.getByTestId("ready-toggle");
    expect(ready).toBeVisible();
    expect(ready).toHaveAttribute("aria-pressed", "false");
    const band = ready.closest(".play-waiting-band");
    expect(band).not.toBeNull();
    expect(within(band as HTMLElement).getByRole("button", { name: "Започни игра" })).toBeVisible();
    expect(within(band as HTMLElement).getByRole("button", { name: "Правила" })).toBeVisible();
    expect(within(band as HTMLElement).getByTestId("live-cue-panel")).toBeInTheDocument();
    expect(within(band as HTMLElement).getByRole("link", { name: "Напусни масата" })).toHaveAttribute("href", "/werewolf");
    for (const name of ["Копирай кода на стаята", "Копирай покана"]) {
      const copy = screen.getByRole("button", { name });
      expect(copy).toBeVisible();
      expect(copy.closest(".play-waiting-invite")).not.toBeNull();
      expect(copy.closest(".play-stage")).not.toBeNull();
      expect(copy.closest(".play-waiting-band")).toBeNull();
    }
    expect(container.querySelector(".play-interaction-column")).toBeNull();
    expect(container.querySelector(".play-mobile-navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: "Покажи подробностите за стаята" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("narrator-desk")).not.toBeInTheDocument();
    await userEvent.click(ready);
    expect(send).toHaveBeenCalledWith("ready", { ready: true });
    expect(screen.getAllByTestId("ready-toggle")).toHaveLength(1);
  });

  it("keeps readiness server-owned and updates the bottom count from public snapshots", async () => {
    const send = vi.fn();
    const players: PublicPlayer[] = [
      player,
      { ...player, userId: "u2", displayName: "Рада", host: false, connected: false, ready: true },
      { ...player, userId: "observer", displayName: "Неда", host: false, playing: false, alive: false, ready: true },
      { ...player, userId: "narrator", displayName: "Борил", host: false, playing: false, alive: false, narrator: true, ready: true },
    ];
    const state = { ...snapshotForPhase("lobby"), players };
    mockHooks("lobby", { room: { send, onMessage: vi.fn() }, snapshot: state });
    const { rerender } = render(<PlayRoomClient code="ABCD" />);
    const ready = screen.getByTestId("ready-toggle");
    const count = screen.getByRole("status", { name: "Готови: 1 от 2" });
    expect(count.closest(".play-waiting-readiness")).not.toBeNull();
    expect(count.closest(".play-waiting-band")).not.toBeNull();
    expect(count.closest(".play-stage")).toBeNull();
    await userEvent.click(ready);
    expect(send).toHaveBeenCalledExactlyOnceWith("ready", { ready: true });
    expect(ready).toHaveAttribute("aria-pressed", "false");

    mockHooks("lobby", {
      room: { send, onMessage: vi.fn() },
      snapshot: { ...state, players: players.map((item) => item.userId === "u1" ? { ...item, ready: true } : item) },
    });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(screen.getByRole("status", { name: "Готови: 2 от 2" })).toHaveAttribute("aria-atomic", "true");
    expect(ready).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(ready);
    expect(send).toHaveBeenLastCalledWith("ready", { ready: false });
  });

  it("lets the host request a start while participants are not ready", async () => {
    const send = vi.fn();
    mockHooks("lobby", { room: { send, onMessage: vi.fn() } });
    render(<PlayRoomClient code="ABCD" />);
    const start = screen.getByRole("button", { name: "Започни игра" });
    expect(start).toBeEnabled();
    await userEvent.click(start);
    expect(mocks.requestStartGame).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it("updates countdown eligibility when the connection drops but the Room stays the same", () => {
    const room = { send: vi.fn(), onMessage: vi.fn() };
    mockHooks("lobby", { room });
    const { rerender } = render(<PlayRoomClient code="ABCD" />);
    expect(mocks.usePhaseTransitions).toHaveBeenLastCalledWith(expect.objectContaining({ room, connected: true }));

    mockHooks("lobby", { room, connectionStatus: "reconnecting" });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(mocks.usePhaseTransitions).toHaveBeenLastCalledWith(expect.objectContaining({ room, connected: false }));

    mockHooks("lobby", { room });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(mocks.usePhaseTransitions).toHaveBeenLastCalledWith(expect.objectContaining({ room, connected: true }));
  });

  it("does not declare an empty or disconnected lobby fully assembled", () => {
    mockHooks("lobby", { snapshot: { ...snapshotForPhase("lobby"), players: [] } });
    const { rerender } = render(<PlayRoomClient code="ABCD" />);
    expect(screen.getByRole("status", { name: "Готови: 0 от 0" })).toBeVisible();
    expect(screen.queryByText("Всички са на масата.")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ready-toggle")).not.toBeInTheDocument();
    mockHooks("lobby", { snapshot: { ...snapshotForPhase("lobby"), players: [{ ...player, ready: true, connected: false }] } });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(screen.getByRole("status", { name: "Готови: 1 от 1" })).toHaveTextContent("Чакаме връзката на участник.");
    expect(screen.queryByText("Всички са на масата.")).not.toBeInTheDocument();
    mockHooks("lobby", { snapshot: { ...snapshotForPhase("lobby"), players: [{ ...player, ready: true }] } });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(screen.getByRole("status", { name: "Готови: 1 от 1" })).toHaveTextContent("Всички са на масата.");
  });

  it("disables readiness and explains the unavailable start while the room is missing", () => {
    mockHooks("lobby", { room: null });
    render(<PlayRoomClient code="ABCD" />);
    expect(screen.getByTestId("ready-toggle")).toBeDisabled();
    const start = screen.getByRole("button", { name: "Започни игра" });
    expect(start).toBeDisabled();
    expect(start).toHaveAccessibleDescription("Изчакай връзката със стаята да се възстанови.");
  });

  it("keeps a pending start disabled without adding a second start request", async () => {
    mocks.usePhaseTransitions.mockReturnValue({
      phasePulse: 0, showPhaseTransition: false, startCountdown: 2, requestStartGame: mocks.requestStartGame,
    });
    render(<PlayRoomClient code="ABCD" />);
    const start = screen.getByRole("button", { name: "Започваме..." });
    expect(start).toBeDisabled();
    expect(start).toHaveAccessibleDescription("Стартът вече е заявен.");
    await userEvent.click(start);
    expect(mocks.requestStartGame).not.toHaveBeenCalled();
  });

  it("moves start authority with the public host flag without removing player readiness", () => {
    mockHooks("lobby", { snapshot: { ...snapshotForPhase("lobby"), players: [{ ...player, host: false }] } });
    const { rerender } = render(<PlayRoomClient code="ABCD" />);
    expect(screen.getByTestId("ready-toggle")).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Започни игра" })).not.toBeInTheDocument();
    mockHooks("lobby");
    rerender(<PlayRoomClient code="ABCD" />);
    expect(screen.getByRole("button", { name: "Започни игра" })).toBeEnabled();
    expect(screen.getAllByTestId("ready-toggle")).toHaveLength(1);
  });

  it.each([false, true])("does not offer readiness to a non-playing viewer (narrator=%s)", (narrator) => {
    mockHooks("lobby", {
      snapshot: { ...snapshotForPhase("lobby"), players: [{ ...player, playing: false, alive: false, host: false, narrator }] },
    });
    render(<PlayRoomClient code="ABCD" />);
    expect(screen.queryByTestId("ready-toggle")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Започни игра" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Правила" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Напусни масата" })).toBeVisible();
    expect(screen.getByRole("status", { name: "Готови: 0 от 0" })).toBeVisible();
  });

  it.each(["Копирай кода на стаята", "Копирай покана"])("copies the intended public value with %s", async (name) => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<PlayRoomClient code="ABCD" />);
    await user.click(screen.getByRole("button", { name }));
    expect(write).toHaveBeenCalledExactlyOnceWith(name === "Копирай покана"
      ? new URL("/lobby/ABCD", window.location.origin).href
      : "ABCD");
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ kind: "success" }));
  });

  it.each(["Копирай кода на стаята", "Копирай покана"])("keeps the room usable when %s fails", async (name) => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Clipboard unavailable"));
    render(<PlayRoomClient code="ABCD" />);
    await user.click(screen.getByRole("button", { name }));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ kind: "error", message: expect.stringContaining("ABCD") }));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "success" }));
    expect(screen.getByTestId("ready-toggle")).toBeEnabled();
    expect(screen.getByRole("button", { name })).toBeVisible();
  });

  it.each([
    ["werewolves_classic", "/werewolf"],
    ["mafia_free", "/mafia"],
  ] as const)("uses the existing guard before leaving the %s table", (mode, href) => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const leave = vi.fn();
    const send = vi.fn();
    mockHooks("lobby", { room: { send, leave, onMessage: vi.fn() }, snapshot: { ...snapshotForPhase("lobby"), mode } });
    render(<PlayRoomClient code="ABCD" />);
    const link = screen.getByRole("link", { name: "Напусни масата" });
    expect(link).toHaveAttribute("href", href);
    expect(fireEvent.click(link)).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("домакин"));
    expect(leave).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByTestId("ready-toggle")).toBeInTheDocument();
  });

  it("restores host phase controls once the game starts", async () => {
    mockHooks("role_reveal");
    render(<PlayRoomClient code="ABCD" />);
    expect(await screen.findByTestId("narrator-desk")).toBeInTheDocument();
    expect(screen.queryByTestId("ready-toggle")).not.toBeInTheDocument();
  });

  it("restores active gameplay composition after a lobby snapshot transition", async () => {
    const { container, rerender } = render(<PlayRoomClient code="ABCD" />);
    expect(container.querySelector(".play-waiting-band")).toBeVisible();
    mockHooks("night");
    rerender(<PlayRoomClient code="ABCD" />);
    expect(container.querySelector(".play-waiting-band")).toBeNull();
    expect(container.querySelector(".play-waiting-invite")).toBeNull();
    expect(container.querySelector(".play-interaction-column")).not.toBeNull();
    expect(container.querySelector(".play-mobile-navigation")).not.toBeNull();
    expect(await screen.findByTestId("narrator-desk")).toBeInTheDocument();
    expect(screen.queryByTestId("ready-toggle")).not.toBeInTheDocument();
  });

  it("does not import narrator tools for the waiting room, ordinary players, or consent alone", async () => {
    const deferred = deferNarratorTools();
    const { rerender } = render(<PlayRoomClient code="ABCD" />);
    await act(async () => {});
    expect(deferred.load).not.toHaveBeenCalled();

    mockHooks("night", { snapshot: { ...snapshotForPhase("night"), players: [{ ...player, host: false }] } });
    rerender(<PlayRoomClient code="ABCD" />);
    await act(async () => {});
    expect(deferred.load).not.toHaveBeenCalled();

    mockHooks("lobby", { snapshot: {
      ...snapshotForPhase("lobby"), narratorMode: "full_human", players: [{ ...player, acceptedFullNarrator: false }],
    } });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(screen.getByRole("button", { name: "Приемам" })).toBeVisible();
    await act(async () => {});
    expect(deferred.load).not.toHaveBeenCalled();

    mockHooks("role_reveal");
    rerender(<PlayRoomClient code="ABCD" />);
    await waitFor(() => expect(deferred.load).toHaveBeenCalledOnce());
    expect(screen.getByText("Зареждаме панела...")).toBeVisible();
    await deferred.resolve();
    expect(await screen.findByTestId("narrator-desk")).toBeVisible();
  });

  it("keeps consent usable and focused while pending tools receive the latest room state", async () => {
    const user = userEvent.setup();
    const deferred = deferNarratorTools();
    const send = vi.fn();
    const players = [{ ...player, narrator: true, acceptedFullNarrator: false }];
    mockHooks("night", { snapshot: { ...snapshotForPhase("night"), narratorMode: "full_human", players } });
    const { rerender } = render(<PlayRoomClient code="ABCD" />);
    await waitFor(() => expect(deferred.load).toHaveBeenCalledOnce());
    const consent = screen.getByRole("button", { name: "Приемам" });
    consent.focus();

    mockHooks("day_discussion", {
      room: { send, onMessage: vi.fn() },
      snapshot: { ...snapshotForPhase("day_discussion"), narratorMode: "full_human", players },
      narratorSnapshot: { roles: [] },
    });
    rerender(<PlayRoomClient code="ABCD" />);
    await deferred.resolve();
    expect(await screen.findByTestId("narrator-desk")).toHaveAttribute("data-phase", "day_discussion");
    expect(screen.getByTestId("narrator-snapshot")).toBeVisible();
    expect(consent).toHaveFocus();
    await user.click(consent);
    expect(send).toHaveBeenCalledWith("acceptFullNarrator");
    await user.click(screen.getByRole("button", { name: "Пауза" }));
    expect(send).toHaveBeenCalledWith("narratorPause");
    await user.click(screen.getByRole("button", { name: "Клавишни команди" }));
    expect(await screen.findByTestId("shortcuts")).toBeVisible();
  });

  it("isolates narrator chunk failures and supports a focused retry", async () => {
    const user = userEvent.setup();
    const deferred = deferNarratorTools();
    mockHooks("night");
    const { container } = render(<PlayRoomClient code="ABCD" />);
    await waitFor(() => expect(deferred.load).toHaveBeenCalledOnce());
    await deferred.reject();
    expect(await screen.findByText("Панелът не се зареди.")).toBeVisible();
    expect(container.querySelector(".play-shell-inner")).not.toHaveAttribute("inert");
    expect(screen.getByTestId("connection-banner")).toBeVisible();

    const retry = deferNarratorTools();
    await user.click(screen.getByRole("button", { name: "Опитай пак" }));
    await waitFor(() => expect(retry.load).toHaveBeenCalledOnce());
    await retry.resolve();
    expect(await screen.findByRole("button", { name: "Пауза" })).toHaveFocus();
    expect(screen.queryByText("Панелът не се зареди.")).not.toBeInTheDocument();
  });

  it("does not steal focus moved elsewhere during a narrator retry", async () => {
    const deferred = deferNarratorTools();
    mockHooks("night", { snapshot: {
      ...snapshotForPhase("night"), narratorMode: "full_human", players: [{ ...player, acceptedFullNarrator: false }],
    } });
    render(<PlayRoomClient code="ABCD" />);
    await waitFor(() => expect(deferred.load).toHaveBeenCalledOnce());
    await deferred.reject();
    const retry = deferNarratorTools();
    await userEvent.click(await screen.findByRole("button", { name: "Опитай пак" }));
    const consent = screen.getByRole("button", { name: "Приемам" });
    consent.focus();
    await waitFor(() => expect(retry.load).toHaveBeenCalledOnce());
    await retry.resolve();
    expect(await screen.findByTestId("narrator-desk")).toBeVisible();
    expect(consent).toHaveFocus();
  });

  it.each(["resolve", "reject"] as const)("ignores a narrator load %s during disconnect and recovers", async (outcome) => {
    const deferred = deferNarratorTools();
    mockHooks("night", { connectionStatus: "reconnecting" });
    const { container, rerender } = render(<PlayRoomClient code="ABCD" />);
    await act(async () => {});
    expect(deferred.load).not.toHaveBeenCalled();
    mockHooks("night");
    rerender(<PlayRoomClient code="ABCD" />);
    await waitFor(() => expect(deferred.load).toHaveBeenCalledOnce());
    mockHooks("night", { connectionStatus: "reconnecting" });
    rerender(<PlayRoomClient code="ABCD" />);
    await deferred[outcome]();
    expect(screen.queryByTestId("narrator-desk")).not.toBeInTheDocument();
    expect(screen.queryByText("Панелът не се зареди.")).not.toBeInTheDocument();
    expect(container.querySelector(".play-shell-inner")).toHaveAttribute("inert");
    expect(screen.getByRole("dialog")).toBeVisible();

    const recovered = deferNarratorTools();
    mockHooks("night");
    rerender(<PlayRoomClient code="ABCD" />);
    await waitFor(() => expect(recovered.load).toHaveBeenCalledOnce());
    await recovered.resolve();
    expect(await screen.findByTestId("narrator-desk")).toBeVisible();
    expect(container.querySelector(".play-shell-inner")).not.toHaveAttribute("inert");
  });

  it("loads an unlocked legend without replacing the completed game", async () => {
    mockHooks("game_over", { unlockedAchievementIds: ["first_win"] });
    render(<PlayRoomClient code="ABCD" />);

    expect(await screen.findByRole("heading", { name: "Селото победи" })).toBeInTheDocument();
    expect(await screen.findByTestId("achievement-unlock")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Селото победи" })).toBeInTheDocument();
  });

  it("loads keyboard help on demand without replacing the lobby", async () => {
    mockHooks("lobby");
    render(<PlayRoomClient code="ABCD" />);
    expect(screen.queryByTestId("shortcuts")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "?" });
    expect(await screen.findByTestId("shortcuts")).toBeInTheDocument();
    expect(screen.getByTestId("ready-toggle")).toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("shortcuts")).not.toBeInTheDocument();
  });

  it("keeps the waiting room usable when shared keyboard help fails and retries on demand", async () => {
    const deferred = deferNarratorTools();
    mockHooks("lobby");
    render(<PlayRoomClient code="ABCD" />);
    fireEvent.keyDown(window, { key: "?" });
    await waitFor(() => expect(deferred.load).toHaveBeenCalledOnce());
    await deferred.reject();
    expect(mocks.toast).toHaveBeenCalledWith({ kind: "error", message: "Помощта не се зареди. Опитай пак." });
    expect(screen.getByTestId("ready-toggle")).toBeVisible();
    expect(screen.queryByTestId("narrator-snapshot")).not.toBeInTheDocument();

    const retry = deferNarratorTools();
    fireEvent.keyDown(window, { key: "?" });
    await waitFor(() => expect(retry.load).toHaveBeenCalledOnce());
    await retry.resolve();
    expect(await screen.findByTestId("shortcuts")).toBeVisible();
    expect(screen.queryByTestId("narrator-snapshot")).not.toBeInTheDocument();
  });

  it.each(["reconnecting", "lost", "error"])("blocks the table and shortcuts during %s and restores them after recovery", async (connectionStatus) => {
    mockHooks("lobby", { connectionStatus });
    const { container, rerender } = render(<PlayRoomClient code="ABCD" />);
    expect(container.querySelector(".play-shell-inner")).toHaveAttribute("inert");
    expect(screen.getByTestId("connection-banner").closest("[inert]")).toBeNull();
    expect(screen.getByRole("dialog").closest("[inert]")).toBeNull();
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.queryByTestId("shortcuts")).not.toBeInTheDocument();

    mockHooks("lobby");
    rerender(<PlayRoomClient code="ABCD" />);
    expect(container.querySelector(".play-shell-inner")).not.toHaveAttribute("inert");
    fireEvent.keyDown(window, { key: "?" });
    expect(await screen.findByTestId("shortcuts")).toBeInTheDocument();
  });

  it("routes reconnect retry clicks to useGameRoom", async () => {
    mockHooks("lobby", {
      connectionStatus: "lost",
      connectionMessage: "Не успяхме да възстановим връзката автоматично.",
    });

    render(<PlayRoomClient code="ABCD" />);

    await userEvent.click(screen.getByRole("button", { name: "Опитай пак" }));

    expect(mocks.reconnectNow).toHaveBeenCalledTimes(1);
  });

  it.each(["connecting", "connected", "reconnecting", "disconnected", "lost", "error"] as const)("keeps completed-game navigation available when %s", async (connectionStatus) => {
    const user = userEvent.setup();
    mockHooks("game_over", { recordedGameId: "game-1" });
    const { container, rerender } = render(<PlayRoomClient code="ABCD" />);
    await waitFor(() => expect(container.querySelectorAll(".play-winner-actions a")).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Селото победи" })).toHaveFocus());
    mockHooks("game_over", { connectionStatus, room: null, currentUserId: "", recordedGameId: "game-1", connectionMessage: "Connection update" });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("connection-banner")).toHaveTextContent("Connection update");
    const links = container.querySelectorAll<HTMLAnchorElement>("[data-endgame] a");
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.closest("[inert]")).toBeNull();
      await user.tab();
      expect(link).toHaveFocus();
    }
    expect(mocks.reconnectNow).not.toHaveBeenCalled();
  });

  it.each(["reconnecting", "lost", "error"] as const)("keeps %s recovery until both game over and a winner arrive", async (connectionStatus) => {
    mockHooks("voting", {
      connectionStatus,
      snapshot: { ...snapshotForPhase("voting"), winnerTeam: "village" },
    });
    const { container, rerender } = render(<PlayRoomClient code="ABCD" />);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(container.querySelector(".play-shell-inner")).toHaveAttribute("inert");
    expect(container.querySelector("[data-endgame]")).toBeNull();

    mockHooks("game_over", {
      connectionStatus,
      snapshot: { ...snapshotForPhase("game_over"), winnerTeam: "" },
    });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(container.querySelector("[data-endgame]")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Опитай пак" }));
    expect(mocks.reconnectNow).toHaveBeenCalledOnce();

    mockHooks("game_over", { connectionStatus });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(await screen.findByRole("heading", { name: "Селото победи" })).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not show a stale private role while waiting in the lobby", () => {
    const canary = "PRIVATE-LOBBY-CANARY";
    mockHooks("lobby", {
      privateRole: { role: "seer", roleNameBg: canary },
      privateResult: { targetName: canary, resultBg: canary },
      privateLover: { loverUserId: "u2", loverName: canary },
      privateChats: [{ id: "secret", channel: "werewolves", senderUserId: "u2", senderName: canary, message: canary, createdAt: 1 }],
      narratorSnapshot: { roles: [{ userId: "u2", displayName: canary, role: "seer", roleNameBg: canary }] },
      isBlessed: true,
    });
    const { container } = render(<PlayRoomClient code="ABCD" />);
    expect(document.querySelector(".play-personal-area")).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain(canary);
    expect(screen.queryByTestId("role-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("private-chat")).not.toBeInTheDocument();
    expect(screen.queryByTestId("narrator-snapshot")).not.toBeInTheDocument();
  });

  it("reveals the desktop private role only after an explicit action", async () => {
    mockHooks("role_reveal", {
      privateRole: { role: "seer", roleNameBg: "Гадателка" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    expect(screen.queryByTestId("role-card")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Виж ролята си" }));
    expect(await screen.findByTestId("role-card")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Скрий личния ход" })).not.toBeInTheDocument();
  });

  it("keeps the own role beside the table without a dossier modal during play", async () => {
    mockHooks("night", { privateRole: { role: "seer", roleNameBg: "Гадателка" } });
    render(<PlayRoomClient code="ABCD" />);

    const card = await screen.findByTestId("role-card");
    expect(card.closest(".play-personal-area")).not.toBeNull();
    expect(card.closest(".play-stage")).toBeNull();
    expect(screen.queryByRole("button", { name: "Отвори тайното досие" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Скрий ролята" }));
    expect(screen.queryByTestId("role-card")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Виж ролята си" }));
    expect(await screen.findByTestId("role-card")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts with a concealed personal area for an in-person game", async () => {
    mockHooks("night", {
      snapshot: { ...snapshotForPhase("night"), tempoProfile: "live" },
      privateRole: { role: "seer", roleNameBg: "Гадателка" },
    });
    render(<PlayRoomClient code="ABCD" />);
    expect(screen.queryByTestId("role-card")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Виж ролята си" }));
    expect(await screen.findByTestId("role-card")).toBeInTheDocument();
  });

  it("keeps an explicitly concealed card hidden when the assigned role changes", async () => {
    mockHooks("night", { privateRole: { role: "thief", roleNameBg: "Крадец" } });
    const { rerender } = render(<PlayRoomClient code="ABCD" />);
    await screen.findByTestId("role-card");
    await userEvent.click(screen.getByRole("button", { name: "Скрий ролята" }));
    mockHooks("night", { privateRole: { role: "seer", roleNameBg: "Гадателка" } });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(screen.queryByTestId("role-card")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Виж ролята си" }));
    expect(await screen.findByTestId("role-card")).toBeInTheDocument();
  });

  it("advances private unread counts only to a reported visible message and never moves backwards", async () => {
    mockHooks("night", {
      privateRole: { role: "werewolf", roleNameBg: "Върколак" },
      privateChats: ["u2", "u1", "u3"].map((senderUserId, index) => ({
        id: `private-${index}`, channel: "werewolves", senderUserId,
        senderName: "Player", message: "Private message", createdAt: index,
      })),
    });
    render(<PlayRoomClient code="ABCD" />);
    expect(screen.getByText("2 нови")).toBeInTheDocument();
    act(() => mocks.privateChatProps.mock.lastCall?.[0].onRead("private-2"));
    expect(screen.getByText("2 нови")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Личен разговор"));
    expect(screen.getByText("2 нови")).toBeInTheDocument();
    act(() => mocks.privateChatProps.mock.lastCall?.[0].onRead("private-0"));
    expect(screen.getByText("1 ново")).toBeInTheDocument();
    act(() => mocks.privateChatProps.mock.lastCall?.[0].onRead("private-1"));
    expect(screen.getByText("1 ново")).toBeInTheDocument();
    act(() => mocks.privateChatProps.mock.lastCall?.[0].onRead("private-2"));
    expect(screen.queryByText(/\d нов[ои]/)).not.toBeInTheDocument();
    act(() => mocks.privateChatProps.mock.lastCall?.[0].onRead("private-0"));
    act(() => mocks.privateChatProps.mock.lastCall?.[0].onRead("missing-message"));
    expect(screen.queryByText(/\d нов[ои]/)).not.toBeInTheDocument();
  });

  it("isolates read markers and saved reading positions between private channels", async () => {
    const privateChats = ["werewolves", "mafia"].map((channel) => ({
      id: `${channel}-1`, channel, senderUserId: "u2", senderName: "Player", message: "Private message", createdAt: 1,
    }));
    mockHooks("night", { privateRole: { role: "werewolf", roleNameBg: "Върколак" }, privateChats });
    const { rerender } = render(<PlayRoomClient code="ABCD" />);
    await userEvent.click(screen.getByText("Личен разговор"));
    const position = { scrollTop: 80, followLatest: false };
    act(() => mocks.privateChatProps.mock.lastCall?.[0].onScrollPositionChange(position));
    act(() => mocks.privateChatProps.mock.lastCall?.[0].onRead("werewolves-1"));
    expect(screen.queryByText("1 ново")).not.toBeInTheDocument();
    mockHooks("night", { privateRole: { role: "mafioso", roleNameBg: "Мафиот" }, privateChats });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(mocks.privateChatProps.mock.lastCall?.[0].initialScrollPosition).toBeUndefined();
    expect(screen.getByText("1 ново")).toBeInTheDocument();
    act(() => mocks.privateChatProps.mock.lastCall?.[0].onRead("werewolves-1"));
    expect(screen.getByText("1 ново")).toBeInTheDocument();
    mockHooks("night", { privateRole: { role: "werewolf", roleNameBg: "Върколак" }, privateChats });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(mocks.privateChatProps.mock.lastCall?.[0].initialScrollPosition).toEqual(position);
    expect(screen.queryByText("1 ново")).not.toBeInTheDocument();
  });

  it("preserves unread messages and saved scroll position through concealment and room changes", async () => {
    mockHooks("night", {
      privateRole: { role: "werewolf", roleNameBg: "Върколак" },
      privateChats: [{ id: "private-1", channel: "werewolves", senderUserId: "u2", senderName: "Player", message: "Private message", createdAt: 1 }],
    });
    const { rerender } = render(<PlayRoomClient code="ABCD" />);
    await userEvent.click(screen.getByText("Личен разговор"));
    const position = { scrollTop: 80, followLatest: false };
    act(() => mocks.privateChatProps.mock.lastCall?.[0].onScrollPositionChange(position));
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => mocks.privateChatProps.mock.lastCall?.[0].onRead("private-1"));
    expect(screen.getByText("1 ново")).toBeInTheDocument();
    visibility.mockReturnValue("visible");
    await userEvent.click(screen.getByRole("button", { name: "Скрий ролята" }));
    await userEvent.click(screen.getByRole("button", { name: "Виж ролята си" }));
    expect(mocks.privateChatProps.mock.lastCall?.[0].initialScrollPosition).toEqual(position);
    expect(screen.getByText("1 ново")).toBeInTheDocument();
    rerender(<PlayRoomClient code="EFGH" />);
    expect(mocks.privateChatProps.mock.lastCall?.[0].initialScrollPosition).toBeUndefined();
    expect(screen.getByText("1 ново")).toBeInTheDocument();
  });

  it.each([false, true])("handles a private send acknowledgement after concealment (edited again: %s)", async (editedAgain) => {
    mockHooks("night", { privateRole: { role: "werewolf", roleNameBg: "Върколак" } });
    render(<PlayRoomClient code="ABCD" />);
    await userEvent.click(screen.getByText("Личен разговор"));
    fireEvent.change(screen.getByTestId("private-chat"), { target: { value: "Рада" } });
    const acknowledge = mocks.privateChatProps.mock.lastCall?.[0].onAccepted;
    expect(acknowledge).toBeTypeOf("function");
    await userEvent.click(screen.getByRole("button", { name: "Скрий ролята" }));
    if (editedAgain) {
      await userEvent.click(screen.getByRole("button", { name: "Виж ролята си" }));
      fireEvent.change(screen.getByTestId("private-chat"), { target: { value: "Неда" } });
      fireEvent.change(screen.getByTestId("private-chat"), { target: { value: "Рада" } });
      await userEvent.click(screen.getByRole("button", { name: "Скрий ролята" }));
    }
    act(() => acknowledge("Рада"));
    await userEvent.click(screen.getByRole("button", { name: "Виж ролята си" }));
    expect(screen.getByTestId("private-chat")).toHaveValue(editedAgain ? "Рада" : "");
  });

  it("ignores an old private acknowledgement after joining a different room", async () => {
    mockHooks("night", { privateRole: { role: "werewolf", roleNameBg: "Върколак" } });
    const { rerender } = render(<PlayRoomClient code="ABCD" />);
    await userEvent.click(screen.getByText("Личен разговор"));
    fireEvent.change(screen.getByTestId("private-chat"), { target: { value: "Рада" } });
    const acknowledge = mocks.privateChatProps.mock.lastCall?.[0].onAccepted;
    rerender(<PlayRoomClient code="EFGH" />);
    await userEvent.click(screen.getByText("Личен разговор"));
    expect(screen.getByTestId("private-chat")).toHaveValue("");
    fireEvent.change(screen.getByTestId("private-chat"), { target: { value: "Рада" } });
    act(() => acknowledge("Рада"));
    expect(screen.getByTestId("private-chat")).toHaveValue("Рада");
  });

  it("keeps a private send pending across concealment and rejects a duplicate submission", async () => {
    let accept!: (value: { accepted: boolean }) => void;
    const response = new Promise<{ accepted: boolean }>((resolve) => { accept = resolve; });
    const request = vi.fn(() => response);
    mockHooks("night", {
      privateRole: { role: "werewolf", roleNameBg: "Върколак" },
      room: { send: vi.fn(), onMessage: vi.fn(), request },
    });
    render(<PlayRoomClient code="ABCD" />);
    await userEvent.click(screen.getByText("Личен разговор"));
    fireEvent.change(screen.getByTestId("private-chat"), { target: { value: "Рада" } });
    const send = mocks.privateChatProps.mock.lastCall?.[0].onSend;
    let delivery!: Promise<boolean>;
    act(() => { delivery = send("werewolves", "Рада"); });
    await userEvent.click(screen.getByRole("button", { name: "Скрий ролята" }));
    await userEvent.click(screen.getByRole("button", { name: "Виж ролята си" }));
    expect(mocks.privateChatProps.mock.lastCall?.[0].sending).toBe(true);
    let duplicate!: Promise<boolean>;
    act(() => { duplicate = mocks.privateChatProps.mock.lastCall?.[0].onSend("werewolves", "Рада"); });
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => { accept({ accepted: true }); await delivery; });
    expect(await duplicate).toBe(false);
    expect(mocks.privateChatProps.mock.lastCall?.[0].sending).toBe(false);
  });

  it("marks explicit shell layout modes for CSS without relying on descendant selectors", () => {
    mockHooks("night");

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    expect(document.querySelector(".play-layout")).toHaveAttribute("data-has-narrator-deck", "true");
    expect(document.querySelector(".play-layout")).not.toHaveAttribute("data-stage-takeover");
  });

  it("explains why the host cannot start a full-narrator lobby", () => {
    mockHooks("lobby", {
      snapshot: {
        ...snapshotForPhase("lobby"),
        narratorMode: "full_human",
        players: [{ ...player, acceptedFullNarrator: false }],
      },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    const startButton = screen.getByRole("button", { name: "Започни игра" });
    expect(startButton).toBeDisabled();
    expect(startButton).toHaveAccessibleDescription(
      "Всички играчи трябва да приемат, че Разказвачът ще вижда тайните роли.",
    );
  });

  it("keeps a lobby host in place when same-tab navigation is cancelled", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const navigate = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(<><a href="/faq" onClick={navigate}>Помощ от менюто</a><PlayRoomClient code="ABCD" /></>);

    fireEvent.click(screen.getByRole("link", { name: "Помощ от менюто" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Започни игра" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Напусни масата" })).toHaveAttribute("href", "/werewolf");
  });

  it("removes the lobby link guard once play starts", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockHooks("night");
    render(<><a href="/faq" onClick={(event) => event.preventDefault()}>Помощ от менюто</a><PlayRoomClient code="ABCD" /></>);
    fireEvent.click(screen.getByRole("link", { name: "Помощ от менюто" }));
    expect(confirm).not.toHaveBeenCalled();
  });

  it("lets the winner takeover own game over without private or narrator chrome", async () => {
    mockHooks("game_over", {
      privateRole: { role: "seer", roleNameBg: "Гадателка" },
      narratorSnapshot: { players: [] },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    const winnerHeading = await screen.findByRole("heading", { name: "Селото победи" });
    expect(winnerHeading).toBeInTheDocument();
    await waitFor(() => expect(winnerHeading).toHaveFocus());
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Още една игра" })).toHaveFocus();
    expect(screen.getByTestId("post-game-story")).toBeInTheDocument();
    expect(document.querySelector("[data-table-scene]")).not.toBeInTheDocument();
    expect(document.querySelector(".play-stage")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Още една игра" })).toHaveAttribute(
      "href",
      expect.stringContaining("/werewolf/create?"),
    );
    expect(screen.getByRole("link", { name: "Към архива" })).toHaveAttribute("href", "/history");
    expect(screen.queryByTestId("role-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("narrator-desk")).not.toBeInTheDocument();
    expect(screen.queryByTestId("narrator-snapshot")).not.toBeInTheDocument();
    expect(screen.queryByText("Пулсът на стаята")).not.toBeInTheDocument();
    expect(document.querySelector(".play-finale-shell")).toBeInTheDocument();
    expect(document.querySelector(".play-layout")).not.toBeInTheDocument();
  });

  it("links a persisted game-over scene directly to its replay", async () => {
    mockHooks("game_over", { recordedGameId: "game-1" });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    expect(await screen.findByRole("link", { name: "Виж записа" })).toHaveAttribute(
      "href",
      "/history/game-1/replay",
    );
  });

  it("does not steal Enter from focused lobby readiness controls", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    setCompactViewport(true);
    mockHooks("lobby", { room: { send, onMessage: vi.fn() } });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    const toggle = screen.getByTestId("ready-toggle");
    toggle.focus();
    await user.keyboard("{Enter}");

    expect(send).toHaveBeenCalledExactlyOnceWith("ready", { ready: true });
    expect(mocks.requestStartGame).not.toHaveBeenCalled();
  });

  it("confirms an already selected seat with Enter instead of clearing it", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Искра" },
      { ...player, userId: "u2", displayName: "Борил", host: false },
      { ...player, userId: "u3", displayName: "Рада", host: false },
    ];
    mockHooks("voting", {
      room: { send, onMessage: vi.fn() },
      snapshot: {
        ...snapshotForPhase("voting"),
        playerCount: players.length,
        players,
      },
      currentUserId: "u1",
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    const seat = screen.getByRole("button", { name: /Избери Борил:/ });
    await user.click(seat);
    expect(seat).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{Enter}");

    expect(send).toHaveBeenCalledWith("submitVote", { targetUserId: "u2" });
    expect(seat).toHaveAttribute("aria-pressed", "true");
  });

  it("replaces a blacksmith's vote target instead of treating it as a second night target", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const players = [player, { ...player, userId: "u2", displayName: "Борил", host: false },
      { ...player, userId: "u3", displayName: "Рада", host: false }];
    mockHooks("voting", {
      room: { send, onMessage: vi.fn() },
      snapshot: { ...snapshotForPhase("voting"), players, playerCount: 3 },
      currentUserId: "u1", privateRole: { role: "blacksmith", roleNameBg: "Ковач" },
    });
    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);
    await user.click(screen.getByRole("button", { name: /Избери Борил:/ }));
    await user.click(screen.getByRole("button", { name: /Избери Рада:/ }));
    expect(screen.getByRole("button", { name: /Избери Борил:/ })).toHaveAttribute("aria-pressed", "false");
    await user.keyboard("{Enter}");
    expect(send).toHaveBeenCalledWith("submitVote", { targetUserId: "u3" });
  });

  it("keeps Space available for page scrolling and pauses with the physical P key", () => {
    const send = vi.fn();
    mockHooks("night", { room: { send, onMessage: vi.fn() } });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    fireEvent.keyDown(document.body, { key: " ", code: "Space" });
    expect(send).not.toHaveBeenCalledWith("narratorPause");

    fireEvent.keyDown(document.body, { key: "п", code: "KeyP" });
    expect(send).toHaveBeenCalledWith("narratorPause");
  });

  it("keeps connection messages in the connection surface instead of the stage HUD", () => {
    const message = "Връзката прекъсна. Опитваме да те върнем в стаята.";
    mockHooks("lobby", {
      connectionStatus: "reconnecting",
      connectionMessage: message,
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    expect(screen.getByTestId("connection-banner")).toHaveTextContent(message);
    expect(document.querySelector(".play-stage")).not.toHaveTextContent(message);
  });

  it("clears seat selection with Escape even when an action control is focused", async () => {
    const user = userEvent.setup();
    setCompactViewport(true);
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Искра" },
      { ...player, userId: "u2", displayName: "Борил", host: false },
      { ...player, userId: "u3", displayName: "Рада", host: false },
    ];
    mockHooks("first_night", {
      snapshot: {
        ...snapshotForPhase("first_night"),
        playerCount: players.length,
        players,
      },
      currentUserId: "u1",
      privateRole: { role: "blacksmith", roleNameBg: "Ковач" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    await user.click(screen.getByRole("button", { name: /^Избери Борил: онлайн, клавиш \d$/ }));
    expect(screen.getByTestId("night-action")).toHaveTextContent("u2|");

    const toggle = await screen.findByRole("button", { name: "Покажи личния ход" });
    toggle.focus();
    fireEvent.keyDown(toggle, { key: "Escape" });

    expect(screen.getByTestId("night-action")).toHaveTextContent("|");
  });

  it("clears a two-target role's secondary seat when the primary target is toggled off", async () => {
    const user = userEvent.setup();
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Искра" },
      { ...player, userId: "u2", displayName: "Борил", host: false },
      { ...player, userId: "u3", displayName: "Рада", host: false },
    ];
    mockHooks("first_night", {
      snapshot: {
        ...snapshotForPhase("first_night"),
        playerCount: players.length,
        players,
      },
      currentUserId: "u1",
      privateRole: { role: "blacksmith", roleNameBg: "Ковач" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    await user.click(screen.getByRole("button", { name: /^Избери Борил: онлайн, клавиш \d$/ }));
    expect(screen.getByTestId("night-action")).toHaveTextContent("u2|");

    await user.click(screen.getByRole("button", { name: /^Избери Рада: онлайн, клавиш \d$/ }));
    expect(screen.getByTestId("night-action")).toHaveTextContent("u2|u3");

    await user.click(
      screen.getByRole("button", {
        name: "Избери Борил: онлайн, избрана цел",
      }),
    );
    expect(screen.getByTestId("night-action")).toHaveTextContent("|");
  });

  it("uses number shortcuts for the current secondary target list on two-target roles", async () => {
    const user = userEvent.setup();
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Искра" },
      { ...player, userId: "u2", displayName: "Борил", host: false },
      { ...player, userId: "u3", displayName: "Рада", host: false },
      { ...player, userId: "u4", displayName: "Неда", host: false },
    ];
    mockHooks("first_night", {
      snapshot: {
        ...snapshotForPhase("first_night"),
        playerCount: players.length,
        players,
      },
      currentUserId: "u1",
      privateRole: { role: "blacksmith", roleNameBg: "Ковач" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    await user.keyboard("2");
    expect(screen.getByTestId("night-action")).toHaveTextContent("u2|");

    await user.keyboard("1");
    expect(screen.getByTestId("night-action")).toHaveTextContent("u2|u3");
  });

  it("does not arm voting seats or show the voting panel for an eliminated viewer", async () => {
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Искра", alive: false, revealedRole: "seer" },
      { ...player, userId: "u2", displayName: "Борил", host: false },
    ];
    mockHooks("voting", {
      snapshot: {
        ...snapshotForPhase("voting"),
        playerCount: players.length,
        players,
      },
      currentUserId: "u1",
      privateRole: { role: "seer", roleNameBg: "Гадателка" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    expect(
      screen.queryByRole("button", { name: /^Избери Борил: онлайн, клавиш \d$/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("voting-panel")).not.toBeInTheDocument();
    expect(await screen.findByTestId("role-card")).toBeInTheDocument();
  });

  it("does not show voting actions for a spectator", () => {
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Искра", playing: false, host: false },
      { ...player, userId: "u2", displayName: "Борил", host: false },
    ];
    mockHooks("voting", {
      snapshot: {
        ...snapshotForPhase("voting"),
        playerCount: players.length,
        players,
      },
      currentUserId: "u1",
      privateRole: null,
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    expect(
      screen.queryByRole("button", { name: /^Избери Борил: онлайн, клавиш \d$/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("voting-panel")).not.toBeInTheDocument();
  });

  it("shows hunter revenge actions only for an eliminated Hunter viewer", async () => {
    const user = userEvent.setup();
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Искра", alive: false, revealedRole: "hunter" },
      { ...player, userId: "u2", displayName: "Борил", host: false },
    ];
    mockHooks("hunter_revenge", {
      snapshot: {
        ...snapshotForPhase("hunter_revenge"),
        playerCount: players.length,
        players,
      },
      currentUserId: "u1",
      privateRole: { role: "hunter", roleNameBg: "Ловец" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    expect(screen.getByTestId("hunter-revenge")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Избери Борил: онлайн, клавиш \d$/ }));
    expect(
      screen.getByRole("button", {
        name: /^Избери Борил: онлайн, клавиш \d, избрана цел$/,
      }),
    ).toBeInTheDocument();
  });

  it("does not show hunter revenge actions for a living Hunter viewer", () => {
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Искра" },
      { ...player, userId: "u2", displayName: "Борил", host: false },
    ];
    mockHooks("hunter_revenge", {
      snapshot: {
        ...snapshotForPhase("hunter_revenge"),
        playerCount: players.length,
        players,
      },
      currentUserId: "u1",
      privateRole: { role: "hunter", roleNameBg: "Ловец" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    expect(screen.queryByTestId("hunter-revenge")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Избери Борил: онлайн, клавиш \d$/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps voting seats and panel available for a living voter", () => {
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Искра" },
      { ...player, userId: "u2", displayName: "Борил", host: false },
    ];
    mockHooks("voting", {
      snapshot: {
        ...snapshotForPhase("voting"),
        playerCount: players.length,
        players,
      },
      currentUserId: "u1",
      privateRole: { role: "seer", roleNameBg: "Гадателка" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    expect(
      screen.getByRole("button", { name: /^Избери Борил: онлайн, клавиш \d$/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("voting-panel")).toBeInTheDocument();
  });

  it("does not offer a lover as a private voting target", () => {
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Искра" },
      { ...player, userId: "u2", displayName: "Борил", host: false },
      { ...player, userId: "u3", displayName: "Рада", host: false },
    ];
    mockHooks("voting", {
      snapshot: {
        ...snapshotForPhase("voting"),
        playerCount: players.length,
        players,
      },
      currentUserId: "u1",
      privateRole: { role: "seer", roleNameBg: "Гадателка" },
      privateLover: { loverUserId: "u2", loverName: "Борил" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    expect(screen.queryByRole("button", { name: /Избери Борил:/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Избери Рада:/ })).toBeInTheDocument();
    expect(screen.getByTestId("voting-panel")).toHaveAttribute("data-targets", "u1,u3");
  });

  it("sends nominations only from the current Sport Mafia speaker panel", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Антон" },
      { ...player, userId: "u2", displayName: "Вера", host: false },
      { ...player, userId: "u3", displayName: "Камен", host: false },
    ];
    mockHooks("day_discussion", {
      room: { send, onMessage: vi.fn() },
      snapshot: {
        ...snapshotForPhase("day_discussion"),
        mode: "mafia_sport",
        playerCount: players.length,
        players,
        currentSpeakerUserId: "u1",
        currentDefenseUserId: "",
        nominations: [{ nominatorUserId: "u1", targetUserId: "u2" }],
      },
      currentUserId: "u1",
      privateRole: { role: "civilian", roleNameBg: "Гражданин" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "mafia_sport" }} />);

    expect(screen.getByRole("heading", { level: 2, name: "Твоята 60-секундна реч" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Избери Камен:/ }));
    await user.click(screen.getByRole("button", { name: "Смени" }));
    expect(send).toHaveBeenCalledWith("submitNomination", { targetUserId: "u3" });
  });

  it.each([
    ["day_discussion", "Дневни речи", ""],
    ["nomination", "Преглед на номинациите", ""],
    ["defense", "Вера защитава мястото си", "u2"],
  ] as const)("labels the Sport Mafia %s dock explicitly", (phase, heading, currentDefenseUserId) => {
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Антон" },
      { ...player, userId: "u2", displayName: "Вера", host: false },
    ];
    mockHooks(phase, {
      snapshot: {
        ...snapshotForPhase(phase),
        mode: "mafia_sport",
        playerCount: players.length,
        players,
        currentSpeakerUserId: phase === "day_discussion" ? "u2" : "",
        currentDefenseUserId,
        nominations: [{ nominatorUserId: "u1", targetUserId: "u2" }],
      },
      currentUserId: "u1",
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "mafia_sport" }} />);

    expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Номинирай|Смени)$/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Номинациите са отворени")).not.toBeInTheDocument();
  });

  it("supports number selection and Enter confirmation for a Sport Mafia nomination", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Антон" },
      { ...player, userId: "u2", displayName: "Вера", host: false },
      { ...player, userId: "u3", displayName: "Камен", host: false },
    ];
    mockHooks("day_discussion", {
      room: { send, onMessage: vi.fn() },
      snapshot: {
        ...snapshotForPhase("day_discussion"),
        mode: "mafia_sport",
        playerCount: players.length,
        players,
        currentSpeakerUserId: "u1",
        nominations: [],
      },
      currentUserId: "u1",
      privateRole: { role: "civilian", roleNameBg: "Гражданин" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "mafia_sport" }} />);

    await user.keyboard("1{Enter}");
    expect(send).toHaveBeenCalledWith("submitNomination", { targetUserId: "u2" });
  });

  it("arms only nominated seats during Sport Mafia voting", () => {
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Антон" },
      { ...player, userId: "u2", displayName: "Вера", host: false },
      { ...player, userId: "u3", displayName: "Камен", host: false },
    ];
    mockHooks("voting", {
      snapshot: {
        ...snapshotForPhase("voting"),
        mode: "mafia_sport",
        playerCount: players.length,
        players,
        nominations: [{ nominatorUserId: "u1", targetUserId: "u2" }],
      },
      currentUserId: "u1",
      privateRole: { role: "civilian", roleNameBg: "Гражданин" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "mafia_sport" }} />);

    expect(screen.getByRole("button", { name: /Избери Вера:/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Избери Камен:/ })).not.toBeInTheDocument();
  });

  it("keeps a nominee's draft distinct from the server-accepted vote", async () => {
    const user = userEvent.setup();
    const callbacks = new Map<string, (message: unknown) => void>();
    const send = vi.fn();
    const players = [player, { ...player, userId: "u2", displayName: "Вера", host: false },
      { ...player, userId: "u3", displayName: "Камен", host: false }];
    mockHooks("voting", {
      room: { send, onMessage: (event: string, callback: (message: unknown) => void) => {
        callbacks.set(event, callback);
        return () => callbacks.delete(event);
      } },
      snapshot: { ...snapshotForPhase("voting"), mode: "mafia_sport", players, playerCount: 3,
        nominations: [{ nominatorUserId: "u1", targetUserId: "u2" }, { nominatorUserId: "u2", targetUserId: "u3" }] },
    });
    render(<PlayRoomClient code="ABCD" />);
    const vera = screen.getByRole("button", { name: "Избери Вера за гласуване" });
    await user.click(vera);
    expect(screen.getByRole("button", { name: /Избери Вера:/ })).toHaveAttribute("aria-pressed", "true");
    expect(send).not.toHaveBeenCalledWith("submitVote", expect.anything());
    expect(screen.queryByText(/Приет глас/)).not.toBeInTheDocument();
    act(() => callbacks.get("vote_ack")?.({ phase: "voting", round: 1, targetUserId: "u2" }));
    expect(screen.getByText("Приет глас: Вера")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Избери Камен за гласуване" }));
    expect(vera).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Приет глас: Вера")).toBeVisible();
    expect(send).not.toHaveBeenCalledWith("submitVote", expect.anything());
  });

  it("keeps mobile inline deselection open without pointer focus and honors explicit collapse", () => {
    setCompactViewport(true);
    const players = [player, { ...player, userId: "u2", displayName: "Вера", host: false }];
    const snapshot = {
      ...snapshotForPhase("voting"), mode: "mafia_sport" as const, players, playerCount: 2,
      nominations: [{ nominatorUserId: "u1", targetUserId: "u2" }],
    };
    mockHooks("voting", { snapshot });
    const { rerender } = render(<PlayRoomClient code="ABCD" />);
    const dock = document.querySelector(".play-action-dock");
    expect(dock).toHaveAttribute("data-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "Покажи личния ход" }));
    const nominee = screen.getByRole("button", { name: "Избери Вера за гласуване" });
    // Pointer activation in WebKit does not focus the clicked button.
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(nominee);
    fireEvent.click(nominee);
    expect(nominee).toHaveAttribute("aria-pressed", "false");
    expect(dock).toHaveAttribute("data-expanded", "true");

    fireEvent.click(nominee);
    fireEvent.click(screen.getByRole("button", { name: "Скрий личния ход" }));
    mockHooks("voting", { snapshot: { ...snapshot, phaseEndsAt: 5000 } });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(dock).toHaveAttribute("data-expanded", "false");
    expect(screen.getByRole("button", { name: /Избери Вера:/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not retain the inline deselection preference into the next mobile phase", () => {
    setCompactViewport(true);
    const players = [player, { ...player, userId: "u2", displayName: "Вера", host: false }];
    const snapshot = {
      ...snapshotForPhase("voting"), mode: "mafia_sport" as const, players, playerCount: 2,
      nominations: [{ nominatorUserId: "u1", targetUserId: "u2" }],
    };
    const privateRole = { role: "mafioso", roleNameBg: "Мафиот" };
    mockHooks("voting", { snapshot, privateRole });
    const { rerender } = render(<PlayRoomClient code="ABCD" />);
    fireEvent.click(screen.getByRole("button", { name: "Покажи личния ход" }));
    const nominee = screen.getByRole("button", { name: "Избери Вера за гласуване" });
    fireEvent.click(nominee);
    fireEvent.click(nominee);
    expect(document.querySelector(".play-action-dock")).toHaveAttribute("data-expanded", "true");

    mockHooks("night", { snapshot: { ...snapshot, phase: "night" }, privateRole });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(document.querySelector(".play-action-dock")).toHaveAttribute("data-expanded", "false");
  });

  it("keeps mobile two-target actions collapsed until both seats are selected", () => {
    setCompactViewport(true);
    const players = [player, { ...player, userId: "u2", displayName: "Борил", host: false },
      { ...player, userId: "u3", displayName: "Рада", host: false }];
    mockHooks("first_night", {
      snapshot: { ...snapshotForPhase("first_night"), players, playerCount: 3 },
      privateRole: { role: "blacksmith", roleNameBg: "Ковач" },
    });
    render(<PlayRoomClient code="ABCD" />);
    const dock = document.querySelector(".play-action-dock");
    const primary = screen.getByRole("button", { name: /Избери Борил:/ });
    const secondary = screen.getByRole("button", { name: /Избери Рада:/ });
    expect(dock).toHaveAttribute("data-expanded", "false");
    fireEvent.click(primary);
    expect(dock).toHaveAttribute("data-expanded", "false");
    fireEvent.click(secondary);
    expect(dock).toHaveAttribute("data-expanded", "true");
    fireEvent.click(secondary);
    expect(dock).toHaveAttribute("data-expanded", "false");
    fireEvent.click(secondary);
    expect(dock).toHaveAttribute("data-expanded", "true");
    fireEvent.click(primary);
    expect(dock).toHaveAttribute("data-expanded", "false");
    expect(screen.getByTestId("night-action")).toHaveTextContent("|");
  });

  it("clears the accepted vote in the dock when only the authoritative voting cycle changes", () => {
    const callbacks = new Map<string, (message: unknown) => void>();
    const room = {
      send: vi.fn(),
      onMessage: (event: string, callback: (message: unknown) => void) => {
        callbacks.set(event, callback);
        return () => callbacks.delete(event);
      },
    };
    const snapshot = { ...snapshotForPhase("voting"), votingCycle: 2, revoteEligibleUserIds: ["u1", "u2"] };
    mockHooks("voting", { room, snapshot });
    const { rerender } = render(<PlayRoomClient code="ABCD" />);
    act(() => callbacks.get("vote_ack")?.({ phase: "voting", round: 1, votingCycle: 2, targetUserId: "u1" }));
    expect(screen.getByText(/Приет глас/)).toBeVisible();

    mockHooks("voting", { room, snapshot: { ...snapshot, phaseEndsAt: 5000 } });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(screen.getByText(/Приет глас/)).toBeVisible();

    mockHooks("voting", { room, snapshot: { ...snapshot, votingCycle: 3, phaseEndsAt: 5000 } });
    rerender(<PlayRoomClient code="ABCD" />);
    expect(screen.queryByText(/Приет глас/)).not.toBeInTheDocument();
  });

  it("restricts a revote to tied seats and hides the skip action", () => {
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Искра" },
      { ...player, userId: "u2", displayName: "Борил", host: false },
      { ...player, userId: "u3", displayName: "Рада", host: false },
    ];
    mockHooks("voting", {
      snapshot: {
        ...snapshotForPhase("voting"),
        playerCount: players.length,
        players,
        allowSkipVote: true,
        revoteEligibleUserIds: ["u1", "u2"],
      },
      currentUserId: "u1",
      privateRole: { role: "seer", roleNameBg: "Гадателка" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    expect(screen.getByRole("button", { name: /Избери Борил:/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Избери Рада:/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("voting-panel")).toHaveAttribute("data-targets", "u1,u2");
    expect(screen.getByTestId("voting-panel")).toHaveAttribute("data-skip", "false");
  });

  it("falls back to create options for Doctor self-protection when the public snapshot omits the field", () => {
    const players: PublicPlayer[] = [
      { ...player, userId: "u1", displayName: "Искра" },
      { ...player, userId: "u2", displayName: "Борил", host: false },
    ];
    const { doctorCanSelfProtect: _omitted, ...snapshotWithoutDoctorOption } = snapshotForPhase("night");
    mockHooks("night", {
      snapshot: {
        ...snapshotWithoutDoctorOption,
        playerCount: players.length,
        players,
      },
      currentUserId: "u1",
      privateRole: { role: "doctor", roleNameBg: "Доктор" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "mafia_sport", doctorCanSelfProtect: true }} />);

    expect(screen.getByTestId("night-action")).toHaveAttribute("data-doctor-self", "true");
  });
});
