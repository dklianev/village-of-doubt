import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { GamePhase } from "@werewolf/shared";
import { PlayRoomClient } from "@/components/play-room-client";
import type { GameSnapshot, PublicPlayer } from "@/lib/play/types";

const mocks = vi.hoisted(() => ({
  useGameRoom: vi.fn(),
  useCueMode: vi.fn(),
  usePhaseTransitions: vi.fn(),
  reconnectNow: vi.fn(),
  requestStartGame: vi.fn(),
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
  useToast: () => vi.fn(),
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
  NarratorDesk: () => <div data-testid="narrator-desk" />,
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
  PrivateChatPanel: () => <div data-testid="private-chat" />,
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
    room: { send: vi.fn() },
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

describe("PlayRoomClient orchestrator", () => {
  beforeEach(() => {
    mocks.useGameRoom.mockReset();
    mocks.useCueMode.mockReset();
    mocks.usePhaseTransitions.mockReset();
    mocks.reconnectNow.mockReset();
    mocks.requestStartGame.mockReset();
    setCompactViewport(false);
    mockHooks();
  });

  it.each(["lobby", "night", "day_discussion", "voting", "game_over"] as GamePhase[])(
    "renders without crashing in %s phase",
    (phase) => {
      mockHooks(phase);

      render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

      expect(screen.getAllByText(/стая ABCD/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText("Играч").length).toBeGreaterThan(0);
    },
  );

  it("passes the room code and create options into useGameRoom", () => {
    const createOptions = { mode: "werewolves_classic" } as const;

    render(<PlayRoomClient code="ROOM42" createOptions={createOptions} />);

    expect(mocks.useGameRoom).toHaveBeenCalledWith(expect.objectContaining({
      code: "ROOM42",
      createOptions,
    }));
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

  it("keeps the private role dossier inline during desktop role reveal", async () => {
    mockHooks("role_reveal", {
      privateRole: { role: "seer", roleNameBg: "Гадателка" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Твоят таен ъгъл" })).toHaveAttribute("data-expanded", "true");
    });
    expect(screen.getByTestId("role-card")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Скрий личния ход" })).not.toBeInTheDocument();
  });

  it("marks explicit shell layout modes for CSS without relying on descendant selectors", () => {
    mockHooks("lobby");

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    expect(document.querySelector(".play-layout")).toHaveAttribute("data-has-narrator-deck", "true");
    expect(document.querySelector(".play-layout")).not.toHaveAttribute("data-stage-takeover");
  });

  it("lets the winner takeover own game over without private or narrator chrome", () => {
    mockHooks("game_over", {
      privateRole: { role: "seer", roleNameBg: "Гадателка" },
      narratorSnapshot: { players: [] },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    expect(screen.getByText("Селото печели")).toBeInTheDocument();
    expect(screen.getByTestId("post-game-story")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Повтори настройките" })).toHaveAttribute(
      "href",
      expect.stringContaining("/werewolf/create?"),
    );
    expect(screen.getByRole("link", { name: "Към архива" })).toHaveAttribute("href", "/history");
    expect(screen.queryByTestId("role-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("narrator-desk")).not.toBeInTheDocument();
    expect(screen.queryByTestId("narrator-snapshot")).not.toBeInTheDocument();
    expect(screen.queryByText("Пулсът на стаята")).not.toBeInTheDocument();
    expect(document.querySelector(".play-layout")).toHaveAttribute("data-stage-takeover", "true");
    expect(document.querySelector(".play-layout")).not.toHaveAttribute("data-has-narrator-deck");
  });

  it("links a persisted game-over scene directly to its replay", () => {
    mockHooks("game_over", { recordedGameId: "game-1" });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    expect(screen.getByRole("link", { name: "Виж записа на играта" })).toHaveAttribute(
      "href",
      "/history/game-1/replay",
    );
  });

  it("does not steal Enter from focused action dock controls", async () => {
    const user = userEvent.setup();
    setCompactViewport(true);
    mockHooks("lobby");

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    const toggle = await screen.findByRole("button", { name: "Покажи личния ход" });
    toggle.focus();
    await user.keyboard("{Enter}");

    expect(toggle).toHaveAttribute("aria-expanded", "true");
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
      room: { send },
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

  it("keeps Space available for page scrolling and pauses with the physical P key", () => {
    const send = vi.fn();
    mockHooks("night", { room: { send } });

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

  it("does not arm voting seats or show the voting panel for an eliminated viewer", () => {
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
    expect(screen.getByTestId("role-card")).toBeInTheDocument();
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
      room: { send },
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

    await user.click(screen.getByRole("button", { name: /Избери Камен:/ }));
    await user.click(screen.getByRole("button", { name: "Смени" }));
    expect(send).toHaveBeenCalledWith("submitNomination", { targetUserId: "u3" });
  });

  it.each([
    ["nomination", "Номинациите са отворени", ""],
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
        currentDefenseUserId,
        nominations: [{ nominatorUserId: "u1", targetUserId: "u2" }],
      },
      currentUserId: "u1",
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "mafia_sport" }} />);

    expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
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
      room: { send },
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
