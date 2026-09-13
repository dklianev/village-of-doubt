import type { Room } from "@colyseus/sdk";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NarratorDesk } from "@/components/play/NarratorDesk";
import type { GameSnapshot, PublicPlayer } from "@/lib/play/types";

function player(overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    userId: "u1",
    displayName: "Анна",
    connected: true,
    ready: true,
    playing: true,
    alive: true,
    host: false,
    narrator: false,
    acceptedFullNarrator: true,
    mayor: false,
    hasVoted: false,
    actedThisPhase: false,
    revealedRole: "",
    ...overrides,
  };
}

function snapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  const players = [
    player({ userId: "u1", displayName: "Анна", actedThisPhase: true, hasVoted: true }),
    player({ userId: "u2", displayName: "Борис", acceptedFullNarrator: false }),
    player({ userId: "u3", displayName: "Вяра", playing: false }),
  ];

  return {
    code: "ABCD",
    mode: "werewolves_classic",
    playerCount: 3,
    narratorMode: "full_human",
    communicationMode: "built_in_chat",
    tempoProfile: "normal",
    dayDiscussionSeconds: 90,
    voteSeconds: 45,
    revealRolesOnDeath: true,
    loversEnabled: true,
    doctorCanSelfProtect: false,
    allowSkipVote: true,
    majorityMode: "simple",
    narratorVoice: "classic",
    phase: "night",
    round: 1,
    phaseEndsAt: 0,
    winnerTeam: "",
    winnerReasonBg: "",
    players,
    roleCounts: [],
    voteTally: [],
    publicEvents: [],
    publicChat: [],
    ...overrides,
  };
}

function room(send = vi.fn()): Room {
  return { send } as unknown as Room;
}

describe("NarratorDesk", () => {
  it("summarizes the current narrator state", () => {
    render(
      <NarratorDesk
        room={room()}
        snapshot={snapshot()}
        phase="night"
        family="werewolves"
        isNarrator
        onOpenShortcuts={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Водиш играта" })).toBeInTheDocument();
    expect(screen.getByText("Активни")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByText("Живи")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("Остава 1 участник да приеме, че Пълният Разказвач вижда всички роли.")).toBeInTheDocument();
  });

  it("routes narrator controls through room commands", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const onOpenShortcuts = vi.fn();

    render(
      <NarratorDesk
        room={room(send)}
        snapshot={snapshot({ phaseEndsAt: Date.now() + 60_000 })}
        phase="night"
        family="werewolves"
        isNarrator={false}
        onOpenShortcuts={onOpenShortcuts}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Пауза/ }));
    await user.click(screen.getByRole("button", { name: /Следваща фаза/ }));
    await user.click(screen.getByRole("button", { name: /\+60 сек\./ }));
    await user.click(screen.getByRole("button", { name: /Клавишни команди/ }));

    expect(send).toHaveBeenCalledWith("narratorPause");
    expect(send).toHaveBeenCalledWith("narratorAdvance");
    expect(send).toHaveBeenCalledWith("narratorExtendTimer", { seconds: 60 });
    expect(onOpenShortcuts).toHaveBeenCalledTimes(1);
  });

  it("disables phase-changing actions without a room connection", () => {
    render(
      <NarratorDesk
        room={null}
        snapshot={snapshot({ narratorMode: "automatic" })}
        phase="night"
        family="werewolves"
        isNarrator={false}
        onOpenShortcuts={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Пауза/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Следваща фаза/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /\+30 сек\./ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Клавишни команди/ })).toBeEnabled();
  });

  it("describes host controls without internal architecture copy", () => {
    render(<NarratorDesk room={room()} snapshot={snapshot()} phase="night" family="werewolves" isNarrator={false} onOpenShortcuts={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Управление на домакина" })).toBeInTheDocument();
    expect(screen.queryByText(/скрити клиентски решения|събития за проверка/u)).not.toBeInTheDocument();
  });

  it("excludes spectators from full-narrator consent, but includes the narrator", () => {
    render(<NarratorDesk room={room()} snapshot={snapshot({ players: [
      player({ userId: "player" }),
      player({ userId: "narrator", playing: false, narrator: true, acceptedFullNarrator: false }),
      player({ userId: "spectator", playing: false, acceptedFullNarrator: false }),
    ] })} phase="lobby" family="werewolves" isNarrator onOpenShortcuts={vi.fn()} />);
    expect(screen.getByText("Остава 1 участник да приеме, че Пълният Разказвач вижда всички роли.")).toBeInTheDocument();
  });

  it("counts only living players as eligible voters", () => {
    render(<NarratorDesk room={room()} snapshot={snapshot({ players: [
      player({ userId: "voter", hasVoted: true }),
      player({ userId: "waiting" }),
      player({ userId: "dead", alive: false, hasVoted: true }),
    ] })} phase="voting" family="werewolves" isNarrator onOpenShortcuts={vi.fn()} />);
    expect(screen.getByText("Гласували").parentElement).toHaveTextContent("1/2");
  });

  it("does not offer timer extensions when the phase has no timer", () => {
    render(<NarratorDesk room={room()} snapshot={snapshot()} phase="night" family="werewolves" isNarrator onOpenShortcuts={vi.fn()} />);
    expect(screen.getByRole("button", { name: /\+30 сек\./ })).toBeDisabled();
  });

  it("labels the paused advance command as resuming the same phase", async () => {
    const send = vi.fn();
    render(<NarratorDesk room={room(send)} snapshot={snapshot()} phase="paused" family="werewolves" isNarrator onOpenShortcuts={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Продължи играта" }));
    expect(send).toHaveBeenCalledWith("narratorAdvance");
    expect(screen.queryByRole("button", { name: "Следваща фаза" })).not.toBeInTheDocument();
  });

  it("disables phase controls after the game ends", () => {
    render(<NarratorDesk room={room()} snapshot={snapshot()} phase="game_over" family="werewolves" isNarrator onOpenShortcuts={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Пауза" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Следваща фаза" })).toBeDisabled();
  });
});
