import type { ComponentProps } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayStage } from "@/components/play/PlayStage";
import type { PublicPlayer } from "@/lib/play/types";

function player(userId: string, overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    userId, displayName: userId, avatarId: "portrait-f01", connected: true,
    ready: true, playing: true, alive: true, host: false, narrator: false,
    acceptedFullNarrator: false, mayor: false, hasVoted: false,
    actedThisPhase: false, revealedRole: "", ...overrides,
  };
}

function props(overrides: Partial<ComponentProps<typeof PlayStage>> = {}): ComponentProps<typeof PlayStage> {
  const host = player("Искра", { host: true });
  return {
    code: "TEST", phase: "lobby", mode: "werewolves_classic", family: "werewolves",
    round: 0, phaseEndsAt: 0, isPending: false, hasSnapshot: true,
    players: [host, player("Борил", { ready: false })], ownPlayer: host,
    narratorMode: "automatic", communicationMode: "built_in_chat",
    targetableIds: new Set(), shortcutNumbers: new Map(), selectedTargetId: "",
    secondTargetId: "", voteCounts: new Map(), currentSpeakerUserId: "",
    currentDefenseUserId: "", nomineeIds: new Set(),
    onSelectSeat: vi.fn(), onMakeNarrator: vi.fn(), onMakeMayor: vi.fn(),
    ...overrides,
  };
}

