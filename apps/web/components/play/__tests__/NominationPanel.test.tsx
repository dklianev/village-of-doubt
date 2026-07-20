import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NominationPanel } from "@/components/play/NominationPanel";
import type { PublicPlayer } from "@/lib/play/types";

const players: PublicPlayer[] = [
  player("speaker", "Антон"),
  player("target-1", "Вера"),
  player("target-2", "Камен"),
];

describe("NominationPanel", () => {
  it("lets only the authorized speaker submit and replace a nomination", async () => {
    const user = userEvent.setup();
    const onNominate = vi.fn();
    const { rerender } = render(
      <NominationPanel
        phase="day_discussion"
        players={players}
        currentUserId="speaker"
        currentSpeakerUserId="speaker"
        currentDefenseUserId=""
        nominations={[]}
        canNominate
        selectedTargetId="target-1"
        onNominate={onNominate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Номинирай" }));
    expect(onNominate).toHaveBeenCalledWith("target-1");

    rerender(
      <NominationPanel
        phase="day_discussion"
        players={players}
        currentUserId="speaker"
        currentSpeakerUserId="speaker"
        currentDefenseUserId=""
        nominations={[{ nominatorUserId: "speaker", targetUserId: "target-1" }]}
        canNominate
        selectedTargetId="target-2"
        onNominate={onNominate}
      />,
    );
    expect(screen.getByRole("button", { name: "Смени" })).toBeInTheDocument();
    expect(screen.getByText("1. Вера")).toBeInTheDocument();
  });

  it("shows unique public nominees and the current defense without action controls", () => {
    render(
      <NominationPanel
        phase="defense"
        players={players}
        currentUserId="target-2"
        currentSpeakerUserId=""
        currentDefenseUserId="target-1"
        nominations={[
          { nominatorUserId: "speaker", targetUserId: "target-1" },
          { nominatorUserId: "target-2", targetUserId: "target-1" },
        ]}
        canNominate={false}
        selectedTargetId=""
        onNominate={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Защитава се Вера" })).toBeInTheDocument();
    expect(screen.getAllByText("1. Вера")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Номинирай|Смени/ })).not.toBeInTheDocument();
  });
});

function player(userId: string, displayName: string): PublicPlayer {
  return {
    userId,
    displayName,
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
  };
}
