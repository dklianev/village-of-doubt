import { render, screen } from "@testing-library/react";
import { ROLE_DEFINITIONS } from "@werewolf/shared";
import { describe, expect, it, vi } from "vitest";
import type { PublicPlayer } from "@/lib/play/types";
import * as roleArt from "@/lib/role-art";
import { DeathRevealCinematic } from "../DeathRevealCinematic";

function player(overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    userId: "fixture-player",
    displayName: "Fixture Player",
    connected: true,
    ready: true,
    playing: true,
    alive: false,
    host: false,
    narrator: false,
    acceptedFullNarrator: true,
    mayor: false,
    hasVoted: false,
    actedThisPhase: false,
    revealedRole: "seer",
    ...overrides,
  };
}

describe("death reveal artwork", () => {
  it.each([
    ["werewolves", "jester", "/game-art/role-jester-werewolf.webp"],
    ["mafia", "jester", "/game-art/mafia/role-jester.webp"],
    ["werewolves", "werewolf", "/game-art/role-werewolf.webp"],
    ["mafia", "doctor", "/game-art/mafia/role-doctor.webp"],
    ["werewolves", "doctor", "/game-art/mafia/role-doctor.webp"],
  ] as const)("resolves %s %s through its visual family", (family, role, pathname) => {
    const { container } = render(<DeathRevealCinematic family={family} players={[player({ revealedRole: role })]} />);
    const source = roleArt.roleArtSource(family, role);
    const picture = container.querySelector(".death-reveal-role-art")!;
    const image = picture.querySelector("img")!;

    expect(new URL(source.src, "https://assets.test").pathname).toBe(pathname);
    expect(picture.querySelector("source")).toHaveAttribute("srcset", source.src);
    expect(picture.querySelector("source")).toHaveAttribute("type", "image/webp");
    expect(image).toHaveAttribute("src", source.src);
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("width", "280");
    expect(image).toHaveAttribute("height", "392");
    expect(picture).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("article")).toHaveAttribute("data-family", family);
    expect(screen.getByRole("heading")).toHaveTextContent(ROLE_DEFINITIONS[role].nameBg);
  });

  it("preserves the helper revision in both picture sources", () => {
    const source = {
      ...roleArt.roleArtSource("werewolves", "jester"),
      src: "/game-art/role-jester-werewolf.webp?test-revision=updated",
    };
    const resolveSource = vi.spyOn(roleArt, "roleArtSource").mockReturnValue(source);
    const { container } = render(<DeathRevealCinematic family="werewolves" players={[player({ revealedRole: "jester" })]} />);

    expect(resolveSource).toHaveBeenCalledWith("werewolves", "jester");
    expect(container.querySelector("source")).toHaveAttribute("srcset", source.src);
    expect(container.querySelector("img")).toHaveAttribute("src", source.src);
  });

  it("keeps the last eligible public reveal without mutating the player order", () => {
    const players = [
      player({ userId: "earlier", displayName: "Earlier Player" }),
      player({ userId: "latest", displayName: "Latest Player", revealedRole: "jester" }),
      player({ userId: "living", displayName: "Living Player", alive: true }),
      player({ userId: "spectator", displayName: "Spectator", playing: false }),
      player({ userId: "hidden", displayName: "Hidden Player", revealedRole: "" }),
    ];
    const originalOrder = [...players];
    render(<DeathRevealCinematic family="werewolves" players={players} />);

    expect(screen.getByRole("heading")).toHaveTextContent("Latest Player");
    expect(players).toEqual(originalOrder);
    expect(screen.queryByText(/Earlier Player|Living Player|Spectator|Hidden Player/)).not.toBeInTheDocument();
  });

  it.each([
    { alive: true },
    { playing: false },
    { revealedRole: "" },
    { revealedRole: "unknown_role" },
  ])("does not render an ineligible public reveal: %j", (overrides) => {
    const { container } = render(<DeathRevealCinematic family="werewolves" players={[player(overrides)]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render without players", () => {
    const { container } = render(<DeathRevealCinematic family="werewolves" players={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