describe("pregame table", () => {
  it.each([
    ["werewolves", "werewolves_classic", "Върколак"],
    ["mafia", "mafia_sport", "Спортна Мафия"],
  ] as const)("exposes the %s settings and host identity without duplicate controls", (family, mode, label) => {
    render(<PlayStage {...props({ family, mode })} />);
    expect(screen.getByRole("heading", { name: "Масата се събира" })).toBeVisible();
    expect(screen.getByText("Ти си домакин")).toBeVisible();
    expect(screen.getByRole("region", { name: "Масата се събира" })).toHaveTextContent(label);
    const settings = screen.getByLabelText("Настройки на масата");
    expect(settings).toHaveTextContent("Вграден разговор");
    expect(screen.queryByTestId("ready-toggle")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Започни|Копирай/ })).not.toBeInTheDocument();
  });

  it("renders an optional invitation slot in the lobby header without adding readiness controls", () => {
    const { container, rerender } = render(<PlayStage {...props({
      lobbyInvitation: <button type="button">Копирай покана</button>,
    })} />);
    const invite = screen.getByRole("button", { name: "Копирай покана" });
    expect(invite.closest("[data-stage-hud]")).not.toBeNull();
    expect(invite.closest("[data-table-scene]")).toBeNull();
    expect(container.querySelector("[data-table-core]")).toBeNull();
    expect(screen.queryByTestId("ready-toggle")).not.toBeInTheDocument();
    expect(container.querySelector("progress")).toBeNull();

    rerender(<PlayStage {...props()} />);
    expect(screen.queryByRole("button", { name: "Копирай покана" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Масата се събира" })).toBeVisible();
  });

  it("distinguishes readiness, connectivity and non-playing participants using only public fields", () => {
    const players = [
      player("Искра", { host: true }), player("Борил", { ready: false }),
      player("Рада", { connected: false }),
      player("Неда", { playing: false, narrator: true, ready: false }),
      player("Велин", { playing: false }),
    ];
    const { container } = render(<PlayStage {...props({ players })} />);
    expect(screen.queryByRole("status", { name: /Готови:/ })).not.toBeInTheDocument();
    expect(screen.getByTitle("Искра · Домакин · Готов")).toHaveAttribute("data-state", "ready");
    expect(screen.getByTitle("Борил · Не е готов")).toHaveAttribute("data-state", "waiting");
    expect(screen.getByTitle("Рада · Без връзка")).toHaveAttribute("data-state", "disconnected");
    expect(screen.getByTitle("Неда · Разказвач")).toHaveAttribute("data-state", "observer");
    expect(screen.getByTitle("Велин · Наблюдава")).toHaveAttribute("data-state", "observer");
    expect(container.querySelectorAll("[data-lobby-seat-status]")).toHaveLength(5);
  });

  it("updates seat labels without duplicating the bottom readiness meter or changing seat order", () => {
    const initial = props({ ownPlayer: player("Борил", { ready: false }) });
    const { rerender, container } = render(<PlayStage {...initial} />);
    expect(screen.queryByText(/ти си домакин/i)).not.toBeInTheDocument();
    const seatIds = () => Array.from(container.querySelectorAll("[data-seat-user-id]"), (seat) => seat.getAttribute("data-seat-user-id"));
    expect(seatIds()).toEqual(["Искра", "Борил"]);
    expect(screen.getByTitle("Борил · Не е готов")).toHaveAttribute("data-state", "waiting");
    rerender(<PlayStage {...initial} players={initial.players.map((p) => ({ ...p, ready: true }))} />);
    expect(screen.getByTitle("Борил · Готов")).toHaveAttribute("data-state", "ready");
    expect(seatIds()).toEqual(["Искра", "Борил"]);
    expect(container.querySelector("progress")).toBeNull();
    expect(screen.queryByText(/можеш да започнеш/i)).not.toBeInTheDocument();
  });

  it("keeps empty and loading states finite without declaring readiness", () => {
    const initial = props({ players: [], ownPlayer: undefined, hasSnapshot: false });
    const { container, rerender } = render(<PlayStage {...initial} />);
    expect(container.querySelectorAll(".play-seat-skeleton")).toHaveLength(6);
    expect(container.querySelector("progress")).toBeNull();
    rerender(<PlayStage {...initial} hasSnapshot />);
    expect(container.querySelectorAll(".play-seat-skeleton")).toHaveLength(0);
    expect(container.querySelectorAll("[data-seat-user-id]")).toHaveLength(0);
    expect(screen.queryByRole("status", { name: /Готови:/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Всички са готови")).not.toBeInTheDocument();
  });

  it("retains host seat management in the lobby and routes commands without selecting a target", async () => {
    const user = userEvent.setup();
    const initial = props({ narratorMode: "honest_human" });
    render(<PlayStage {...initial} />);
    const trigger = screen.getByRole("button", { name: "Управление за Борил" });
    await user.click(trigger);
    const controls = screen.getByRole("group", { name: "Команди за Борил" });
    await user.click(within(controls).getByRole("button", { name: "Разказвач" }));
    expect(initial.onMakeNarrator).toHaveBeenCalledExactlyOnceWith("Борил");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    await user.click(within(controls).getByRole("button", { name: "Кмет" }));
    expect(initial.onMakeMayor).toHaveBeenCalledExactlyOnceWith("Борил");
    expect(initial.onSelectSeat).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Избери / })).not.toBeInTheDocument();
  });

  it("does not carry the invitation slot into active gameplay after a lobby transition", () => {
    const initial = props({ lobbyInvitation: <button type="button">Копирай покана</button> });
    const { container, rerender } = render(<PlayStage {...initial} />);
    expect(screen.getByRole("button", { name: "Копирай покана" })).toBeVisible();
    rerender(<PlayStage {...initial} phase="night" round={1} />);
    expect(screen.queryByRole("button", { name: "Копирай покана" })).not.toBeInTheDocument();
    expect(container.querySelector("[data-table-core]")).not.toBeNull();
    expect(container.querySelectorAll("[data-lobby-seat-status]")).toHaveLength(0);
    expect(screen.getByRole("region", { name: "Нощ" })).toBeVisible();
  });

  it("removes an open lobby menu on night transition without consuming Escape", async () => {
    const user = userEvent.setup();
    const initial = props();
    const { container, rerender } = render(<PlayStage {...initial} />);
    await user.click(screen.getByRole("button", { name: "Управление за Борил" }));
    expect(screen.getByRole("group", { name: "Команди за Борил" })).toBeVisible();

    rerender(<PlayStage {...initial} phase="night" round={1}
      targetableIds={new Set(["Борил"])} selectedTargetId="Борил" />);
    expect(container.querySelector("[data-seat-menu-root]")).toBeNull();
    expect(screen.queryByRole("group", { name: "Команди за Борил", hidden: true })).not.toBeInTheDocument();

    const onWindowKeyDown = vi.fn();
    window.addEventListener("keydown", onWindowKeyDown);
    try {
      const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      fireEvent(document, escape);
      expect(escape.defaultPrevented).toBe(false);
      expect(onWindowKeyDown).toHaveBeenCalledExactlyOnceWith(escape);
    } finally {
      window.removeEventListener("keydown", onWindowKeyDown);
    }
  });

  it("does not reopen a stale lobby menu when mayor succession later enables controls", async () => {
    const user = userEvent.setup();
    const initial = props();
    const { container, rerender } = render(<PlayStage {...initial} />);
    await user.click(screen.getByRole("button", { name: "Управление за Борил" }));
    expect(screen.getByRole("group", { name: "Команди за Борил" })).toBeVisible();

    rerender(<PlayStage {...initial} phase="night" round={1} />);
    expect(container.querySelector("[data-seat-menu-root]")).toBeNull();
    // Do not send Escape: it would clear the stale state and mask the regression.
    rerender(<PlayStage {...initial} phase="mayor_successor" round={1} />);
    const trigger = screen.getByRole("button", { name: "Управление за Борил" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector('[data-seat-menu-root][data-open="true"]')).toBeNull();
    expect(screen.queryByRole("group", { name: "Команди за Борил" })).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole("group", { name: "Команди за Борил" })).toBeVisible();
    expect(initial.onMakeMayor).not.toHaveBeenCalled();
  });

  it("does not expose injected private data in lobby statuses", () => {
    const injected = Object.assign(player("Искра"), {
      privateRole: "PRIVATE-LOBBY-CANARY", privateResult: "PRIVATE-LOBBY-CANARY",
      nightActionCapabilities: { canary: "PRIVATE-LOBBY-CANARY" },
    });
    const { container } = render(<PlayStage {...props({ players: [injected], ownPlayer: injected })} />);
    expect(container.innerHTML).not.toContain("PRIVATE-LOBBY-CANARY");
    expect(container.querySelector("[data-acted-this-phase]")).toBeNull();
  });

  it.each<{
    reason: string;
    initial?: Partial<ComponentProps<typeof PlayStage>>;
    update: (initial: ComponentProps<typeof PlayStage>) => Partial<ComponentProps<typeof PlayStage>>;
  }>([
    { reason: "the target leaves", update: initial => ({ players: initial.players.slice(0, 1) }) },
    { reason: "host permission is lost", update: () => ({ ownPlayer: player("Искра") }) },
    {
      reason: "narrator permission is lost",
      initial: { phase: "mayor_successor", ownPlayer: player("Искра", { narrator: true }) },
      update: () => ({ ownPlayer: player("Искра") }),
    },
    { reason: "the current player disappears", update: () => ({ ownPlayer: undefined }) },
    {
      reason: "the target becomes eliminated",
      update: initial => ({ players: initial.players.map(p => p.userId === "Борил" ? { ...p, alive: false } : p) }),
    },
    {
      reason: "the target stops participating",
      update: initial => ({ players: initial.players.map(p => p.userId === "Борил" ? { ...p, playing: false } : p) }),
    },
    { reason: "the seat becomes targetable", update: () => ({ targetableIds: new Set(["Борил"]) }) },
    {
      reason: "narrator management is disabled",
      initial: { family: "mafia", mode: "mafia_free", narratorMode: "honest_human" },
      update: () => ({ narratorMode: "automatic" }),
    },
  ])("invalidates an open menu when $reason in the same phase, without stealing focus or Escape", async ({ initial: overrides, update }) => {
    const user = userEvent.setup();
    const initial = props(overrides);
    const view = (stageProps: ComponentProps<typeof PlayStage>) => <>
      <button type="button">Друго действие</button>
      <PlayStage {...stageProps} />
    </>;
    const { container, rerender } = render(view(initial));
    await user.click(screen.getByRole("button", { name: "Управление за Борил" }));
    expect(screen.getByRole("group", { name: "Команди за Борил" })).toBeVisible();
    const otherAction = screen.getByRole("button", { name: "Друго действие" });
    otherAction.focus();

    rerender(view({ ...initial, ...update(initial) }));
    expect(container.querySelector('[data-menu-open="true"]')).toBeNull();
    expect(screen.queryByRole("group", { name: "Команди за Борил" })).not.toBeInTheDocument();
    expect(otherAction).toHaveFocus();
    const onWindowKeyDown = vi.fn();
    window.addEventListener("keydown", onWindowKeyDown);
    try {
      const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      fireEvent(document, escape);
      expect(escape.defaultPrevented).toBe(false);
      expect(onWindowKeyDown).toHaveBeenCalledExactlyOnceWith(escape);
    } finally {
      window.removeEventListener("keydown", onWindowKeyDown);
    }

    rerender(view(initial));
    const trigger = screen.getByRole("button", { name: "Управление за Борил" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(otherAction).toHaveFocus();
    await user.click(trigger);
    expect(screen.getByRole("group", { name: "Команди за Борил" })).toBeVisible();
    expect(initial.onMakeMayor).not.toHaveBeenCalled();
    expect(initial.onMakeNarrator).not.toHaveBeenCalled();
  });

  it("retains an eligible open menu across routine participant updates", async () => {
    const user = userEvent.setup();
    const initial = props({ narratorMode: "honest_human" });
    const { rerender } = render(<PlayStage {...initial} />);
    await user.click(screen.getByRole("button", { name: "Управление за Борил" }));
    rerender(<PlayStage {...initial}
      players={initial.players.map(p => ({ ...p, ready: !p.ready, connected: false }))} />);
    expect(screen.getByRole("button", { name: "Управление за Борил" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Команди за Борил" })).toBeVisible();
  });

  it("keeps active-phase identity and timer distinct from lobby controls", () => {
    const { container } = render(<PlayStage {...props({ phase: "night", round: 2 })} />);
    const stage = screen.getByRole("region", { name: "Нощ" });
    expect(within(stage).getByText("Върколак · нощ 2")).toBeVisible();
    expect(within(stage).getByText("TEST")).toBeVisible();
    expect(within(stage).getByRole("timer")).toBeVisible();
    expect(container.querySelectorAll("[data-lobby-seat-status]")).toHaveLength(0);
    expect(container.querySelector("progress")).toBeNull();
    expect(screen.queryByRole("group", { name: "Настройки на масата" })).not.toBeInTheDocument();
  });

  it("counts only participants when displaying alive and eliminated players", () => {
    const players = [
      player("Искра"), player("Борил", { alive: false }),
      player("Рада", { playing: false }), player("Неда", { playing: false, alive: false }),
    ];
    const { container } = render(<PlayStage {...props({ phase: "night", players })} />);
    expect(screen.getByText("1 жив · 1 елиминиран")).toBeVisible();
    expect(container.querySelectorAll(".play-seat-slot")).toHaveLength(2);
  });
});
