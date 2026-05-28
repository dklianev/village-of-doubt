import { render, screen } from "@testing-library/react";
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

vi.mock("@/components/play/PlayerTile", () => ({
  PlayerTile: ({ player }: { player: PublicPlayer }) => <div>{player.displayName}</div>,
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
  NightActionPanel: () => <div data-testid="night-action" />,
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
});
