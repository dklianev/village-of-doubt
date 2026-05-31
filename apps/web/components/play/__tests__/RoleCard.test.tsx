import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoleCard } from "@/components/play/RoleCard";
import type { PublicPlayer } from "@/lib/play/types";

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

const players = [
  player({ userId: "u1", displayName: "Анна" }),
  player({ userId: "u2", displayName: "Борис" }),
];

describe("RoleCard", () => {
  it("stays hidden until the server sends the private role", () => {
    const { container } = render(<RoleCard role={null} result={null} players={players} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the private role guide without exposing other players", () => {
    render(<RoleCard role={{ role: "seer", roleNameBg: "Ясновидка" }} result={null} players={players} />);

    expect(screen.getByText("само за теб")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ясновидка" })).toBeInTheDocument();
    expect(screen.getByText("Отбор")).toBeInTheDocument();
    expect(screen.getByText("Кога действа")).toBeInTheDocument();
    expect(screen.getByText("Цел")).toBeInTheDocument();
    expect(screen.getByText(/чуждите тайни роли не са в публичното състояние/)).toBeInTheDocument();
  });

  it("formats private investigation results against the public player list", () => {
    render(
      <RoleCard
        role={{ role: "commissioner", roleNameBg: "Комисар" }}
        result={{ targetUserId: "u2", isEvil: true }}
        players={players}
      />,
    );

    expect(screen.getByText("Борис е от злата страна.")).toBeInTheDocument();
  });
});
