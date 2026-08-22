import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlaySeat } from "@/components/play/PlaySeat";
import type { PublicPlayer } from "@/lib/play/types";

const PLAY_SEAT_CSS = readFileSync(resolve(process.cwd(), "components/play/PlaySeat.module.css"), "utf8");

function ruleDeclarations(stylesheet: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s"))?.[1] ?? "";
}

function player(overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    userId: "u1",
    displayName: "Анна Иванова",
    avatarId: "portrait-f04",
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
    targetable: false,
    selected: false,
    secondSelected: false,
    voteCount: 0,
    speaking: false,
    defending: false,
    nominee: false,
    canManageNarrator: false,
    canManageMayor: false,
    menuId: "seat-menu-test",
    menuOpen: false,
    menuTriggerRef: vi.fn(),
    onMenuToggle: vi.fn(),
    onMenuActionComplete: vi.fn(),
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

  it("shows the current keyboard target number on an actionable seat", () => {
    renderSeat({ targetable: true, shortcutNumber: 3 });

    expect(screen.getByText("3")).toHaveAttribute("data-seat-shortcut");
    expect(screen.getByRole("button", { name: /клавиш 3/ })).toBeInTheDocument();
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
      const triggerRef = { current: null as HTMLButtonElement | null };

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <PlaySeat
          player={player()}
          phase="lobby"
          narratorMode="honest_human"
          targetable={false}
          selected={false}
          secondSelected={false}
          voteCount={0}
          speaking={false}
          defending={false}
          nominee={false}
          canManageNarrator
          canManageMayor
          menuId="seat-menu-test"
          menuOpen={open}
          menuTriggerRef={(node) => {
            triggerRef.current = node;
          }}
          onMenuToggle={setOpen}
          onMenuActionComplete={() => {
            setOpen(false);
            window.requestAnimationFrame(() => triggerRef.current?.focus());
          }}
          onSelect={vi.fn()}
          onMakeNarrator={onMakeNarrator}
          onMakeMayor={onMakeMayor}
        />
      );
    }

    render(<Harness />);

    await user.click(screen.getByLabelText("Управление за Анна Иванова"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Команди за Анна Иванова" })).toHaveAttribute(
      "data-seat-menu-controls",
    );
    await user.click(screen.getByRole("button", { name: "Разказвач" }));
    await waitFor(() => expect(screen.getByLabelText("Управление за Анна Иванова")).toHaveFocus());
    await user.click(screen.getByLabelText("Управление за Анна Иванова"));
    await user.click(screen.getByRole("button", { name: "Кмет" }));
    await waitFor(() => expect(screen.getByLabelText("Управление за Анна Иванова")).toHaveFocus());

    expect(onMakeNarrator).toHaveBeenCalledTimes(1);
    expect(onMakeMayor).toHaveBeenCalledTimes(1);
  });

  it("shows only public Sport Mafia day markers", () => {
    renderSeat({ speaking: true, nominee: true, phase: "day_discussion" });

    expect(screen.getByText("Реч")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Анна Иванова: говори" })).toHaveAttribute("data-speaking", "true");
    expect(screen.getByRole("group", { name: "Анна Иванова: говори" })).toHaveAttribute("data-nominee", "true");
  });

  it("keeps portrait artwork and public labels in one seat stack", () => {
    renderSeat();

    const seat = screen.getByRole("group", { name: "Анна Иванова: онлайн · водещ" });
    const portrait = seat.querySelector<HTMLElement>("[data-seat-portrait]");
    const avatar = seat.querySelector<HTMLElement>("[data-seat-avatar]");
    const name = seat.querySelector<HTMLElement>("[data-seat-name]");
    const state = seat.querySelector<HTMLElement>("[data-seat-state-label]");

    expect(portrait).toContainElement(avatar);
    expect(seat.children[0]).toBe(portrait);
    expect(seat.children[1]).toBe(name);
    expect(seat.children[2]).toBe(state);
  });
});

describe("PlaySeat stylesheet contracts", () => {
  it("keeps every meaningful seat label at or above 0.68rem", () => {
    const fontSizes = [...PLAY_SEAT_CSS.matchAll(/font-size:\s*(?:clamp\(\s*)?([\d.]+)rem/g)].map((match) => Number(match[1]));

    expect(fontSizes.filter((size) => size < 0.68)).toEqual([]);
  });

  it("backs public seat status text with high-contrast colors", () => {
    const stateRule = ruleDeclarations(PLAY_SEAT_CSS, ".state");

    expect(stateRule).toContain("background: rgba(8, 6, 5, 0.86);");
    expect(stateRule).toContain("color: #fff7df;");
  });

  it("limits interactive motion to a compositor-safe transform", () => {
    expect(ruleDeclarations(PLAY_SEAT_CSS, "button.token")).toContain("transition: transform 180ms ease;");
    expect(PLAY_SEAT_CSS).not.toMatch(/transition:\s*all\b/);
    expect(PLAY_SEAT_CSS).not.toContain("prefers-reduced-motion");
  });

  it("centers portrait artwork, initials, and labels without rotating the seat stack", () => {
    const tokenRule = ruleDeclarations(PLAY_SEAT_CSS, ".token");
    const initialBadgeRule = ruleDeclarations(PLAY_SEAT_CSS, ".initialBadge");
    const eliminatedRule = ruleDeclarations(PLAY_SEAT_CSS, '.token[data-alive="false"]');

    expect(tokenRule).toContain("place-items: center;");
    expect(tokenRule).toContain("padding: 0 3px 3px;");
    expect(initialBadgeRule).toContain("left: 50%;");
    expect(initialBadgeRule).toContain("transform: translateX(-50%);");
    expect(eliminatedRule).not.toContain("transform:");
  });
});
