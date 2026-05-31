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
  VotingPanel: () => <div data-testid="voting-panel" />,
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
    status: "",
    setStatus: vi.fn(),
    connectionStatus: "connected",
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

describe("PlayRoomClient orchestrator", () => {
  beforeEach(() => {
    mocks.useGameRoom.mockReset();
    mocks.useCueMode.mockReset();
    mocks.usePhaseTransitions.mockReset();
    mocks.reconnectNow.mockReset();
    mocks.requestStartGame.mockReset();
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
      status: "Не успяхме да възстановим връзката автоматично.",
    });

    render(<PlayRoomClient code="ABCD" />);

    await userEvent.click(screen.getByRole("button", { name: "Опитай пак" }));

    expect(mocks.reconnectNow).toHaveBeenCalledTimes(1);
  });

  it("keeps the private role dock expanded during role reveal", async () => {
    mockHooks("role_reveal", {
      privateRole: { role: "seer", roleNameBg: "Гадателка" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    await waitFor(() => {
    expect(screen.getByRole("button", { name: "Скрий" })).toHaveAttribute("aria-expanded", "true");
    });
    expect(screen.getByTestId("role-card")).toBeInTheDocument();
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
    expect(screen.queryByTestId("role-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("narrator-desk")).not.toBeInTheDocument();
    expect(screen.queryByTestId("narrator-snapshot")).not.toBeInTheDocument();
    expect(screen.queryByText("Пулсът на стаята")).not.toBeInTheDocument();
    expect(document.querySelector(".play-layout")).toHaveAttribute("data-stage-takeover", "true");
    expect(document.querySelector(".play-layout")).not.toHaveAttribute("data-has-narrator-deck");
  });

  it("does not steal Enter from focused action dock controls", async () => {
    const user = userEvent.setup();
    mockHooks("role_reveal", {
      privateRole: { role: "seer", roleNameBg: "Гадателка" },
    });

    render(<PlayRoomClient code="ABCD" createOptions={{ mode: "werewolves_classic" }} />);

    const toggle = await screen.findByRole("button", { name: "Скрий" });
    toggle.focus();
    await user.keyboard("{Enter}");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("clears seat selection with Escape even when an action control is focused", async () => {
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

    await user.click(screen.getByRole("button", { name: "Избери Борил: онлайн" }));
    expect(screen.getByTestId("night-action")).toHaveTextContent("u2|");

    const toggle = await screen.findByRole("button", { name: "Скрий" });
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

    await user.click(screen.getByRole("button", { name: "Избери Борил: онлайн" }));
    expect(screen.getByTestId("night-action")).toHaveTextContent("u2|");

    await user.click(screen.getByRole("button", { name: "Избери Рада: онлайн" }));
    expect(screen.getByTestId("night-action")).toHaveTextContent("u2|u3");

    await user.click(screen.getByRole("button", { name: "Избери Борил: онлайн, избрана цел" }));
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

    expect(screen.queryByRole("button", { name: "Избери Борил: онлайн" })).not.toBeInTheDocument();
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

    expect(screen.queryByRole("button", { name: "Избери Борил: онлайн" })).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "Избери Борил: онлайн" }));
    expect(screen.getByRole("button", { name: "Избери Борил: онлайн, избрана цел" })).toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "Избери Борил: онлайн" })).not.toBeInTheDocument();
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

    expect(screen.getByRole("button", { name: "Избери Борил: онлайн" })).toBeInTheDocument();
    expect(screen.getByTestId("voting-panel")).toBeInTheDocument();
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
