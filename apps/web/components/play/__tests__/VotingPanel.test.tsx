import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VotingPanel } from "@/components/play/VotingPanel";
import type { PublicPlayer, VoteTallyItem } from "@/lib/play/types";

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

const livingPlayers = [
  player({ userId: "u1", displayName: "Анна" }),
  player({ userId: "u2", displayName: "Борис" }),
  player({ userId: "u3", displayName: "Вяра" }),
];

const voteTally: VoteTallyItem[] = [
  { targetUserId: "u2", targetName: "Борис", count: 2, hasMayorVote: false },
  { targetUserId: "u3", targetName: "Вяра", count: 1, hasMayorVote: true },
];

describe("VotingPanel", () => {
  it("shows the selected table target instead of duplicating the roster", () => {
    render(
      <VotingPanel
        currentUserId="u1"
        livingPlayers={livingPlayers}
        selectedTargetId="u2"
        voteTally={voteTally}
        allowSkipVote={false}
        sendVote={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Анна" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Потвърди гласа за Борис" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Вяра" })).not.toBeInTheDocument();
  });

  it("sends a vote for the selected table target", async () => {
    const user = userEvent.setup();
    const sendVote = vi.fn();

    render(
      <VotingPanel
        currentUserId="u1"
        livingPlayers={livingPlayers}
        selectedTargetId="u2"
        voteTally={voteTally}
        allowSkipVote={false}
        sendVote={sendVote}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Потвърди гласа за Борис" }));

    expect(sendVote).toHaveBeenCalledWith("u2");
  });

  it("sends a skip vote only when skipping is allowed", async () => {
    const user = userEvent.setup();
    const sendVote = vi.fn();

    const { rerender } = render(
      <VotingPanel
        currentUserId="u1"
        livingPlayers={livingPlayers}
        selectedTargetId=""
        voteTally={[]}
        allowSkipVote={false}
        sendVote={sendVote}
      />,
    );

    expect(screen.queryByRole("button", { name: "Пропусни глас" })).not.toBeInTheDocument();

    rerender(
      <VotingPanel
        currentUserId="u1"
        livingPlayers={livingPlayers}
        selectedTargetId=""
        voteTally={[]}
        allowSkipVote
        sendVote={sendVote}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Пропусни глас" }));

    expect(sendVote).toHaveBeenCalledWith("skip");
  });
});
