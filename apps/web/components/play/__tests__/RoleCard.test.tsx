import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoleCard } from "@/components/play/RoleCard";
import type { PublicPlayer } from "@/lib/play/types";

const roleCardCss = readFileSync(resolve(process.cwd(), "components/play/RoleCard.module.css"), "utf8");

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

  it("renders the private role guide as a private dossier without implementation copy", () => {
    render(<RoleCard role={{ role: "seer", roleNameBg: "Ясновидка" }} result={null} players={players} />);

    expect(screen.getByText("само за теб")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ясновидка" })).toBeInTheDocument();
    expect(screen.getByText("Отбор")).toBeInTheDocument();
    expect(screen.getByText("Кога действа")).toBeInTheDocument();
    expect(screen.getByText("Цел")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Тайна роля: Ясновидка" })).toHaveAttribute("data-private-dossier", "true");
    expect(screen.queryByText(/публичното състояние|инструментите на браузъра|мрежовите заявки/)).not.toBeInTheDocument();
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

  it("uses the active game family for roles shared by both games", () => {
    const { container } = render(
      <RoleCard
        role={{ role: "jester", roleNameBg: "Шут" }}
        result={null}
        players={players}
        family="mafia"
      />,
    );

    expect(container.querySelector('[data-role-family="mafia"]')).toBeInTheDocument();
  });

  it("uses the full role artwork inside a seamless theme-aware dossier", () => {
    render(<RoleCard role={{ role: "seer", roleNameBg: "Ясновидка" }} result={null} players={players} />);

    const dossier = screen.getByRole("article", { name: "Тайна роля: Ясновидка" });
    expect(dossier.getAttribute("style")).toContain('/game-art/role-seer.webp');
    expect(dossier.getAttribute("style")).not.toContain('/thumbs/');
    expect(roleCardCss).toMatch(/\.art\s*\{[\s\S]*?mask-image:\s*linear-gradient/);
    expect(roleCardCss).toContain(':global(html[data-theme="light"]) .dossier');
    expect(roleCardCss).toContain(':global(html[data-theme="dark"]) .dossier');
    expect(roleCardCss).not.toMatch(/overflow-y:\s*(?:auto|scroll)/);
  });
});
