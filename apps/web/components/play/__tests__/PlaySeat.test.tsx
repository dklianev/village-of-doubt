import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlaySeat } from "@/components/play/PlaySeat";
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

function renderSeat(overrides: Partial<Parameters<typeof PlaySeat>[0]> = {}) {
  const props: Parameters<typeof PlaySeat>[0] = {
    player: player(),
    phase: "voting",
    narratorMode: "automatic",
    portraitSlot: 4,
    targetable: false,
    selected: false,
    secondSelected: false,
    voteCount: 0,
    canManageNarrator: false,
    canManageMayor: false,
    menuId: "seat-menu-test",
    menuOpen: false,
    menuTriggerRef: vi.fn(),
    onMenuToggle: vi.fn(),
    onSelect: vi.fn(),
    onMakeNarrator: vi.fn(),
    onMakeMayor: vi.fn(),
    ...overrides,
  };

  render(<PlaySeat {...props} />);
  return props;
}

describe("PlaySeat", () => {
  it("uses the seat as the target button and exposes selection state accessibly", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderSeat({
      targetable: true,
      selected: true,
      voteCount: 2,
      onSelect,
    });

    const target = screen.getByRole("button", { name: "Избери Анна Иванова: онлайн · водещ, 2 гласа, избрана цел" });

    expect(target).toHaveAttribute("aria-pressed", "true");

    await user.click(target);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders revealed eliminated roles only when they are public", () => {
    renderSeat({
      player: player({ alive: false, revealedRole: "werewolf" }),
      phase: "day_discussion",
    });

    expect(screen.getByText("Върколак")).toBeInTheDocument();
  });

  it("routes host management actions from the seat controls", async () => {
    const user = userEvent.setup();
    const onMakeNarrator = vi.fn();
    const onMakeMayor = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <PlaySeat
          player={player()}
          phase="lobby"
          narratorMode="honest_human"
          portraitSlot={2}
          targetable={false}
          selected={false}
          secondSelected={false}
          voteCount={0}
          canManageNarrator
          canManageMayor
          menuId="seat-menu-test"
          menuOpen={open}
          menuTriggerRef={vi.fn()}
          onMenuToggle={setOpen}
          onSelect={vi.fn()}
          onMakeNarrator={onMakeNarrator}
          onMakeMayor={onMakeMayor}
        />
      );
    }

    render(<Harness />);

    await user.click(screen.getByLabelText("Управление за Анна Иванова"));
    await user.click(screen.getByRole("menuitem", { name: "Разказвач" }));
    await user.click(screen.getByLabelText("Управление за Анна Иванова"));
    await user.click(screen.getByRole("menuitem", { name: "Кмет" }));

    expect(onMakeNarrator).toHaveBeenCalledTimes(1);
    expect(onMakeMayor).toHaveBeenCalledTimes(1);
  });
});
