import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayStage } from "@/components/play/PlayStage";
import type { PublicPlayer } from "@/lib/play/types";

const PRIVATE_CANARY = "PRIVATE-CANARY-ROLE-CAPABILITIES";

function publicPlayer(): PublicPlayer {
  return {
    userId: "viewer-1",
    displayName: "Искра",
    connected: true,
    ready: true,
    playing: true,
    alive: true,
    host: false,
    narrator: false,
    acceptedFullNarrator: false,
    mayor: false,
    hasVoted: false,
    actedThisPhase: true,
    revealedRole: "",
  };
}

describe("PlayStage private-data boundary", () => {
  it("projects public seat fields and drops injected private canaries", () => {
    const injectedPlayer = Object.assign(publicPlayer(), {
      privateRole: PRIVATE_CANARY,
      privateResult: PRIVATE_CANARY,
      nightActionCapabilities: { canary: PRIVATE_CANARY },
    });

    const { container } = render(
      <PlayStage
        code="VISUAL"
        phase="night"
        mode="werewolves_classic"
        family="werewolves"
        round={2}
        phaseEndsAt={0}
        status=""
        isStatusInformative={false}
        isPending={false}
        players={[injectedPlayer]}
        hasSnapshot
        narratorMode="automatic"
        communicationMode="integrated_chat"
        ownPlayer={injectedPlayer}
        targetableIds={new Set()}
        selectedTargetId=""
        secondTargetId=""
        voteCounts={new Map()}
        onSelectSeat={vi.fn()}
        onMakeNarrator={vi.fn()}
        onMakeMayor={vi.fn()}
      />,
    );

    const stage = screen.getByRole("region", { name: "Нощ" });
    expect(stage).toHaveTextContent("Искра");
    expect(stage).not.toHaveTextContent(PRIVATE_CANARY);
    expect(stage.querySelector("[data-acted-this-phase]")).toBeNull();
    expect(container.innerHTML).not.toContain(PRIVATE_CANARY);
  });
});
