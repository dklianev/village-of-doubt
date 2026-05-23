import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerTile } from "@/components/play/PlayerTile";
import type { PublicPlayer } from "@/lib/play/types";

function player(overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    userId: "u1",
    displayName: "Анна Иванова",
    connected: true,
    ready: true,
    playing: true,
    alive: true,
    host: true,
    narrator: false,
    acceptedFullNarrator: true,
    mayor: false,
    hasVoted: false,
    actedThisPhase: false,
    revealedRole: "",
    ...overrides,
  };
}

describe("PlayerTile", () => {
  it("renders player identity and table status badges", () => {
    render(
      <PlayerTile
        player={player({ narrator: true, mayor: true, actedThisPhase: true })}
        phase="night"
        narratorMode="full_human"
        canManageNarrator={false}
        canManageMayor={false}
        onMakeNarrator={vi.fn()}
        onMakeMayor={vi.fn()}
      />,
    );

    expect(screen.getByText("Анна Иванова")).toBeInTheDocument();
    expect(screen.getByText("жив")).toBeInTheDocument();
    expect(screen.getByText(/онлайн · водещ · Разказвач · Кмет · готов · приел · действал/)).toBeInTheDocument();
  });

  it("reveals the eliminated role when the server exposes it", () => {
    render(
      <PlayerTile
        player={player({ alive: false, revealedRole: "werewolf" })}
        phase="day_discussion"
        narratorMode="automatic"
        canManageNarrator={false}
        canManageMayor={false}
        onMakeNarrator={vi.fn()}
        onMakeMayor={vi.fn()}
      />,
    );

    expect(screen.getByText(/Върколак/)).toBeInTheDocument();
    expect(screen.queryByText(/прекъсната връзка/)).not.toBeInTheDocument();
  });

  it("routes host management actions", async () => {
    const user = userEvent.setup();
    const onMakeNarrator = vi.fn();
    const onMakeMayor = vi.fn();

    render(
      <PlayerTile
        player={player()}
        phase="lobby"
        narratorMode="automatic"
        canManageNarrator
        canManageMayor
        onMakeNarrator={onMakeNarrator}
        onMakeMayor={onMakeMayor}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Направи Разказвач" }));
    await user.click(screen.getByRole("button", { name: "Направи Кмет" }));

    expect(onMakeNarrator).toHaveBeenCalledTimes(1);
    expect(onMakeMayor).toHaveBeenCalledTimes(1);
  });
});
