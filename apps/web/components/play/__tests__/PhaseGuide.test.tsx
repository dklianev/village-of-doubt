import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhaseGuide } from "../PhaseGuide";
import type { PublicPlayer } from "@/lib/play/types";

const player: PublicPlayer = {
  userId: "anna", displayName: "Анна", connected: true, ready: true,
  playing: true, alive: true, host: false, narrator: false,
  acceptedFullNarrator: true, mayor: false, hasVoted: false,
  actedThisPhase: false, revealedRole: "",
};

describe("PhaseGuide personal guidance", () => {
  it("shows spectator guidance even without a private role", () => {
    render(<PhaseGuide phase="night" mode="mafia_free" privateRole={undefined} ownPlayer={{ ...player, playing: false }} />);
    expect(screen.getByText(/Ти наблюдаваш играта/u)).toBeInTheDocument();
    expect(screen.queryByText(/Ролята ти още/u)).not.toBeInTheDocument();
  });

  it("shows narrator guidance instead of awaiting a role", () => {
    render(<PhaseGuide phase="night" mode="werewolves_classic" privateRole={undefined} ownPlayer={{ ...player, playing: false, narrator: true }} />);
    expect(screen.getByText(/Ти си Разказвачът/u)).toBeInTheDocument();
    expect(screen.queryByText(/Ролята ти още/u)).not.toBeInTheDocument();
  });

  it("keeps elimination guidance when private-role data has not arrived", () => {
    render(<PhaseGuide phase="voting" mode="werewolves_classic" privateRole={undefined} ownPlayer={{ ...player, alive: false }} />);
    expect(screen.getByText(/Ти си елиминиран/u)).toBeInTheDocument();
    expect(screen.queryByText(/Ролята ти още/u)).not.toBeInTheDocument();
  });

  it("waits for private role data for an active participant", () => {
    render(<PhaseGuide phase="role_reveal" mode="werewolves_classic" privateRole={undefined} ownPlayer={player} />);
    expect(screen.getByText(/Ролята ти още/u)).toBeInTheDocument();
  });
});
