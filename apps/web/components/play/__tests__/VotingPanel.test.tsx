import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VotingPanel } from "@/components/play/VotingPanel";
import { avatarIdForUser } from "@/lib/avatar-catalog";
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
  it("distinguishes a selected vote from the server-accepted vote without confirming on click", async () => {
    const sendVote = vi.fn();
    const props = { currentUserId: "u1", livingPlayers, voteTally: [], allowSkipVote: false, sendVote };
    const { rerender, container } = render(<VotingPanel {...props} selectedTargetId="u2" />);
    expect(container.querySelector('[data-vote-state="selected"]')).toBeInTheDocument();
    expect(screen.getByText("Още не е потвърден")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Потвърди гласа за Борис" }));
    expect(sendVote).toHaveBeenCalledExactlyOnceWith("u2");
    expect(screen.getByText("Още не е потвърден")).toBeVisible();
    expect(screen.queryByText("Гласът е приет")).not.toBeInTheDocument();

    rerender(<VotingPanel {...props} selectedTargetId="u2" acceptedTargetId="u2" />);
    expect(container.querySelector('[data-vote-state="confirmed"]')).toBeInTheDocument();
    expect(screen.getByText("Потвърден глас")).toBeVisible();
    expect(screen.getByText("Гласът е приет")).toBeVisible();
    expect(screen.queryByText("Още не е потвърден")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Потвърди гласа за Борис" })).toBeEnabled();

    rerender(<VotingPanel {...props} selectedTargetId="u3" acceptedTargetId="u2" />);
    expect(screen.getByText("Още не е потвърден")).toBeVisible();
    expect(screen.queryByText("Гласът е приет")).not.toBeInTheDocument();
    rerender(<VotingPanel {...props} selectedTargetId="u2" acceptedTargetId="u2" />);
    expect(screen.getByText("Гласът е приет")).toBeVisible();
    rerender(<VotingPanel {...props} selectedTargetId="u2" />);
    expect(screen.getByText("Още не е потвърден")).toBeVisible();
  });

  it.each(["", "u1", "missing"])("does not render a confirmed vote or avatar for an invalid selection %s", (target) => {
    const { container } = render(<VotingPanel currentUserId="u1" livingPlayers={livingPlayers} selectedTargetId={target} acceptedTargetId={target} voteTally={[]} allowSkipVote={false} sendVote={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Потвърди гласа" })).toBeDisabled();
    expect(container.querySelector('[data-vote-state="empty"]')).toBeInTheDocument();
    expect(container.querySelector("[data-avatar-id]")).toBeNull();
    expect(screen.queryByText("Гласът е приет")).not.toBeInTheDocument();
    expect(screen.queryByText("Още не е потвърден")).not.toBeInTheDocument();
  });

  it("uses the same public avatar as the table, with a stable fallback and no revealed-role inference", () => {
    const props = { currentUserId: "u1", selectedTargetId: "u2", voteTally: [], allowSkipVote: false, sendVote: vi.fn() };
    const { container, rerender } = render(<VotingPanel {...props} livingPlayers={livingPlayers} />);
    expect(container.querySelector("[data-avatar-id]")).toHaveAttribute("data-avatar-id", avatarIdForUser("u2"));
    rerender(<VotingPanel {...props} livingPlayers={livingPlayers.map((p) => p.userId === "u2" ? { ...p, avatarId: "portrait-f02", revealedRole: "werewolf" } : p)} />);
    expect(container.querySelector("[data-avatar-id]")).toHaveAttribute("data-avatar-id", "portrait-f02");
    expect(container.querySelector("[data-avatar-id]")).toHaveAttribute("aria-hidden", "true");
    expect(container.innerHTML).not.toContain("role-werewolf");
  });

  it("does not mistake an accepted skip for the selected player vote", () => {
    render(<VotingPanel currentUserId="u1" livingPlayers={livingPlayers} selectedTargetId="u2" acceptedTargetId="skip" voteTally={[]} allowSkipVote sendVote={vi.fn()} />);
    expect(screen.getByText("Още не е потвърден")).toBeVisible();
    expect(screen.getByRole("button", { name: "Пропусни глас" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Гласът е приет")).not.toBeInTheDocument();
  });

  it("disarms skip after voting for the selected player and requires a fresh confirmation to skip", async () => {
    const user = userEvent.setup();
    const sendVote = vi.fn();
    render(
      <VotingPanel
        currentUserId="u1"
        livingPlayers={livingPlayers}
        selectedTargetId="u2"
        voteTally={[]}
        allowSkipVote
        sendVote={sendVote}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Пропусни глас" }));
    expect(screen.getByRole("button", { name: "Потвърди пропускането" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Потвърди гласа за Борис" }));

    expect(sendVote).toHaveBeenCalledExactlyOnceWith("u2");
    const skip = screen.getByRole("button", { name: "Пропусни глас" });
    expect(skip).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Избран играч")).toBeInTheDocument();
    expect(screen.getByText("Борис")).toBeInTheDocument();

    await user.click(skip);
    expect(sendVote).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Потвърди пропускането" }));
    expect(sendVote.mock.calls).toEqual([["u2"], ["skip"]]);
  });

  it("uses a stable confirmation caption and does not describe an empty selection as selected", () => {
    const props = { currentUserId: "u1", livingPlayers, voteTally: [], allowSkipVote: false, sendVote: vi.fn() };
    const { rerender } = render(<VotingPanel {...props} selectedTargetId="" />);
    expect(screen.getByRole("button", { name: "Потвърди гласа" })).toBeDisabled();
    expect(screen.queryByText("Избрано място")).not.toBeInTheDocument();
    rerender(<VotingPanel {...props} selectedTargetId="u2" />);
    expect(screen.getByRole("button", { name: "Потвърди гласа за Борис" })).toHaveTextContent(/^Потвърди гласа$/);
    rerender(<VotingPanel {...props} selectedTargetId="u1" />);
    expect(screen.getByRole("button", { name: "Потвърди гласа" })).toBeDisabled();
  });

  it("keeps the full tally behind a disclosure without hiding the vote action", async () => {
    render(<VotingPanel currentUserId="u1" livingPlayers={livingPlayers} selectedTargetId="u2" voteTally={voteTally} allowSkipVote={false} sendVote={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Потвърди гласа за Борис" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Текущо броене на гласовете" })).not.toBeVisible();
    await userEvent.click(screen.getByText("Преброяване", { exact: true }));
    expect(screen.getByRole("region", { name: "Текущо броене на гласовете" })).toBeVisible();
  });
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

  it("requires a second deliberate click before sending an allowed skip vote", async () => {
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

    expect(sendVote).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Потвърди пропускането" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Потвърди пропускането" }));

    expect(sendVote).toHaveBeenCalledWith("skip");
  });
});
