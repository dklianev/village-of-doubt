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
    expect(screen.getByText("Действали")).toBeInTheDocument();
    expect(screen.getAllByText("1/2")).toHaveLength(2);
    expect(screen.getByText("Изчакват се 1 играчи да приемат, че Пълният Разказвач вижда всички роли.")).toBeInTheDocument();
  });

  it("routes narrator controls through room commands", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const onOpenShortcuts = vi.fn();

    render(
      <NarratorDesk
        room={room(send)}
        snapshot={snapshot()}
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
});
